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
            name="write_note",
            description="Persist a short inspectable strategy note for the current shop.",
            surface=ToolSurface.EXTENSION,
            required_body_fields=("shop_id", "title", "body"),
            body_encoding="json",
            notes=(
                "This is a simple Botique extension memory tool, not a hidden retrieval system.",
            ),
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "title": {
                        "type": "string",
                        "description": "Short note title.",
                    },
                    "body": {
                        "type": "string",
                        "description": "Inspectable strategy note content.",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional note tags.",
                    },
                    "day": {
                        "type": "integer",
                        "description": "Current simulation day.",
                    },
                },
                required=["shop_id", "title", "body"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "note": store.write_note(
                shop_id=_bound_shop_id(arguments, shop_id),
                title=_require_str(arguments, "title"),
                body=_require_str(arguments, "body"),
                tags=tuple(arguments.get("tags", ())),
                day=arguments.get("day"),
            ).to_payload()
        },
    )

    registry.register(
        ToolManifestEntry(
            name="read_notes",
            description="Read recent notes for the current shop.",
            surface=ToolSurface.EXTENSION,
            required_body_fields=("shop_id",),
            body_encoding="json",
            parameters_schema=_memory_parameters_schema(
                properties={
                    "shop_id": SHOP_ID_SCHEMA,
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of notes to return.",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Optional tag filter.",
                    },
                },
                required=["shop_id"],
                shop_id=shop_id,
            ),
        ),
        lambda arguments, *, store=memory: {
            "count": len(
                notes := store.read_notes(
                    shop_id=_bound_shop_id(arguments, shop_id),
                    limit=arguments.get("limit"),
                    tag=arguments.get("tag"),
                )
            ),
            "notes": [note.to_payload() for note in notes],
        },
    )

    registry.register(
        ToolManifestEntry(
            name="set_reminder",
            description="Create a simple reminder tied to a future simulation day.",
            surface=ToolSurface.EXTENSION,
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
                    "note_id": {
                        "type": "string",
                        "description": "Optional related note id.",
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
                note_id=arguments.get("note_id"),
                day=arguments.get("day"),
            ).to_payload()
        },
    )

    registry.register(
        ToolManifestEntry(
            name="complete_reminder",
            description="Mark a reminder as completed so it stops appearing in future briefings.",
            surface=ToolSurface.EXTENSION,
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
