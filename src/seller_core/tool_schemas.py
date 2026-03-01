from __future__ import annotations

from typing import Iterable

from .models import JSONValue


def integer_schema(
    *,
    description: str,
    minimum: int | None = None,
    maximum: int | None = None,
) -> dict[str, JSONValue]:
    schema: dict[str, JSONValue] = {
        "type": "integer",
        "description": description,
    }
    if minimum is not None:
        schema["minimum"] = minimum
    if maximum is not None:
        schema["maximum"] = maximum
    return schema


def number_schema(
    *,
    description: str,
    minimum: float | int | None = None,
) -> dict[str, JSONValue]:
    schema: dict[str, JSONValue] = {
        "type": "number",
        "description": description,
    }
    if minimum is not None:
        schema["minimum"] = minimum
    return schema


def string_schema(
    *,
    description: str,
    enum: Iterable[str] | None = None,
    min_length: int | None = None,
) -> dict[str, JSONValue]:
    schema: dict[str, JSONValue] = {
        "type": "string",
        "description": description,
    }
    if enum is not None:
        schema["enum"] = list(enum)
    if min_length is not None:
        schema["minLength"] = min_length
    return schema


def boolean_schema(*, description: str) -> dict[str, JSONValue]:
    return {
        "type": "boolean",
        "description": description,
    }


def array_schema(
    *,
    description: str,
    items: dict[str, JSONValue],
) -> dict[str, JSONValue]:
    return {
        "type": "array",
        "description": description,
        "items": items,
    }


def object_schema(
    *,
    description: str | None = None,
    properties: dict[str, JSONValue],
    required: Iterable[str] = (),
    additional_properties: bool = False,
) -> dict[str, JSONValue]:
    schema: dict[str, JSONValue] = {
        "type": "object",
        "properties": properties,
        "required": list(required),
        "additionalProperties": additional_properties,
    }
    if description is not None:
        schema["description"] = description
    return schema
