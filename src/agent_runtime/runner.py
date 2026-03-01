from __future__ import annotations

import json
from dataclasses import dataclass, replace
from uuid import uuid4

from control_api import AdvanceDayResult, ControlApiClient, GlobalMarketState

from seller_core.client import SellerCoreClient

from .briefing import (
    LiveBriefingBuildResult,
    LiveMorningBriefingBuilder,
    MorningBriefing,
    ShopStateSnapshot,
)
from .events import EventKind, EventLog, InMemoryEventLog, RuntimeEvent
from .loop import DailyLoopConfig, DayRunResult, SingleShopDailyLoop
from .memory import (
    AgentMemoryStore,
    InMemoryAgentMemory,
    ReminderRecord,
    ShopId,
    WorkspaceEntryRecord,
    WorkspaceRecord,
)
from .providers import (
    MistralProviderConfig,
    MistralToolCallingProvider,
    ProviderError,
    ProviderPolicyConfig,
    ProviderMessage,
    ProviderMessageRole,
    ProviderToolDefinition,
    ToolCallingAgentPolicy,
    ToolCallingProvider,
)
from .serialization import jsonify
from .tools import build_owner_agent_tool_registry

END_OF_DAY_SCRATCHPAD_TOOL_NAME = "save_end_of_day_scratchpad"
END_OF_DAY_SCRATCHPAD_SYSTEM_PROMPT = (
    "You are closing out a Botique shop workday. Revise your persistent scratchpad for "
    "future days. Keep anything still useful, remove stale parts, and add anything new. "
    "The scratchpad is your mutable cross-day working context. No user is waiting for "
    "you. Do not explain your process; just save the next full scratchpad text."
)


@dataclass(frozen=True, slots=True)
class OwnerAgentRunnerConfig:
    turns_per_day: int = 5


@dataclass(frozen=True, slots=True)
class LiveDayRunResult:
    run_id: str
    shop_id: ShopId
    day: int
    market_state_before: GlobalMarketState
    state_before: ShopStateSnapshot
    day_result: DayRunResult
    state_after: ShopStateSnapshot
    state_next_day: ShopStateSnapshot | None = None
    advancement: AdvanceDayResult | None = None
    events: tuple[RuntimeEvent, ...] = ()


@dataclass(frozen=True, slots=True)
class MultiDayRunResult:
    run_id: str
    shop_id: ShopId
    days: tuple[LiveDayRunResult, ...]
    events: tuple[RuntimeEvent, ...]
    workspace_entries: tuple[WorkspaceEntryRecord, ...]
    reminders: tuple[ReminderRecord, ...]
    workspace: WorkspaceRecord | None = None
    workspace_revisions: tuple[WorkspaceRecord, ...] = ()


