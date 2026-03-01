from __future__ import annotations

from dataclasses import dataclass
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
    WORK_BUDGET_EXHAUSTED = "work_budget_exhausted"


@dataclass(frozen=True, slots=True)
class DailyLoopConfig:
    work_budget: int = 8

    def __post_init__(self) -> None:
        if self.work_budget < 1:
            raise ValueError("work_budget must be at least 1.")


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
    work_cost: int
    tool_call: ToolCall | None = None
    tool_result: ToolExecutionResult | None = None
    state_changes: dict[str, JSONValue] | None = None


@dataclass(frozen=True, slots=True)
class WorkSessionState:
    turn_index: int
    turns_completed: int
    work_budget: int
    work_budget_spent: int
    work_budget_remaining: int


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
    def work_budget(self) -> int:
        return self.session.work_budget

    @property
    def work_budget_spent(self) -> int:
        return self.session.work_budget_spent

    @property
    def work_budget_remaining(self) -> int:
        return self.session.work_budget_remaining


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
    work_budget: int
    work_budget_spent: int
    work_budget_remaining: int


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
        tool_costs = {tool.name: tool.work_cost for tool in tools}
        turns: list[TurnRecord] = []
        work_budget_spent = 0

        self.event_log.append(
            kind=EventKind.DAY_STARTED,
            run_id=active_run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "shop_name": briefing.shop_name,
                "work_budget": self.config.work_budget,
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
            work_budget_remaining = self.config.work_budget - work_budget_spent
            available_tools = tuple(
                tool for tool in tools if tool.work_cost <= work_budget_remaining
            )
            if not available_tools:
                return self._finish_day(
                    briefing=briefing,
                    run_id=active_run_id,
                    turns=turns,
                    end_reason=DayEndReason.WORK_BUDGET_EXHAUSTED,
                    work_budget_spent=work_budget_spent,
                )

            self.event_log.append(
                kind=EventKind.TURN_STARTED,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "work_budget_remaining": work_budget_remaining,
                    "work_budget_spent": work_budget_spent,
                    "available_tools": [
                        {
                            "name": tool.name,
                            "work_cost": tool.work_cost,
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
                    work_budget=self.config.work_budget,
                    work_budget_spent=work_budget_spent,
                    work_budget_remaining=work_budget_remaining,
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
                    "work_budget_remaining": work_budget_remaining,
                },
            )

            if decision.end_day:
                return self._finish_day(
                    briefing=briefing,
                    run_id=active_run_id,
                    turns=turns,
                    end_reason=DayEndReason.AGENT_ENDED_DAY,
                    work_budget_spent=work_budget_spent,
                )

            if decision.tool_call is None:
                raise ValueError("tool_call must be present when end_day is false.")

            tool_work_cost = tool_costs.get(decision.tool_call.name)
            if tool_work_cost is None:
                raise ValueError(f"Unknown agent tool {decision.tool_call.name!r}.")
            if tool_work_cost > work_budget_remaining:
                raise ValueError(
                    f"Tool {decision.tool_call.name!r} costs {tool_work_cost} work budget "
                    f"but only {work_budget_remaining} remains."
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
                    "work_cost": tool_work_cost,
                    "work_budget_remaining_before": work_budget_remaining,
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
                        "work_cost": tool_work_cost,
                    },
                )
                raise

            work_budget_spent += tool_work_cost
            self.event_log.append(
                kind=EventKind.TOOL_RESULT,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "tool_name": tool_result.tool_name,
                    "surface": tool_result.tool.surface.value,
                    "work_cost": tool_work_cost,
                    "work_budget_remaining_after": self.config.work_budget - work_budget_spent,
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
                    work_cost=tool_work_cost,
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
        work_budget_spent: int,
    ) -> DayRunResult:
        work_budget_remaining = self.config.work_budget - work_budget_spent
        self.event_log.append(
            kind=EventKind.DAY_ENDED,
            run_id=run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            payload={
                "end_reason": end_reason.value,
                "turn_count": len(turns),
                "work_budget": self.config.work_budget,
                "work_budget_spent": work_budget_spent,
                "work_budget_remaining": work_budget_remaining,
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
            work_budget=self.config.work_budget,
            work_budget_spent=work_budget_spent,
            work_budget_remaining=work_budget_remaining,
        )
