from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Mapping


JSONValue = (
    None
    | bool
    | int
    | float
    | str
    | list["JSONValue"]
    | dict[str, "JSONValue"]
)


class BodyEncoding(StrEnum):
    NONE = "none"
    FORM = "form"
    JSON = "json"


@dataclass(frozen=True)
class EndpointSpec:
    tool_name: str
    operation_id: str
    method: str
    path_template: str
    description: str
    scopes: tuple[str, ...] = ()
    path_params: tuple[str, ...] = ()
    query_params: tuple[str, ...] = ()
    body_encoding: BodyEncoding = BodyEncoding.NONE
    required_body_fields: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


@dataclass(frozen=True)
class RequestPlan:
    tool_name: str
    operation_id: str
    method: str
    url: str
    headers: dict[str, str]
    query: dict[str, Any] = field(default_factory=dict)
    body: Any = None
    body_encoding: BodyEncoding = BodyEncoding.NONE


@dataclass(frozen=True)
class ResponseEnvelope:
    status_code: int
    headers: Mapping[str, str]
    data: Any


@dataclass(frozen=True)
class ClientConfig:
    base_url: str
    api_key: str | None = None
    bearer_token: str | None = None
    timeout_seconds: float = 30.0
    extra_headers: Mapping[str, str] = field(default_factory=dict)
