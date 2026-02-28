from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Protocol
from uuid import uuid4

from seller_core.models import JSONValue

from .briefing import MorningBriefing
from .events import EventKind, EventLog, InMemoryEventLog, RuntimeEvent
from .memory import ShopId
from .serialization import jsonify
from .tools.registry import AgentToolRegistry, ToolBehavior, ToolExecutionResult, ToolManifestEntry


NO_ACTION_TOOL_NAME = "no_action"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DayEndReason(StrEnum):
    ACTION_COMPLETED = "action_completed"
    NO_ACTION = "no_action"
    MAX_TURNS_REACHED = "max_turns_reached"


@dataclass(frozen=True, slots=True)
class DailyLoopConfig:
    max_turns: int = 3
    max_inspect_turns: int = 2

    def __post_init__(self) -> None:
        if self.max_turns < 1:
            raise ValueError("max_turns must be at least 1.")
        if self.max_inspect_turns < 0:
            raise ValueError("max_inspect_turns must be non-negative.")


@dataclass(frozen=True, slots=True)
class ToolCall:
    name: str
    arguments: dict[str, object]


@dataclass(frozen=True, slots=True)
class AgentTurnDecision:
    summary: str
    tool_call: ToolCall
    assistant_text: str = ""
    provider_tool_calls: tuple[dict[str, JSONValue], ...] = ()

    def __post_init__(self) -> None:
        if not self.summary.strip():
            raise ValueError("summary must be non-empty.")
        if not self.tool_call.name.strip():
            raise ValueError("tool_call.name must be non-empty.")


@dataclass(frozen=True, slots=True)
class TurnRecord:
    turn_index: int
    decision_summary: str
    started_at: datetime
    completed_at: datetime
    tool_call: ToolCall | None = None
    tool_result: ToolExecutionResult | None = None
    state_changes: dict[str, JSONValue] | None = None
    assistant_text: str = ""
    provider_tool_calls: tuple[dict[str, JSONValue], ...] = ()


class TurnPhase(StrEnum):
    INSPECT_OR_ACT = "inspect_or_act"
    ACT_OR_NO_ACTION = "act_or_no_action"


@dataclass(frozen=True, slots=True)
class AgentTurnContext:
    run_id: str
    briefing: MorningBriefing
    turn_index: int
    max_turns: int
    remaining_turns: int
    available_tools: tuple[ToolManifestEntry, ...]
    turn_phase: TurnPhase = TurnPhase.INSPECT_OR_ACT
    remaining_inspect_turns: int = 0
    remaining_action_turns: int = 1
    allow_no_action: bool = False
    phase_instructions: tuple[str, ...] = ()
    prior_turns: tuple[TurnRecord, ...] = ()


class DailyAgentPolicy(Protocol):
    def next_turn(self, context: AgentTurnContext) -> AgentTurnDecision: ...


@dataclass(frozen=True, slots=True)
class DayRunResult:
    run_id: str
    shop_id: ShopId
    day: int
    briefing: MorningBriefing
    turns: tuple[TurnRecord, ...]
    events: tuple[RuntimeEvent, ...]
    end_reason: DayEndReason


