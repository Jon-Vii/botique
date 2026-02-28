from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Mapping
from urllib import error, parse, request

from .models import BodyEncoding, RequestPlan, ResponseEnvelope


def _encode_scalar(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, tuple)):
        return ",".join(_encode_scalar(item) for item in value)
    return str(value)


def _encode_mapping(values: Mapping[str, Any]) -> dict[str, str]:
    return {
        key: _encode_scalar(value)
        for key, value in values.items()
        if value is not None
    }


@dataclass(frozen=True)
class HttpError(Exception):
    message: str
    status_code: int
    payload: Any = None

    def __str__(self) -> str:
        return self.message


class HttpTransport:
    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self.timeout_seconds = timeout_seconds

    def send(self, plan: RequestPlan) -> ResponseEnvelope:
        url = self._with_query(plan.url, plan.query)
        body_bytes: bytes | None = None
        headers = dict(plan.headers)

        if plan.body_encoding == BodyEncoding.FORM and isinstance(plan.body, Mapping):
            body_bytes = parse.urlencode(_encode_mapping(plan.body)).encode("utf-8")
            headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
        elif plan.body_encoding == BodyEncoding.JSON and plan.body is not None:
            body_bytes = json.dumps(plan.body).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")

        req = request.Request(url=url, method=plan.method, data=body_bytes, headers=headers)
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                raw_body = response.read()
                return ResponseEnvelope(
                    status_code=response.getcode(),
                    headers=dict(response.headers.items()),
                    data=self._decode_body(raw_body, response.headers.get("Content-Type")),
                )
        except error.HTTPError as exc:
            raw_body = exc.read()
            payload = self._decode_body(raw_body, exc.headers.get("Content-Type"))
            raise HttpError(
                message=f"HTTP {exc.code} calling {plan.tool_name}",
                status_code=exc.code,
                payload=payload,
            ) from exc

    @staticmethod
    def _with_query(url: str, query: Mapping[str, Any]) -> str:
        encoded = _encode_mapping(query)
        if not encoded:
            return url
        return f"{url}?{parse.urlencode(encoded)}"

    @staticmethod
    def _decode_body(raw_body: bytes, content_type: str | None) -> Any:
        if not raw_body:
            return None
        text = raw_body.decode("utf-8")
        if content_type and "json" in content_type.lower():
            return json.loads(text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text
