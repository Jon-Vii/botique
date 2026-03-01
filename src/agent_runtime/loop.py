from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from typing import Protocol
from uuid import uuid4

from seller_core.models import JSONValue

from .briefing import MorningBriefing
from .events import EventKind, EventLog, InMemoryEventLog, RuntimeEvent
from .memory import ShopId, WorkspaceEntryRecord
from .serialization import jsonify
from .tools.registry import AgentToolRegistry, ToolExecutionResult, ToolManifestEntry


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DayEndReason(StrEnum):
    AGENT_ENDED_DAY = "agent_ended_day"
    TURNS_EXHAUSTED = "turns_exhausted"
    WORK_BUDGET_EXHAUSTED = "turns_exhausted"


@dataclass(frozen=True, slots=True)
class DailyLoopConfig:
    turns_per_day: int = 5

    def __post_init__(self) -> None:
        if self.turns_per_day < 1:
            raise ValueError("turns_per_day must be at least 1.")


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
    turn_cost: int = 1
    tool_call: ToolCall | None = None
    tool_result: ToolExecutionResult | None = None
    state_changes: dict[str, JSONValue] | None = None

    @property
    def work_cost(self) -> int:
        return self.turn_cost


@dataclass(frozen=True, slots=True)
class WorkSessionState:
    turn_index: int
    turns_completed: int
    turns_per_day: int
    turns_used: int
    turns_remaining: int


@dataclass(frozen=True, slots=True)
class AgentTurnContext:
    run_id: str
    briefing: MorningBriefing
    session: WorkSessionState
    available_tools: tuple[ToolManifestEntry, ...]
    prior_turns: tuple[TurnRecord, ...] = ()

    @property
    def turn_index(self) -> int:
        return self.session.turn_index

    @property
    def turns_per_day(self) -> int:
        return self.session.turns_per_day

    @property
    def turns_used(self) -> int:
        return self.session.turns_used

    @property
    def turns_remaining(self) -> int:
        return self.session.turns_remaining

    @property
    def work_budget(self) -> int:
        return self.turns_per_day

    @property
    def work_budget_spent(self) -> int:
        return self.turns_used

    @property
    def work_budget_remaining(self) -> int:
        return self.turns_remaining


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
    turns_per_day: int
    turns_used: int
    turns_remaining: int
    day_workspace_entry: WorkspaceEntryRecord | None = None

    @property
    def work_budget(self) -> int:
        return self.turns_per_day

    @property
    def work_budget_spent(self) -> int:
        return self.turns_used

    @property
    def work_budget_remaining(self) -> int:
        return self.turns_remaining


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
        tools = tuple(self.tool_registry.manifest())
        turns: list[TurnRecord] = []

        self.event_log.append(
            kind=EventKind.DAY_STARTED,
            run_id=active_run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "shop_name": briefing.shop_name,
                "turns_per_day": self.config.turns_per_day,
            },
        )
        self.event_log.append(
            kind=EventKind.BRIEFING_GENERATED,
            run_id=active_run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={"briefing": briefing.to_payload()},
        )

        turn_index = 1
        while True:
            turns_used = len(turns)
            turns_remaining = self.config.turns_per_day - turns_used
            if turns_remaining <= 0:
                return self._finish_day(
                    briefing=briefing,
                    run_id=active_run_id,
                    turns=turns,
                    end_reason=DayEndReason.TURNS_EXHAUSTED,
                )
            available_tools = tools

            self.event_log.append(
                kind=EventKind.TURN_STARTED,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "turns_remaining": turns_remaining,
                    "turns_used": turns_used,
                    "available_tools": [
                        {
                            "name": tool.name,
                        }
                        for tool in available_tools
                    ],
                },
            )

            started_at = _utcnow()
            context = AgentTurnContext(
                run_id=active_run_id,
                briefing=briefing,
                session=WorkSessionState(
                    turn_index=turn_index,
                    turns_completed=len(turns),
                    turns_per_day=self.config.turns_per_day,
                    turns_used=turns_used,
                    turns_remaining=turns_remaining,
                ),
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
                    "turns_remaining": turns_remaining,
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
                    "turns_remaining_before": turns_remaining,
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
                    "turns_remaining_after": self.config.turns_per_day - (len(turns) + 1),
                    "result": jsonify(tool_result.output),
                },
            )

            if tool_result.tool_name == "add_journal_entry":
                self.event_log.append(
                    kind=EventKind.WORKSPACE_ENTRY_ADDED,
                    run_id=active_run_id,
                    shop_id=briefing.shop_id,
                    day=briefing.day,
                    turn_index=turn_index,
                    payload={"result": jsonify(tool_result.output)},
                )
            elif tool_result.tool_name == "update_scratchpad":
                self.event_log.append(
                    kind=EventKind.WORKSPACE_UPDATED,
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
                    turn_cost=1,
                    tool_call=decision.tool_call,
                    tool_result=tool_result,
                )
            )
            turn_index += 1

    def _finish_day(
        self,
        *,
        briefing: MorningBriefing,
        run_id: str,
        turns: list[TurnRecord],
        end_reason: DayEndReason,
    ) -> DayRunResult:
        turns_used = len(turns)
        turns_remaining = self.config.turns_per_day - turns_used
        self.event_log.append(
            kind=EventKind.DAY_ENDED,
            run_id=run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "end_reason": end_reason.value,
                "turn_count": len(turns),
                "turns_per_day": self.config.turns_per_day,
                "turns_used": turns_used,
                "turns_remaining": turns_remaining,
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
            turns_per_day=self.config.turns_per_day,
            turns_used=turns_used,
            turns_remaining=turns_remaining,
        )
