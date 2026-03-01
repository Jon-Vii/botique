from __future__ import annotations

from typing import Any, Mapping

from agent_runtime.memory import AgentMemoryStore

from .registry import AgentToolRegistry, ToolManifestEntry, ToolSurface


SHOP_ID_SCHEMA = {
    "oneOf": [
        {"type": "integer"},
        {"type": "string"},
    ],
    "description": "Botique shop identifier.",
}


def _require_str(arguments: Mapping[str, Any], key: str) -> str:
    value = arguments.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string.")
    return value


def _require_text(arguments: Mapping[str, Any], key: str) -> str:
    value = arguments.get(key)
    if not isinstance(value, str):
        raise ValueError(f"{key} must be a string.")
    return value


def _require_day(arguments: Mapping[str, Any], key: str) -> int:
    value = arguments.get(key)
    if not isinstance(value, int):
        raise ValueError(f"{key} must be an integer simulation day.")
    return value


def _bound_shop_id(arguments: Mapping[str, Any], shop_id: int | str | None) -> int | str:
    if shop_id is None:
        value = arguments.get("shop_id")
        if value is None:
            raise ValueError("shop_id is required.")
        return value

    requested = arguments.get("shop_id")
    if requested is not None and requested != shop_id:
        raise ValueError(f"shop_id is bound to {shop_id!r} for this agent.")
    return shop_id


def _memory_parameters_schema(
    *,
    properties: dict[str, object],
    required: list[str],
    shop_id: int | str | None,
) -> dict[str, object]:
    visible_properties = dict(properties)
    visible_required = list(required)
    if shop_id is not None:
        visible_properties.pop("shop_id", None)
        visible_required = [field for field in visible_required if field != "shop_id"]

    return {
        "type": "object",
        "properties": visible_properties,
        "required": visible_required,
        "additionalProperties": False,
    }


def register_memory_tools(
    registry: AgentToolRegistry,
    memory: AgentMemoryStore,
    *,
    shop_id: int | str | None = None,
) -> AgentToolRegistry:
    registry.register(
        ToolManifestEntry(
            name="read_scratchpad",
            description="Read the current persistent scratchpad text for the shop. This is the main mutable cross-day working context you can carry across days.",
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("shop_id",),
            body_encoding="json",
            notes=(
                "The scratchpad is freeform model-authored text, not a required template.",
            ),
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                },
                required=["shop_id"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "scratchpad": (
                None
                if (
                    workspace := store.read_workspace(
                        shop_id=_bound_shop_id(arguments, shop_id)
                    )
                )
                is None
                else workspace.to_payload()
            ),
            "revision_count": len(
                store.list_workspace_revisions(
                    shop_id=_bound_shop_id(arguments, shop_id)
                )
            ),
        },
    )

    registry.register(
        ToolManifestEntry(
            name="update_scratchpad",
            description="Replace the current persistent scratchpad text for the shop. Use this as a freeform mutable cross-day working context for plans, hypotheses, experiments, or anything else useful across days.",
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("shop_id", "content"),
            body_encoding="json",
            notes=(
                "This replaces the full scratchpad text. Use an empty string if you want to clear it.",
            ),
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "content": {
                        "type": "string",
                        "description": "New full scratchpad text. This may be empty if you want to clear it.",
                    },
                    "day": {
                        "type": "integer",
                        "description": "Current simulation day.",
                    },
                },
                required=["shop_id", "content"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "scratchpad": store.update_workspace(
                shop_id=_bound_shop_id(arguments, shop_id),
                content=_require_text(arguments, "content"),
                day=arguments.get("day"),
            ).to_payload()
        },
    )

    registry.register(
        ToolManifestEntry(
            name="add_journal_entry",
            description="Append a new journal entry for the shop. Use this for durable append-only notes about things you want to remember later.",
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("shop_id", "content"),
            body_encoding="json",
            notes=(
                "Journal entries are append-only and stay inspectable in artifacts.",
            ),
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "content": {
                        "type": "string",
                        "description": "Journal entry text.",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional tags for later filtering.",
                    },
                    "day": {
                        "type": "integer",
                        "description": "Current simulation day.",
                    },
                },
                required=["shop_id", "content"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "journal_entry": store.add_workspace_entry(
                shop_id=_bound_shop_id(arguments, shop_id),
                content=_require_text(arguments, "content"),
                tags=tuple(arguments.get("tags", ())),
                day=arguments.get("day"),
            ).to_payload()
        },
    )

    registry.register(
        ToolManifestEntry(
            name="read_journal_entries",
            description="Read a bounded set of recent journal entries for the current shop. Use this when you want targeted recall from your journal/history.",
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("shop_id",),
            body_encoding="json",
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of entries to return.",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Optional tag filter.",
                    },
                    "since_day": {
                        "type": "integer",
                        "description": "Optional lower bound on created simulation day.",
                    },
                },
                required=["shop_id"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "count": len(
                entries := store.read_workspace_entries(
                    shop_id=_bound_shop_id(arguments, shop_id),
                    limit=arguments.get("limit", 5),
                    tag=arguments.get("tag"),
                    since_day=arguments.get("since_day"),
                )
            ),
            "journal_entries": [entry.to_payload() for entry in entries],
        },
    )

    registry.register(
        ToolManifestEntry(
            name="set_reminder",
            description="Create a simple reminder tied to a future simulation day.",
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("shop_id", "content", "due_day"),
            body_encoding="json",
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "content": {
                        "type": "string",
                        "description": "Reminder text visible in future briefings.",
                    },
                    "due_day": {
                        "type": "integer",
                        "description": "Simulation day when the reminder becomes due.",
                    },
                    "workspace_entry_id": {
                        "type": "string",
                        "description": "Optional related journal entry id.",
                    },
                    "day": {
                        "type": "integer",
                        "description": "Current simulation day.",
                    },
                },
                required=["shop_id", "content", "due_day"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "reminder": store.set_reminder(
                shop_id=_bound_shop_id(arguments, shop_id),
                content=_require_str(arguments, "content"),
                due_day=_require_day(arguments, "due_day"),
                workspace_entry_id=arguments.get("workspace_entry_id"),
                day=arguments.get("day"),
            ).to_payload()
        },
    )

    registry.register(
        ToolManifestEntry(
            name="complete_reminder",
            description="Mark a reminder as completed so it stops appearing in future briefings.",
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("shop_id", "reminder_id"),
            body_encoding="json",
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "reminder_id": {
                        "type": "string",
                        "description": "Reminder identifier returned by set_reminder or a briefing.",
                    },
                },
                required=["shop_id", "reminder_id"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "reminder": store.complete_reminder(
                shop_id=_bound_shop_id(arguments, shop_id),
                reminder_id=_require_str(arguments, "reminder_id"),
            ).to_payload()
        },
    )

    return registry