class OwnerAgentRunner:
    def __init__(
        self,
        *,
        provider: ToolCallingProvider,
        seller_client: SellerCoreClient,
        control_client: ControlApiClient | None = None,
        memory: AgentMemoryStore | None = None,
        event_log: EventLog | None = None,
        config: OwnerAgentRunnerConfig | None = None,
        policy_config: ProviderPolicyConfig | None = None,
    ) -> None:
        self.provider = provider
        self.seller_client = seller_client
        self.control_client = control_client
        self.memory = memory or InMemoryAgentMemory()
        self.event_log = event_log or InMemoryEventLog()
        self.config = config or OwnerAgentRunnerConfig()
        self.policy = ToolCallingAgentPolicy(
            provider,
            config=policy_config,
        )

    def run_day(self, briefing: MorningBriefing) -> DayRunResult:
        loop = SingleShopDailyLoop(
            tool_registry=build_owner_agent_tool_registry(
                self.seller_client,
                memory=self.memory,
                shop_id=briefing.shop_id,
            ),
            event_log=self.event_log,
            config=DailyLoopConfig(turns_per_day=self.config.turns_per_day),
        )
        day_result = loop.run_day(briefing=briefing, policy=self.policy)
        return self._write_end_of_day_scratchpad(
            briefing=briefing,
            day_result=day_result,
        )

    def build_live_briefing(
        self,
        *,
        shop_id: ShopId,
        run_id: str | None = None,
        previous_shop_state: ShopStateSnapshot | None = None,
    ) -> LiveBriefingBuildResult:
        return self._live_briefings().build(
            run_id=run_id or f"run_{uuid4().hex[:12]}",
            shop_id=shop_id,
            previous_shop_state=previous_shop_state,
        )

    def run_live_day(
        self,
        *,
        shop_id: ShopId,
        run_id: str | None = None,
        previous_shop_state: ShopStateSnapshot | None = None,
        advance_day: bool = False,
        reset_world: bool = False,
        scenario_id: str | None = None,
    ) -> LiveDayRunResult:
        active_run_id = run_id or f"run_{uuid4().hex[:12]}"
        if reset_world or scenario_id is not None:
            self._require_control_client().reset_world(
                scenario_id=scenario_id,
                controlled_shop_ids=(int(shop_id),),
            )
            previous_shop_state = None
        live_briefing = self.build_live_briefing(
            shop_id=shop_id,
            run_id=active_run_id,
            previous_shop_state=previous_shop_state,
        )
        day_result = self.run_day(live_briefing.briefing)
        post_day_state = self.build_live_briefing(
            shop_id=shop_id,
            run_id=active_run_id,
            previous_shop_state=live_briefing.shop_state,
        ).shop_state

        advancement: AdvanceDayResult | None = None
        next_day_state: ShopStateSnapshot | None = None
        if advance_day:
            advancement = self._require_control_client().advance_day(
                controlled_shop_ids=(int(shop_id),)
            )
            self.event_log.append(
                kind=EventKind.SIMULATION_ADVANCED,
                run_id=active_run_id,
                shop_id=shop_id,
                day=day_result.day,
                payload={
                    "previous_day": {
                        "day": advancement.previous_day.day,
                        "date": advancement.previous_day.date,
                        "advanced_at": advancement.previous_day.advanced_at,
                    },
                    "current_day": {
                        "day": advancement.current_day.day,
                        "date": advancement.current_day.date,
                        "advanced_at": advancement.current_day.advanced_at,
                    },
                    "steps": [
                        {
                            "name": step.name,
                            "description": step.description,
                        }
                        for step in advancement.steps
                    ],
                },
            )
            next_day_state = self.build_live_briefing(
                shop_id=shop_id,
                run_id=active_run_id,
                previous_shop_state=post_day_state,
            ).shop_state

        return LiveDayRunResult(
            run_id=active_run_id,
            shop_id=shop_id,
            day=day_result.day,
            market_state_before=live_briefing.market_state,
            state_before=live_briefing.shop_state,
            day_result=day_result,
            state_after=post_day_state,
            state_next_day=next_day_state,
            advancement=advancement,
            events=tuple(
                self.event_log.list_events(
                    run_id=active_run_id,
                    shop_id=shop_id,
                    day=day_result.day,
                )
            ),
        )

    def run_live_days(
        self,
        *,
        shop_id: ShopId,
        days: int,
        run_id: str | None = None,
        reset_world: bool = False,
        scenario_id: str | None = None,
    ) -> MultiDayRunResult:
        if days < 1:
            raise ValueError("days must be at least 1.")

        active_run_id = run_id or f"run_{uuid4().hex[:12]}"
        previous_shop_state: ShopStateSnapshot | None = None
        live_days: list[LiveDayRunResult] = []

        if reset_world or scenario_id is not None:
            self._require_control_client().reset_world(
                scenario_id=scenario_id,
                controlled_shop_ids=(int(shop_id),),
            )

        for index in range(days):
            live_day = self.run_live_day(
                shop_id=shop_id,
                run_id=active_run_id,
                previous_shop_state=previous_shop_state,
                advance_day=index < days - 1,
                reset_world=False,
                scenario_id=None,
            )
            live_days.append(live_day)
            previous_shop_state = live_day.state_after

        return MultiDayRunResult(
            run_id=active_run_id,
            shop_id=shop_id,
            days=tuple(live_days),
            events=tuple(self.event_log.list_events(run_id=active_run_id, shop_id=shop_id)),
            workspace_entries=tuple(self.memory.list_workspace_entries(shop_id=shop_id)),
            reminders=tuple(self.memory.list_reminders(shop_id=shop_id)),
            workspace=self.memory.read_workspace(shop_id=shop_id),
            workspace_revisions=tuple(
                self.memory.list_workspace_revisions(shop_id=shop_id)
            ),
        )

    def _live_briefings(self) -> LiveMorningBriefingBuilder:
        return LiveMorningBriefingBuilder(
            seller_client=self.seller_client,
            control_client=self._require_control_client(),
            memory=self.memory,
        )

    def _require_control_client(self) -> ControlApiClient:
        if self.control_client is None:
            raise ValueError(
                "Live runtime flows require a configured control API client."
            )
        return self.control_client

    def _write_end_of_day_scratchpad(
        self,
        *,
        briefing: MorningBriefing,
        day_result: DayRunResult,
    ) -> DayRunResult:
        response = self.provider.complete(
            messages=(
                ProviderMessage(
                    role=ProviderMessageRole.SYSTEM,
                    content=END_OF_DAY_SCRATCHPAD_SYSTEM_PROMPT,
                ),
                ProviderMessage(
                    role=ProviderMessageRole.USER,
                    content=self._build_end_of_day_scratchpad_message(
                        briefing=briefing,
                        day_result=day_result,
                    ),
                ),
            ),
            tools=(
                ProviderToolDefinition(
                    name=END_OF_DAY_SCRATCHPAD_TOOL_NAME,
                    description="Save the next full scratchpad text for future days after the current workday is over.",
                    parameters_schema={
                        "type": "object",
                        "properties": {
                            "content": {
                                "type": "string",
                                "description": "The next full scratchpad text. Keep anything still useful, remove stale parts, and add anything new. This may be empty if you intentionally want to clear the scratchpad.",
                            },
                        },
                        "required": ["content"],
                        "additionalProperties": False,
                    },
                ),
            ),
            tool_choice="any",
            allow_parallel_tool_calls=False,
        )

        content = self._extract_end_of_day_scratchpad(response)
        scratchpad = self.memory.update_workspace(
            shop_id=briefing.shop_id,
            content=content,
            day=briefing.day,
        )
        self.event_log.append(
            kind=EventKind.WORKSPACE_UPDATED,
            run_id=day_result.run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "source": "end_of_day_reflection",
                "result": scratchpad.to_payload(),
            },
        )
        return replace(
            day_result,
            day_scratchpad=scratchpad,
            events=tuple(
                self.event_log.list_events(
                    run_id=day_result.run_id,
                    shop_id=briefing.shop_id,
                    day=briefing.day,
                )
            ),
        )

    @staticmethod
    def _extract_end_of_day_scratchpad(
        response: object,
    ) -> str:
        if hasattr(response, "tool_calls"):
            tool_calls = getattr(response, "tool_calls")
            if tool_calls:
                tool_call = tool_calls[0]
                if tool_call.name != END_OF_DAY_SCRATCHPAD_TOOL_NAME:
                    raise ProviderError(
                        f"Expected {END_OF_DAY_SCRATCHPAD_TOOL_NAME}, received {tool_call.name!r}."
                    )
                content = tool_call.arguments.get("content")
                if isinstance(content, str):
                    return content.strip()
                raise ProviderError("End-of-day scratchpad content must be a string.")

        content = getattr(response, "content", None)
        if isinstance(content, str):
            return content.strip()
        raise ProviderError("Provider returned no usable end-of-day scratchpad revision.")

    @staticmethod
    def _build_end_of_day_scratchpad_message(
        *,
        briefing: MorningBriefing,
        day_result: DayRunResult,
    ) -> str:
        turns_payload = [
            {
                "work_slot": turn.turn_index,
                "decision_summary": turn.decision_summary,
                "action": None if turn.tool_call is None else turn.tool_call.name,
                "arguments": None if turn.tool_call is None else turn.tool_call.arguments,
                "result": None
                if turn.tool_result is None
                else jsonify(turn.tool_result.output),
            }
            for turn in day_result.turns
        ]
        payload = {
            "day": briefing.day,
            "end_reason": day_result.end_reason.value,
            "current_scratchpad": (
                None
                if briefing.workspace is None
                else briefing.workspace.content
            ),
            "morning_briefing": briefing.to_prompt_payload(),
            "work_done_today": turns_payload,
        }
        return (
            "Revise the scratchpad for later days based on the current scratchpad, today's seller-visible state, and today's work.\n\n"
            "```json\n"
            f"{json.dumps(payload, indent=2)}\n"
            "```"
        )