class SingleShopDailyLoop:
    def __init__(
        self,
        *,
        tool_registry: AgentToolRegistry,
        event_log: EventLog | None = None,
        config: DailyLoopConfig | None = None,
    ) -> None:
        self.tool_registry = tool_registry
        self.event_log = event_log or InMemoryEventLog()
        self.config = config or DailyLoopConfig()

    def run_day(
        self,
        *,
        briefing: MorningBriefing,
        policy: DailyAgentPolicy,
        run_id: str | None = None,
    ) -> DayRunResult:
        active_run_id = run_id or briefing.run_id or f"run_{uuid4().hex[:12]}"
        all_tools = tuple(self.tool_registry.manifest())
        turns: list[TurnRecord] = []
        inspect_turns_used = 0

        self.event_log.append(
            kind=EventKind.DAY_STARTED,
            run_id=active_run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "shop_name": briefing.shop_name,
                "max_turns": self.config.max_turns,
                "max_inspect_turns": self.config.max_inspect_turns,
            },
        )
        self.event_log.append(
            kind=EventKind.BRIEFING_GENERATED,
            run_id=active_run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={"briefing": briefing.to_prompt_payload()},
        )

        for turn_index in range(1, self.config.max_turns + 1):
            remaining_turns = self.config.max_turns - turn_index + 1
            turn_phase = self._determine_turn_phase(
                remaining_turns=remaining_turns,
                inspect_turns_used=inspect_turns_used,
            )
            available_tools = self._available_tools(
                all_tools=all_tools,
                turn_phase=turn_phase,
            )
            self.event_log.append(
                kind=EventKind.TURN_STARTED,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "remaining_turns": remaining_turns,
                    "turn_phase": turn_phase.value,
                    "available_tools": [tool.name for tool in available_tools],
                },
            )

            started_at = _utcnow()
            context = AgentTurnContext(
                run_id=active_run_id,
                briefing=briefing,
                turn_index=turn_index,
                max_turns=self.config.max_turns,
                remaining_turns=remaining_turns,
                available_tools=available_tools,
                turn_phase=turn_phase,
                remaining_inspect_turns=max(0, self.config.max_inspect_turns - inspect_turns_used),
                remaining_action_turns=1,
                allow_no_action=turn_phase is TurnPhase.ACT_OR_NO_ACTION,
                phase_instructions=self._phase_instructions(turn_phase),
                prior_turns=tuple(turns),
            )
            decision = policy.next_turn(context)
            self.event_log.append(
                kind=EventKind.MODEL_RESPONSE,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "summary": decision.summary,
                    "action": self._action_label(decision.tool_call.name),
                    "tool_name": decision.tool_call.name,
                    "assistant_text": decision.assistant_text,
                    "provider_tool_calls": decision.provider_tool_calls,
                },
            )

            self._validate_choice(
                decision.tool_call.name,
                available_tools=available_tools,
                allow_no_action=context.allow_no_action,
            )

            if decision.tool_call.name == NO_ACTION_TOOL_NAME:
                turns.append(
                    TurnRecord(
                        turn_index=turn_index,
                        decision_summary=decision.summary,
                        started_at=started_at,
                        completed_at=_utcnow(),
                        tool_call=decision.tool_call,
                        assistant_text=decision.assistant_text,
                        provider_tool_calls=decision.provider_tool_calls,
                    )
                )
                return self._finish_day(
                    briefing=briefing,
                    run_id=active_run_id,
                    turns=turns,
                    end_reason=DayEndReason.NO_ACTION,
                )

            self.event_log.append(
                kind=EventKind.TOOL_CALLED,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "tool_name": decision.tool_call.name,
                    "arguments": jsonify(decision.tool_call.arguments),
                },
            )
            try:
                tool_result = self.tool_registry.invoke(
                    decision.tool_call.name,
                    decision.tool_call.arguments,
                )
            except Exception as exc:
                self.event_log.append(
                    kind=EventKind.TOOL_FAILED,
                    run_id=active_run_id,
                    shop_id=briefing.shop_id,
                    day=briefing.day,
                    turn_index=turn_index,
                    payload={
                        "tool_name": decision.tool_call.name,
                        "error_type": exc.__class__.__name__,
                        "message": str(exc),
                    },
                )
                raise

            self.event_log.append(
                kind=EventKind.TOOL_RESULT,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "tool_name": tool_result.tool_name,
                    "surface": tool_result.tool.surface.value,
                    "result": jsonify(tool_result.output),
                },
            )

            if tool_result.tool_name == "write_note":
                self.event_log.append(
                    kind=EventKind.NOTE_WRITTEN,
                    run_id=active_run_id,
                    shop_id=briefing.shop_id,
                    day=briefing.day,
                    turn_index=turn_index,
                    payload={"result": jsonify(tool_result.output)},
                )
            elif tool_result.tool_name == "set_reminder":
                self.event_log.append(
                    kind=EventKind.REMINDER_SET,
                    run_id=active_run_id,
                    shop_id=briefing.shop_id,
                    day=briefing.day,
                    turn_index=turn_index,
                    payload={"result": jsonify(tool_result.output)},
                )
            elif tool_result.tool_name == "complete_reminder":
                self.event_log.append(
                    kind=EventKind.REMINDER_COMPLETED,
                    run_id=active_run_id,
                    shop_id=briefing.shop_id,
                    day=briefing.day,
                    turn_index=turn_index,
                    payload={"result": jsonify(tool_result.output)},
                )

            turns.append(
                TurnRecord(
                    turn_index=turn_index,
                    decision_summary=decision.summary,
                    started_at=started_at,
                    completed_at=_utcnow(),
                    tool_call=decision.tool_call,
                    tool_result=tool_result,
                    assistant_text=decision.assistant_text,
                    provider_tool_calls=decision.provider_tool_calls,
                )
            )

            if tool_result.tool.behavior is ToolBehavior.INSPECT:
                inspect_turns_used += 1
                continue

            if tool_result.tool.behavior is ToolBehavior.ACT:
                return self._finish_day(
                    briefing=briefing,
                    run_id=active_run_id,
                    turns=turns,
                    end_reason=DayEndReason.ACTION_COMPLETED,
                )

        return self._finish_day(
            briefing=briefing,
            run_id=active_run_id,
            turns=turns,
            end_reason=DayEndReason.MAX_TURNS_REACHED,
        )

    def _determine_turn_phase(
        self,
        *,
        remaining_turns: int,
        inspect_turns_used: int,
    ) -> TurnPhase:
        if inspect_turns_used >= self.config.max_inspect_turns or remaining_turns <= 1:
            return TurnPhase.ACT_OR_NO_ACTION
        return TurnPhase.INSPECT_OR_ACT

    @staticmethod
    def _available_tools(
        *,
        all_tools: tuple[ToolManifestEntry, ...],
        turn_phase: TurnPhase,
    ) -> tuple[ToolManifestEntry, ...]:
        allowed_behaviors = (
            {ToolBehavior.INSPECT, ToolBehavior.ACT}
            if turn_phase is TurnPhase.INSPECT_OR_ACT
            else {ToolBehavior.ACT}
        )
        return tuple(tool for tool in all_tools if tool.behavior in allowed_behaviors)

    @staticmethod
    def _phase_instructions(turn_phase: TurnPhase) -> tuple[str, ...]:
        if turn_phase is TurnPhase.ACT_OR_NO_ACTION:
            return (
                "Return exactly one tool call for this turn.",
                "Inspection is done for today. Choose one primary business-changing action, or call no_action if no change is justified.",
                "Do not call a pure inspection tool in this phase.",
            )
        return (
            "Return exactly one tool call for this turn.",
            "Use inspection only to support a concrete shop decision.",
            "You may inspect evidence or make today's primary business change now.",
        )

    @staticmethod
    def _action_label(tool_name: str) -> str:
        if tool_name == NO_ACTION_TOOL_NAME:
            return "no_action"
        return "tool_call"

    @staticmethod
    def _validate_choice(
        tool_name: str,
        *,
        available_tools: tuple[ToolManifestEntry, ...],
        allow_no_action: bool,
    ) -> None:
        allowed_tool_names = {tool.name for tool in available_tools}
        if allow_no_action:
            allowed_tool_names.add(NO_ACTION_TOOL_NAME)
        if tool_name not in allowed_tool_names:
            raise ValueError(f"Tool {tool_name!r} is not allowed in this turn phase.")

    def _finish_day(
        self,
        *,
        briefing: MorningBriefing,
        run_id: str,
        turns: list[TurnRecord],
        end_reason: DayEndReason,
    ) -> DayRunResult:
        self.event_log.append(
            kind=EventKind.DAY_ENDED,
            run_id=run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "end_reason": end_reason.value,
                "turn_count": len(turns),
            },
        )
        events = tuple(
            self.event_log.list_events(run_id=run_id, shop_id=briefing.shop_id, day=briefing.day)
        )
        return DayRunResult(
            run_id=run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            briefing=briefing,
            turns=tuple(turns),
            events=events,
            end_reason=end_reason,
        )
