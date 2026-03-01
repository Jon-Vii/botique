from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Protocol
from uuid import uuid4

from seller_core.models import JSONValue

from .memory import ShopId
from .serialization import jsonify


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EventKind(StrEnum):
    DAY_STARTED = "day_started"
    BRIEFING_GENERATED = "briefing_generated"
    TURN_STARTED = "turn_started"
    MODEL_RESPONSE = "model_response"
    TOOL_CALLED = "tool_called"
    TOOL_RESULT = "tool_result"
    TOOL_FAILED = "tool_failed"
    WORKSPACE_ENTRY_ADDED = "workspace_entry_added"
    WORKSPACE_UPDATED = "workspace_updated"
    REMINDER_SET = "reminder_set"
    REMINDER_COMPLETED = "reminder_completed"
    DAY_ENDED = "day_ended"
    SIMULATION_ADVANCED = "simulation_advanced"


@dataclass(frozen=True, slots=True)
class RuntimeEvent:
    event_id: str
    run_id: str
    shop_id: ShopId
    day: int
    kind: EventKind
    turn_index: int | None = None
    timestamp: datetime = field(default_factory=_utcnow)
    payload: dict[str, JSONValue] = field(default_factory=dict)

    def to_payload(self) -> dict[str, object]:
        return {
            "event_id": self.event_id,
            "run_id": self.run_id,
            "shop_id": self.shop_id,
            "day": self.day,
            "kind": self.kind.value,
            "turn_index": self.turn_index,
            "timestamp": self.timestamp.isoformat(),
            "payload": self.payload,
        }


class EventLog(Protocol):
    def append(
        self,
        *,
        kind: EventKind,
        run_id: str,
        shop_id: ShopId,
        day: int,
        payload: dict[str, Any] | None = None,
        turn_index: int | None = None,
    ) -> RuntimeEvent: ...

    def list_events(
        self,
        *,
        run_id: str | None = None,
        shop_id: ShopId | None = None,
        day: int | None = None,
    ) -> list[RuntimeEvent]: ...


class InMemoryEventLog(EventLog):
    def __init__(self) -> None:
        self._events: list[RuntimeEvent] = []

    def append(
        self,
        *,
        kind: EventKind,
        run_id: str,
        shop_id: ShopId,
        day: int,
        payload: dict[str, Any] | None = None,
        turn_index: int | None = None,
    ) -> RuntimeEvent:
        normalized = jsonify(payload or {})
        if not isinstance(normalized, dict):
            normalized = {"value": normalized}
        event = RuntimeEvent(
            event_id=f"evt_{uuid4().hex[:12]}",
            run_id=run_id,
            shop_id=shop_id,
            day=day,
            kind=kind,
            turn_index=turn_index,
            payload=normalized,
        )
        self._events.append(event)
        return event

    def list_events(
        self,
        *,
        run_id: str | None = None,
        shop_id: ShopId | None = None,
        day: int | None = None,
    ) -> list[RuntimeEvent]:
        return [
            event
            for event in self._events
            if (run_id is None or event.run_id == run_id)
            and (shop_id is None or event.shop_id == shop_id)
            and (day is None or event.day == day)
        ]
