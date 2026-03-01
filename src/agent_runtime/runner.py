from __future__ import annotations

from dataclasses import dataclass
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
from .memory import AgentMemoryStore, InMemoryAgentMemory, NoteRecord, ReminderRecord, ShopId
from .providers import (
    MistralProviderConfig,
    MistralToolCallingProvider,
    ProviderPolicyConfig,
    ToolCallingAgentPolicy,
    ToolCallingProvider,
)
from .tools import build_owner_agent_tool_registry


@dataclass(frozen=True, slots=True)
class OwnerAgentRunnerConfig:
    work_budget: int = 8


@dataclass(frozen=True, slots=True)
class LiveDayRunResult:
    run_id: str
    shop_id: ShopId
    day: int
    market_state_before: GlobalMarketState
    state_before: ShopStateSnapshot
    day_result: DayRunResult
    state_after: ShopStateSnapshot
    advancement: AdvanceDayResult | None = None


@dataclass(frozen=True, slots=True)
class MultiDayRunResult:
    run_id: str
    shop_id: ShopId
    days: tuple[LiveDayRunResult, ...]
    events: tuple[RuntimeEvent, ...]
    notes: tuple[NoteRecord, ...]
    reminders: tuple[ReminderRecord, ...]


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
            config=DailyLoopConfig(work_budget=self.config.work_budget),
        )
        return loop.run_day(briefing=briefing, policy=self.policy)

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
    ) -> LiveDayRunResult:
        active_run_id = run_id or f"run_{uuid4().hex[:12]}"
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
        if advance_day:
            advancement = self._require_control_client().advance_day()
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

        return LiveDayRunResult(
            run_id=active_run_id,
            shop_id=shop_id,
            day=day_result.day,
            market_state_before=live_briefing.market_state,
            state_before=live_briefing.shop_state,
            day_result=day_result,
            state_after=post_day_state,
            advancement=advancement,
        )

    def run_live_days(
        self,
        *,
        shop_id: ShopId,
        days: int,
        run_id: str | None = None,
    ) -> MultiDayRunResult:
        if days < 1:
            raise ValueError("days must be at least 1.")

        active_run_id = run_id or f"run_{uuid4().hex[:12]}"
        previous_shop_state: ShopStateSnapshot | None = None
        live_days: list[LiveDayRunResult] = []

        for index in range(days):
            live_day = self.run_live_day(
                shop_id=shop_id,
                run_id=active_run_id,
                previous_shop_state=previous_shop_state,
                advance_day=index < days - 1,
            )
            live_days.append(live_day)
            previous_shop_state = live_day.state_after

        return MultiDayRunResult(
            run_id=active_run_id,
            shop_id=shop_id,
            days=tuple(live_days),
            events=tuple(self.event_log.list_events(run_id=active_run_id, shop_id=shop_id)),
            notes=tuple(self.memory.list_notes(shop_id=shop_id)),
            reminders=tuple(self.memory.list_reminders(shop_id=shop_id)),
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


def build_default_owner_agent_runner(
    *,
    work_budget: int = 8,
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
    effective_work_budget = work_budget if max_turns is None else max_turns
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
        config=OwnerAgentRunnerConfig(work_budget=effective_work_budget),
        policy_config=policy_config,
    )
