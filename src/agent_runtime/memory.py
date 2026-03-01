from __future__ import annotations

from dataclasses import dataclass, field, replace
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
class WorkspaceEntryRecord:
    entry_id: str
    shop_id: ShopId
    content: str
    tags: tuple[str, ...] = ()
    created_day: int | None = None
    is_truncated: bool = False
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
    workspace_entry_id: str | None = None
    created_day: int | None = None
    created_at: datetime = field(default_factory=_utcnow)

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]


@dataclass(frozen=True, slots=True)
class WorkspaceRecord:
    shop_id: ShopId
    content: str
    revision: int
    updated_day: int | None = None
    is_truncated: bool = False
    updated_at: datetime = field(default_factory=_utcnow)

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]


class WorkspaceEntriesBackend(Protocol):
    def add_workspace_entry(
        self,
        *,
        shop_id: ShopId,
        content: str,
        tags: Iterable[str] = (),
        day: int | None = None,
    ) -> WorkspaceEntryRecord: ...

    def read_workspace_entries(
        self,
        *,
        shop_id: ShopId,
        limit: int | None = None,
        tag: str | None = None,
        since_day: int | None = None,
    ) -> list[WorkspaceEntryRecord]: ...

    def list_workspace_entries(
        self,
        *,
        shop_id: ShopId,
    ) -> list[WorkspaceEntryRecord]: ...


class ReminderBackend(Protocol):
    def set_reminder(
        self,
        *,
        shop_id: ShopId,
        content: str,
        due_day: int,
        workspace_entry_id: str | None = None,
        day: int | None = None,
    ) -> ReminderRecord: ...

    def get_due_reminders(
        self,
        *,
        shop_id: ShopId,
        current_day: int,
        include_overdue: bool = True,
    ) -> list[ReminderRecord]: ...

    def complete_reminder(
        self,
        *,
        shop_id: ShopId,
        reminder_id: str,
    ) -> ReminderRecord: ...

    def list_reminders(
        self,
        *,
        shop_id: ShopId,
        status: ReminderStatus | None = None,
    ) -> list[ReminderRecord]: ...


class WorkspaceBackend(Protocol):
    def read_workspace(
        self,
        *,
        shop_id: ShopId,
    ) -> WorkspaceRecord | None: ...

    def update_workspace(
        self,
        *,
        shop_id: ShopId,
        content: str,
        day: int | None = None,
    ) -> WorkspaceRecord: ...

    def list_workspace_revisions(
        self,
        *,
        shop_id: ShopId,
    ) -> list[WorkspaceRecord]: ...


class AgentMemoryStore(
    WorkspaceEntriesBackend, ReminderBackend, WorkspaceBackend, Protocol
):
    """Simple inspectable memory surface for System 3."""


class InMemoryAgentMemory(AgentMemoryStore):
    def __init__(self) -> None:
        self._workspace_entries: dict[ShopId, list[WorkspaceEntryRecord]] = {}
        self._reminders: dict[ShopId, list[ReminderRecord]] = {}
        self._workspaces: dict[ShopId, WorkspaceRecord] = {}
        self._workspace_revisions: dict[ShopId, list[WorkspaceRecord]] = {}

    def add_workspace_entry(
        self,
        *,
        shop_id: ShopId,
        content: str,
        tags: Iterable[str] = (),
        day: int | None = None,
    ) -> WorkspaceEntryRecord:
        entry = WorkspaceEntryRecord(
            entry_id=f"ws_entry_{uuid4().hex[:12]}",
            shop_id=shop_id,
            content=content,
            tags=tuple(tags),
            created_day=day,
        )
        self._workspace_entries.setdefault(shop_id, []).append(entry)
        return entry

    def read_workspace_entries(
        self,
        *,
        shop_id: ShopId,
        limit: int | None = None,
        tag: str | None = None,
        since_day: int | None = None,
    ) -> list[WorkspaceEntryRecord]:
        entries = list(reversed(self._workspace_entries.get(shop_id, [])))
        if tag is not None:
            entries = [entry for entry in entries if tag in entry.tags]
        if since_day is not None:
            entries = [
                entry
                for entry in entries
                if entry.created_day is not None and entry.created_day >= since_day
            ]
        if limit is not None:
            entries = entries[:limit]
        return entries

    def list_workspace_entries(
        self,
        *,
        shop_id: ShopId,
    ) -> list[WorkspaceEntryRecord]:
        return list(self._workspace_entries.get(shop_id, ()))

    def set_reminder(
        self,
        *,
        shop_id: ShopId,
        content: str,
        due_day: int,
        workspace_entry_id: str | None = None,
        day: int | None = None,
    ) -> ReminderRecord:
        reminder = ReminderRecord(
            reminder_id=f"rem_{uuid4().hex[:12]}",
            shop_id=shop_id,
            content=content,
            due_day=due_day,
            workspace_entry_id=workspace_entry_id,
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

    def complete_reminder(
        self,
        *,
        shop_id: ShopId,
        reminder_id: str,
    ) -> ReminderRecord:
        reminders = self._reminders.get(shop_id, [])
        for index, reminder in enumerate(reminders):
            if reminder.reminder_id != reminder_id:
                continue

            completed = replace(reminder, status=ReminderStatus.COMPLETED)
            reminders[index] = completed
            return completed

        raise LookupError(f"Reminder {reminder_id!r} was not found for shop {shop_id!r}.")

    def list_reminders(
        self,
        *,
        shop_id: ShopId,
        status: ReminderStatus | None = None,
    ) -> list[ReminderRecord]:
        reminders = list(self._reminders.get(shop_id, ()))
        if status is None:
            return reminders
        return [reminder for reminder in reminders if reminder.status == status]

    def read_workspace(
        self,
        *,
        shop_id: ShopId,
    ) -> WorkspaceRecord | None:
        return self._workspaces.get(shop_id)

    def update_workspace(
        self,
        *,
        shop_id: ShopId,
        content: str,
        day: int | None = None,
    ) -> WorkspaceRecord:
        previous = self._workspaces.get(shop_id)
        revision = 1 if previous is None else previous.revision + 1
        workspace = WorkspaceRecord(
            shop_id=shop_id,
            content=content,
            revision=revision,
            updated_day=day,
        )
        self._workspaces[shop_id] = workspace
        self._workspace_revisions.setdefault(shop_id, []).append(workspace)
        return workspace

    def list_workspace_revisions(
        self,
        *,
        shop_id: ShopId,
    ) -> list[WorkspaceRecord]:
        return list(self._workspace_revisions.get(shop_id, ()))
