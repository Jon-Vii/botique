from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Sequence

from seller_core.models import JSONValue

from .base import (
    ProviderError,
    ProviderMessage,
    ProviderResponse,
    ProviderToolCall,
    ProviderToolDefinition,
    ToolCallingProvider,
)


@dataclass(frozen=True, slots=True)
class MistralProviderConfig:
    api_key: str
    model: str = "mistral-medium-latest"
    temperature: float = 0.1
    top_p: float = 0.9

    @classmethod
    def from_env(
        cls,
        *,
        api_key: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
    ) -> "MistralProviderConfig":
        resolved_api_key = api_key or os.getenv("MISTRAL_API_KEY")
        if not resolved_api_key:
            raise ValueError("MISTRAL_API_KEY is required for the Mistral provider.")
        return cls(
            api_key=resolved_api_key,
            model=model or os.getenv("BOTIQUE_MISTRAL_MODEL") or "mistral-medium-latest",
            temperature=float(
                temperature
                if temperature is not None
                else os.getenv("BOTIQUE_MISTRAL_TEMPERATURE", 0.1)
            ),
            top_p=float(
                top_p
                if top_p is not None
                else os.getenv("BOTIQUE_MISTRAL_TOP_P", 0.9)
            ),
        )


class MistralToolCallingProvider(ToolCallingProvider):
    def __init__(
        self,
        config: MistralProviderConfig,
        *,
        client: Any | None = None,
        client_factory: Callable[[str], Any] | None = None,
    ) -> None:
        self.config = config
        self._client = client
        self._client_factory = client_factory

    def complete(
        self,
        *,
        messages: Sequence[ProviderMessage],
        tools: Sequence[ProviderToolDefinition],
        tool_choice: str = "auto",
        allow_parallel_tool_calls: bool = False,
    ) -> ProviderResponse:
        response = self._sdk_client().chat.complete(
            model=self.config.model,
            messages=[_message_to_payload(message) for message in messages],
            tools=[_tool_to_payload(tool) for tool in tools],
            tool_choice=tool_choice,
            parallel_tool_calls=allow_parallel_tool_calls,
            temperature=self.config.temperature,
            top_p=self.config.top_p,
        )

        choices = _lookup(response, "choices")
        if not choices:
            raise ProviderError("Mistral returned no choices.")

        message = _lookup(choices[0], "message")
        if message is None:
            raise ProviderError("Mistral response choice did not contain a message.")

        return ProviderResponse(
            content=_normalize_content(_lookup(message, "content")),
            tool_calls=tuple(_parse_tool_call(tool_call) for tool_call in (_lookup(message, "tool_calls") or [])),
            raw_response=response,
        )

    def _sdk_client(self) -> Any:
        if self._client is None:
            factory = self._client_factory or _default_client_factory
            self._client = factory(self.config.api_key)
        return self._client


def _default_client_factory(api_key: str) -> Any:
    try:
        from mistralai import Mistral
    except ImportError as exc:
        raise RuntimeError(
            "The Mistral provider requires the optional `mistralai` package."
        ) from exc
    return Mistral(api_key=api_key)


def _message_to_payload(message: ProviderMessage) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "role": message.role.value,
        "content": message.content,
    }
    if message.name:
        payload["name"] = message.name
    if message.tool_call_id:
        payload["tool_call_id"] = message.tool_call_id
    if message.tool_calls:
        payload["tool_calls"] = [
            {
                "id": tc.call_id or f"call_{id(tc)}",
                "type": "function",
                "function": {
                    "name": tc.name,
                    "arguments": json.dumps(tc.arguments),
                },
            }
            for tc in message.tool_calls
        ]
    return payload


def _tool_to_payload(tool: ProviderToolDefinition) -> dict[str, object]:
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters_schema,
        },
    }


def _parse_tool_call(tool_call: Any) -> ProviderToolCall:
    function = _lookup(tool_call, "function")
    if function is None:
        raise ProviderError("Mistral tool call did not include function details.")

    arguments = _lookup(function, "arguments")
    parsed_arguments = _parse_arguments(arguments)
    return ProviderToolCall(
        name=str(_lookup(function, "name")),
        arguments=parsed_arguments,
        call_id=_lookup(tool_call, "id"),
    )


def _parse_arguments(value: Any) -> dict[str, JSONValue]:
    if isinstance(value, Mapping):
        return {str(key): value[key] for key in value}
    if isinstance(value, str):
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            raise ProviderError("Mistral tool arguments must decode to a JSON object.")
        return parsed
    raise ProviderError("Mistral tool arguments were not a JSON object.")


def _normalize_content(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(_normalize_content(item) for item in value).strip()
    if isinstance(value, Mapping):
        text = _lookup(value, "text")
        if isinstance(text, str):
            return text
        return json.dumps(value, sort_keys=True)
    return str(value)


def _lookup(value: Any, key: str) -> Any:
    if isinstance(value, Mapping):
        return value.get(key)
    return getattr(value, key, None)
