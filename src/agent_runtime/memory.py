from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Iterable, Protocol
from uuid import uuid4

from .serialization import jsonify


ShopId = int | str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ReminderStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"


@dataclass(frozen=True, slots=True)
class NoteRecord:
    note_id: str
    shop_id: ShopId
    title: str
    body: str
    tags: tuple[str, ...] = ()
    created_day: int | None = None
    created_at: datetime = field(default_factory=_utcnow)

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]


@dataclass(frozen=True, slots=True)
class ReminderRecord:
    reminder_id: str
    shop_id: ShopId
    content: str
    due_day: int
    status: ReminderStatus = ReminderStatus.PENDING
    note_id: str | None = None
    created_day: int | None = None
    created_at: datetime = field(default_factory=_utcnow)

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]


class NotesBackend(Protocol):
    def write_note(
        self,
        *,
        shop_id: ShopId,
        title: str,
        body: str,
        tags: Iterable[str] = (),
        day: int | None = None,
    ) -> NoteRecord: ...

    def read_notes(
        self,
        *,
        shop_id: ShopId,
        limit: int | None = None,
        tag: str | None = None,
    ) -> list[NoteRecord]: ...


class ReminderBackend(Protocol):
    def set_reminder(
        self,
        *,
        shop_id: ShopId,
        content: str,
        due_day: int,
        note_id: str | None = None,
        day: int | None = None,
    ) -> ReminderRecord: ...

    def get_due_reminders(
        self,
        *,
        shop_id: ShopId,
        current_day: int,
        include_overdue: bool = True,
    ) -> list[ReminderRecord]: ...


class AgentMemoryStore(NotesBackend, ReminderBackend, Protocol):
    """Simple inspectable memory surface for System 3."""


class InMemoryAgentMemory(AgentMemoryStore):
    def __init__(self) -> None:
        self._notes: dict[ShopId, list[NoteRecord]] = {}
        self._reminders: dict[ShopId, list[ReminderRecord]] = {}

    def write_note(
        self,
        *,
        shop_id: ShopId,
        title: str,
        body: str,
        tags: Iterable[str] = (),
        day: int | None = None,
    ) -> NoteRecord:
        note = NoteRecord(
            note_id=f"note_{uuid4().hex[:12]}",
            shop_id=shop_id,
            title=title,
            body=body,
            tags=tuple(tags),
            created_day=day,
        )
        self._notes.setdefault(shop_id, []).append(note)
        return note

    def read_notes(
        self,
        *,
        shop_id: ShopId,
        limit: int | None = None,
        tag: str | None = None,
    ) -> list[NoteRecord]:
        notes = list(reversed(self._notes.get(shop_id, [])))
        if tag is not None:
            notes = [note for note in notes if tag in note.tags]
        if limit is not None:
            notes = notes[:limit]
        return notes

    def set_reminder(
        self,
        *,
        shop_id: ShopId,
        content: str,
        due_day: int,
        note_id: str | None = None,
        day: int | None = None,
    ) -> ReminderRecord:
        reminder = ReminderRecord(
            reminder_id=f"rem_{uuid4().hex[:12]}",
            shop_id=shop_id,
            content=content,
            due_day=due_day,
            note_id=note_id,
            created_day=day,
        )
        self._reminders.setdefault(shop_id, []).append(reminder)
        return reminder

    def get_due_reminders(
        self,
        *,
        shop_id: ShopId,
        current_day: int,
        include_overdue: bool = True,
    ) -> list[ReminderRecord]:
        reminders = self._reminders.get(shop_id, [])
        results = [
            reminder
            for reminder in reminders
            if reminder.status == ReminderStatus.PENDING
            and (
                reminder.due_day == current_day
                or (include_overdue and reminder.due_day < current_day)
            )
        ]
        return sorted(results, key=lambda reminder: (reminder.due_day, reminder.created_at))
