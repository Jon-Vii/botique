from __future__ import annotations

from typing import Any, Mapping

from agent_runtime.memory import AgentMemoryStore

from .registry import AgentToolRegistry, ToolManifestEntry, ToolSurface


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


def register_memory_tools(
    registry: AgentToolRegistry,
    memory: AgentMemoryStore,
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
        ),
        lambda arguments, *, store=memory: {
            "note": store.write_note(
                shop_id=arguments["shop_id"],
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
        ),
        lambda arguments, *, store=memory: {
            "count": len(
                notes := store.read_notes(
                    shop_id=arguments["shop_id"],
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
        ),
        lambda arguments, *, store=memory: {
            "reminder": store.set_reminder(
                shop_id=arguments["shop_id"],
                content=_require_str(arguments, "content"),
                due_day=_require_day(arguments, "due_day"),
                note_id=arguments.get("note_id"),
                day=arguments.get("day"),
            ).to_payload()
        },
    )

    return registry