def build_default_owner_agent_runner(
    *,
    turns_per_day: int = 5,
    work_budget: int | None = None,
    max_turns: int | None = None,
    base_url: str | None = None,
    control_base_url: str | None = None,
    api_key: str | None = None,
    bearer_token: str | None = None,
    timeout_seconds: float | None = None,
    mistral_api_key: str | None = None,
    mistral_model: str | None = None,
    mistral_temperature: float | None = None,
    mistral_top_p: float | None = None,
    memory: AgentMemoryStore | None = None,
    event_log: EventLog | None = None,
    policy_config: ProviderPolicyConfig | None = None,
) -> OwnerAgentRunner:
    effective_turns_per_day = turns_per_day
    if work_budget is not None:
        effective_turns_per_day = work_budget
    if max_turns is not None:
        effective_turns_per_day = max_turns
    seller_client = SellerCoreClient.from_env(
        base_url=base_url,
        api_key=api_key,
        bearer_token=bearer_token,
        timeout_seconds=timeout_seconds,
    )
    control_client = ControlApiClient.maybe_from_env(
        base_url=control_base_url,
        core_base_url=base_url,
        api_key=api_key,
        bearer_token=bearer_token,
        timeout_seconds=timeout_seconds,
    )
    provider = MistralToolCallingProvider(
        MistralProviderConfig.from_env(
            api_key=mistral_api_key,
            model=mistral_model,
            temperature=mistral_temperature,
            top_p=mistral_top_p,
        )
    )
    return OwnerAgentRunner(
        provider=provider,
        seller_client=seller_client,
        control_client=control_client,
        memory=memory,
        event_log=event_log,
        config=OwnerAgentRunnerConfig(turns_per_day=effective_turns_per_day),
        policy_config=policy_config,
    )
