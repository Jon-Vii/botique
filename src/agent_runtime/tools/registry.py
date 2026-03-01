from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Callable, Mapping

from seller_core.models import JSONValue


class ToolSurface(StrEnum):
    CORE = "core"
    EXTENSION = "extension"


class ToolBehavior(StrEnum):
    INSPECT = "inspect"
    ACT = "act"
    MEMORY = "memory"


@dataclass(frozen=True, slots=True)
class ToolManifestEntry:
    name: str
    description: str
    surface: ToolSurface
    behavior: ToolBehavior = ToolBehavior.INSPECT
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


class ToolArgumentValidationError(ValueError):
    """Raised when runtime tool arguments do not satisfy the declared schema."""


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
        if tool.manifest.parameters_schema is not None:
            _validate_schema(
                tool.manifest.parameters_schema,
                copied_arguments,
                path="arguments",
            )
        output = tool.handler(copied_arguments)
        return ToolExecutionResult(
            tool=tool.manifest,
            arguments=copied_arguments,
            output=output,
        )


def _validate_schema(
    schema: Mapping[str, JSONValue],
    value: Any,
    *,
    path: str,
) -> None:
    one_of = schema.get("oneOf")
    if isinstance(one_of, list):
        for option in one_of:
            if isinstance(option, Mapping):
                try:
                    _validate_schema(option, value, path=path)
                    return
                except ToolArgumentValidationError:
                    continue
        raise ToolArgumentValidationError(f"{path} does not match any allowed shape.")

    enum = schema.get("enum")
    if isinstance(enum, list) and value not in enum:
        raise ToolArgumentValidationError(
            f"{path} must be one of {', '.join(repr(item) for item in enum)}."
        )

    schema_type = schema.get("type")
    if schema_type == "object":
        if not isinstance(value, Mapping):
            raise ToolArgumentValidationError(f"{path} must be an object.")
        properties = schema.get("properties")
        property_schemas = properties if isinstance(properties, Mapping) else {}
        required = schema.get("required")
        if isinstance(required, list):
            for key in required:
                if isinstance(key, str) and key not in value:
                    raise ToolArgumentValidationError(f"{path}.{key} is required.")

        additional_properties = schema.get("additionalProperties", True)
        for key, item in value.items():
            if key in property_schemas:
                property_schema = property_schemas[key]
                if isinstance(property_schema, Mapping):
                    _validate_schema(property_schema, item, path=f"{path}.{key}")
                continue
            if additional_properties is False:
                raise ToolArgumentValidationError(
                    f"{path}.{key} is not allowed."
                )
            if isinstance(additional_properties, Mapping):
                _validate_schema(additional_properties, item, path=f"{path}.{key}")
        return

    if schema_type == "array":
        if not isinstance(value, list):
            raise ToolArgumentValidationError(f"{path} must be an array.")
        items = schema.get("items")
        if isinstance(items, Mapping):
            for index, item in enumerate(value):
                _validate_schema(items, item, path=f"{path}[{index}]")
        return

    if schema_type == "string":
        if not isinstance(value, str):
            raise ToolArgumentValidationError(f"{path} must be a string.")
        return

    if schema_type == "integer":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ToolArgumentValidationError(f"{path} must be an integer.")
        return

    if schema_type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ToolArgumentValidationError(f"{path} must be a number.")
        return

    if schema_type == "boolean":
        if not isinstance(value, bool):
            raise ToolArgumentValidationError(f"{path} must be a boolean.")
