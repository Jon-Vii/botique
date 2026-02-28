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
from .tools.registry import AgentToolRegistry, ToolExecutionResult, ToolManifestEntry


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DayEndReason(StrEnum):
    AGENT_ENDED_DAY = "agent_ended_day"
    MAX_TURNS_REACHED = "max_turns_reached"


@dataclass(frozen=True, slots=True)
class DailyLoopConfig:
    max_turns: int = 6

    def __post_init__(self) -> None:
        if self.max_turns < 1:
            raise ValueError("max_turns must be at least 1.")


@dataclass(frozen=True, slots=True)
class ToolCall:
    name: str
    arguments: dict[str, object]


@dataclass(frozen=True, slots=True)
class AgentTurnDecision:
    summary: str
    tool_call: ToolCall | None = None
    end_day: bool = False

    def __post_init__(self) -> None:
        has_tool_call = self.tool_call is not None
        if has_tool_call == self.end_day:
            raise ValueError("Each turn must either call exactly one tool or end the day.")
        if not self.summary.strip():
            raise ValueError("summary must be non-empty.")


@dataclass(frozen=True, slots=True)
class TurnRecord:
    turn_index: int
    decision_summary: str
    started_at: datetime
    completed_at: datetime
    tool_call: ToolCall | None = None
    tool_result: ToolExecutionResult | None = None
    state_changes: dict[str, JSONValue] | None = None


@dataclass(frozen=True, slots=True)
class AgentTurnContext:
    run_id: str
    briefing: MorningBriefing
    turn_index: int
    max_turns: int
    remaining_turns: int
    available_tools: tuple[ToolManifestEntry, ...]
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
        available_tools = tuple(self.tool_registry.manifest())
        turns: list[TurnRecord] = []

        self.event_log.append(
            kind=EventKind.DAY_STARTED,
            run_id=active_run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "shop_name": briefing.shop_name,
                "max_turns": self.config.max_turns,
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
            self.event_log.append(
                kind=EventKind.TURN_STARTED,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={"remaining_turns": self.config.max_turns - turn_index + 1},
            )

            started_at = _utcnow()
            context = AgentTurnContext(
                run_id=active_run_id,
                briefing=briefing,
                turn_index=turn_index,
                max_turns=self.config.max_turns,
                remaining_turns=self.config.max_turns - turn_index + 1,
                available_tools=available_tools,
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
                    "action": "end_day" if decision.end_day else "tool_call",
                    "tool_name": None if decision.tool_call is None else decision.tool_call.name,
                },
            )

            if decision.end_day:
                return self._finish_day(
                    briefing=briefing,
                    run_id=active_run_id,
                    turns=turns,
                    end_reason=DayEndReason.AGENT_ENDED_DAY,
                )

            if decision.tool_call is None:
                raise ValueError("tool_call must be present when end_day is false.")

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

            turns.append(
                TurnRecord(
                    turn_index=turn_index,
                    decision_summary=decision.summary,
                    started_at=started_at,
                    completed_at=_utcnow(),
                    tool_call=decision.tool_call,
                    tool_result=tool_result,
                )
            )

        return self._finish_day(
            briefing=briefing,
            run_id=active_run_id,
            turns=turns,
            end_reason=DayEndReason.MAX_TURNS_REACHED,
        )

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
