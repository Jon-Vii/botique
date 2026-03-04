from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from typing import Protocol
from uuid import uuid4

from seller_core.models import JSONValue

from .briefing import MorningBriefing
from .events import EventKind, EventLog, InMemoryEventLog, RuntimeEvent
from .memory import ShopId, WorkspaceRecord
from .serialization import jsonify
from .tools.registry import AgentToolRegistry, ToolExecutionResult, ToolManifestEntry


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DayEndReason(StrEnum):
    TURNS_EXHAUSTED = "turns_exhausted"
    ERROR = "error"


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
    call_id: str | None = None


@dataclass(frozen=True, slots=True)
class AgentTurnDecision:
    summary: str
    tool_call: ToolCall
    model_content: str = ""

    def __post_init__(self) -> None:
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
    model_content: str = ""

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
    day_scratchpad: WorkspaceRecord | None = None

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
            turns_used = sum(t.turn_cost for t in turns)
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
            try:
                decision = policy.next_turn(context)
            except Exception as llm_exc:
                # Retry once with backoff for transient errors (e.g. 429 rate limit)
                is_transient = _is_transient_error(llm_exc)
                self._log_policy_error(llm_exc, active_run_id, briefing, turn_index, retrying=is_transient)
                if is_transient:
                    time.sleep(5)
                    try:
                        decision = policy.next_turn(context)
                    except Exception as retry_exc:
                        self._log_policy_error(retry_exc, active_run_id, briefing, turn_index, retrying=False)
                        return self._finish_day(briefing=briefing, run_id=active_run_id, turns=turns, end_reason=DayEndReason.ERROR)
                else:
                    return self._finish_day(briefing=briefing, run_id=active_run_id, turns=turns, end_reason=DayEndReason.ERROR)

            self.event_log.append(
                kind=EventKind.MODEL_RESPONSE,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "summary": decision.summary,
                    "action": "tool_call",
                    "tool_name": decision.tool_call.name,
                    "turns_remaining": turns_remaining,
                },
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
                # Feed the error back to the model so it can recover
                # instead of crashing the entire run.
                tool_entry = self.tool_registry.get_manifest(decision.tool_call.name)
                tool_result = ToolExecutionResult(
                    tool=tool_entry,
                    arguments=decision.tool_call.arguments
                    if isinstance(decision.tool_call.arguments, dict)
                    else {},
                    output={
                        "error": True,
                        "error_type": exc.__class__.__name__,
                        "message": str(exc),
                    },
                )

            self.event_log.append(
                kind=EventKind.TOOL_RESULT,
                run_id=active_run_id,
                shop_id=briefing.shop_id,
                day=briefing.day,
                turn_index=turn_index,
                payload={
                    "tool_name": tool_result.tool_name,
                    "surface": tool_result.tool.surface.value,
                    "turns_remaining_after": self.config.turns_per_day - (turns_used + (tool_result.tool.work_cost if tool_result else 1)),
                    "result": jsonify(tool_result.output),
                },
            )

            turns.append(
                TurnRecord(
                    turn_index=turn_index,
                    decision_summary=decision.summary,
                    started_at=started_at,
                    completed_at=_utcnow(),
                    turn_cost=tool_result.tool.work_cost if tool_result else 1,
                    tool_call=decision.tool_call,
                    tool_result=tool_result,
                    model_content=decision.model_content,
                )
            )
            turn_index += 1

    def _log_policy_error(
        self,
        exc: Exception,
        run_id: str,
        briefing: MorningBriefing,
        turn_index: int,
        *,
        retrying: bool,
    ) -> None:
        self.event_log.append(
            kind=EventKind.TOOL_FAILED,
            run_id=run_id,
            shop_id=briefing.shop_id,
            day=briefing.day,
            turn_index=turn_index,
            payload={
                "tool_name": "policy.next_turn",
                "error_type": exc.__class__.__name__,
                "message": str(exc),
                "retrying": retrying,
            },
        )

    def _finish_day(
        self,
        *,
        briefing: MorningBriefing,
        run_id: str,
        turns: list[TurnRecord],
        end_reason: DayEndReason,
    ) -> DayRunResult:
        turns_used = sum(t.turn_cost for t in turns)
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


def _is_transient_error(exc: Exception) -> bool:
    """Return True for errors that are likely transient (timeouts, rate limits, 5xx)."""
    msg = str(exc).lower()
    transient_signals = ("timeout", "429", "rate limit", "502", "503", "504", "connection")
    return any(signal in msg for signal in transient_signals)
