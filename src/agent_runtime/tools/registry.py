from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Callable, Mapping

from seller_core.models import JSONValue


class ToolSurface(StrEnum):
    CORE = "core"
    EXTENSION = "extension"


@dataclass(frozen=True, slots=True)
class ToolManifestEntry:
    name: str
    description: str
    surface: ToolSurface
    work_cost: int = 1
    operation_id: str | None = None
    path_params: tuple[str, ...] = ()
    query_params: tuple[str, ...] = ()
    required_body_fields: tuple[str, ...] = ()
    body_encoding: str = "none"
    scopes: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()
    parameters_schema: dict[str, JSONValue] | None = None

    def __post_init__(self) -> None:
        if self.work_cost < 1:
            raise ValueError("work_cost must be at least 1.")


@dataclass(frozen=True, slots=True)
class ToolExecutionResult:
    tool: ToolManifestEntry
    arguments: dict[str, Any]
    output: Any

    @property
    def tool_name(self) -> str:
        return self.tool.name


ToolHandler = Callable[[Mapping[str, Any]], Any]


@dataclass(slots=True)
class RegisteredTool:
    manifest: ToolManifestEntry
    handler: ToolHandler


class ToolNotFoundError(LookupError):
    """Raised when an agent asks for an unavailable tool."""


class AgentToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, RegisteredTool] = {}

    def register(self, manifest: ToolManifestEntry, handler: ToolHandler) -> None:
        self._tools[manifest.name] = RegisteredTool(manifest=manifest, handler=handler)

    def manifest(self) -> list[ToolManifestEntry]:
        return [tool.manifest for tool in self._tools.values()]

    def invoke(self, tool_name: str, arguments: Mapping[str, Any]) -> ToolExecutionResult:
        try:
            tool = self._tools[tool_name]
        except KeyError as exc:
            raise ToolNotFoundError(f"Unknown agent tool {tool_name!r}.") from exc

        copied_arguments = dict(arguments)
        output = tool.handler(copied_arguments)
        return ToolExecutionResult(
            tool=tool.manifest,
            arguments=copied_arguments,
            output=output,
        )
