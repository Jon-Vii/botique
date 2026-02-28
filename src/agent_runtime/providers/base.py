from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol, Sequence

from seller_core.models import JSONValue


class ProviderMessageRole(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass(frozen=True, slots=True)
class ProviderMessage:
    role: ProviderMessageRole
    content: str
    name: str | None = None
    tool_call_id: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderToolDefinition:
    name: str
    description: str
    parameters_schema: dict[str, JSONValue]


@dataclass(frozen=True, slots=True)
class ProviderToolCall:
    name: str
    arguments: dict[str, JSONValue]
    call_id: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderResponse:
    content: str
    tool_calls: tuple[ProviderToolCall, ...] = ()
    raw_response: Any = None


class ToolCallingProvider(Protocol):
    def complete(
        self,
        *,
        messages: Sequence[ProviderMessage],
        tools: Sequence[ProviderToolDefinition],
        tool_choice: str = "auto",
        allow_parallel_tool_calls: bool = False,
    ) -> ProviderResponse: ...


class ProviderError(RuntimeError):
    """Raised when a model provider returns an unusable response."""


def dump_json(value: JSONValue) -> str:
    return json.dumps(value, indent=2, sort_keys=True)
