from __future__ import annotations

import json
from dataclasses import dataclass

from seller_core.models import JSONValue

from agent_runtime.loop import (
    AgentTurnContext,
    AgentTurnDecision,
    DailyAgentPolicy,
    ToolCall,
    TurnRecord,
)
from agent_runtime.serialization import jsonify
from agent_runtime.tools.registry import ToolManifestEntry

from .base import (
    ProviderError,
    ProviderMessage,
    ProviderMessageRole,
    ProviderToolCall,
    ProviderToolDefinition,
    ToolCallingProvider,
)


NO_ACTION_TOOL_NAME = "no_action"
DEFAULT_SYSTEM_PROMPT = (
    "You are the owner-agent for a single Botique shop. "
    "Use a small amount of evidence gathering to support one concrete business move per day. "
    "Repeated marketplace searching without deciding what to change is low value. "
    "Choose exactly one action for this turn: call one allowed seller-facing tool, or "
    "call `no_action` only when the runtime explicitly asks you to justify making no "
    "business change today. "
    "Prefer marketplace evidence from core tools over Botique-only memory tools unless "
    "you genuinely need to save or retrieve a note or reminder. "
    "Do not plan multiple future turns in one response."
)


@dataclass(frozen=True, slots=True)
class ProviderPolicyConfig:
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    require_tool_choice: str = "any"
    allow_parallel_tool_calls: bool = False


class ToolCallingAgentPolicy(DailyAgentPolicy):
    def __init__(
        self,
        provider: ToolCallingProvider,
        *,
        config: ProviderPolicyConfig | None = None,
    ) -> None:
        self.provider = provider
        self.config = config or ProviderPolicyConfig()

    def next_turn(self, context: AgentTurnContext) -> AgentTurnDecision:
        response = self.provider.complete(
            messages=self._build_messages(context),
            tools=self._build_tools(context),
            tool_choice=self.config.require_tool_choice,
            allow_parallel_tool_calls=self.config.allow_parallel_tool_calls,
        )

        if not response.tool_calls:
            raise ProviderError("Provider returned no tool call for a single-action turn.")
        if len(response.tool_calls) > 1 and not self.config.allow_parallel_tool_calls:
            raise ProviderError("Provider returned multiple tool calls for a single-action turn.")

        tool_call = response.tool_calls[0]
        summary = response.content.strip() or self._default_summary(tool_call)
        provider_tool_calls = tuple(
            _provider_tool_call_payload(call) for call in response.tool_calls
        )
        if tool_call.name == NO_ACTION_TOOL_NAME:
            no_action_summary = _string_argument(tool_call.arguments, "summary") or summary
            return AgentTurnDecision(
                summary=no_action_summary,
                tool_call=ToolCall(
                    name=tool_call.name,
                    arguments=dict(tool_call.arguments),
                ),
                assistant_text=response.content,
                provider_tool_calls=provider_tool_calls,
            )

        return AgentTurnDecision(
            summary=summary,
            tool_call=ToolCall(
                name=tool_call.name,
                arguments=dict(tool_call.arguments),
            ),
            assistant_text=response.content,
            provider_tool_calls=provider_tool_calls,
        )

    def _build_messages(self, context: AgentTurnContext) -> tuple[ProviderMessage, ...]:
        prompt_payload: dict[str, JSONValue] = {
            "run_id": context.run_id,
            "turn_index": context.turn_index,
            "max_turns": context.max_turns,
            "remaining_turns": context.remaining_turns,
            "turn_phase": context.turn_phase.value,
            "remaining_inspect_turns": context.remaining_inspect_turns,
            "remaining_action_turns": context.remaining_action_turns,
            "briefing": context.briefing.to_prompt_payload(),
            "prior_turns": [
                {
                    "turn_index": record.turn_index,
                    "decision_summary": record.decision_summary,
                    "tool_call": None
                    if record.tool_call is None
                    else {
                        "name": record.tool_call.name,
                        "arguments": jsonify(record.tool_call.arguments),
                    },
                    "tool_result": None
                    if record.tool_result is None
                    else {
                        "tool_name": record.tool_result.tool_name,
                        "output_summary": _summarize_tool_output(
                            record.tool_result.tool_name,
                            record.tool_result.output,
                        ),
                    },
                    "state_changes": record.state_changes,
                }
                for record in context.prior_turns
            ],
            "available_tools": [
                tool.name for tool in context.available_tools
            ] + ([NO_ACTION_TOOL_NAME] if context.allow_no_action else []),
            "instructions": list(context.phase_instructions),
        }
        return (
            ProviderMessage(
                role=ProviderMessageRole.SYSTEM,
                content=self.config.system_prompt,
            ),
            ProviderMessage(
                role=ProviderMessageRole.USER,
                content=self._build_user_message(context),
            ),
        )

    def _build_user_message(self, context: AgentTurnContext) -> str:
        support_tools = [
            tool for tool in context.available_tools if tool.name in SUPPORT_TOOL_NAMES
        ]
        lines = [
            context.briefing.render_for_agent(),
            "",
            "## Work session",
            f"- Work slot: {context.turn_index} of {context.turns_per_day}",
            (
                f"- Work slots: {context.turns_remaining} left / "
                f"{context.turns_per_day} total ({context.turns_used} used)"
            ),
            (
                "- Available actions right now: "
                + ", ".join(tool.name for tool in context.available_tools)
            ),
            "",
            "## Work completed so far",
        ]

        if support_tools:
            lines.insert(
                5,
                "- Support tools available now: "
                + ", ".join(tool.name for tool in support_tools)
                + ".",
            )

        if context.prior_turns:
            lines.append(
                "Use the exact results from earlier work today instead of repeating a summary action unless the shop state has changed."
            )
            for record in context.prior_turns:
                lines.extend(_render_prior_turn(record))
        else:
            lines.append("- No work completed yet today.")

        lines.extend(
            [
                "",
                "## Decision",
                "- Choose the single highest-leverage next action for the shop.",
                "- Prefer drilling down or acting over repeating the same summary read.",
                (
                    "- If it is time to stop for today, end the day with a short business reason."
                ),
            ]
        )
        return "\n".join(lines)

    def _build_tools(
        self,
        context: AgentTurnContext,
    ) -> tuple[ProviderToolDefinition, ...]:
        tools = [
            ProviderToolDefinition(
                name=tool.name,
                description=_provider_tool_description(tool),
                parameters_schema=tool.parameters_schema or _fallback_parameters_schema(tool),
            )
            for tool in context.available_tools
        ]
        if context.allow_no_action:
            tools.append(
                ProviderToolDefinition(
                    name=NO_ACTION_TOOL_NAME,
                    description=(
                        "Use only when no primary business change is justified today after "
                        "inspection. This does not call the marketplace."
                    ),
                    parameters_schema={
                        "type": "object",
                        "properties": {
                            "summary": {
                                "type": "string",
                                "description": "Short explanation of why no business change is being made today.",
                            },
                            "reason": {
                                "type": "string",
                                "description": "Evidence-backed reason for holding steady instead of changing the shop.",
                            },
                        },
                        "required": ["summary", "reason"],
                        "additionalProperties": False,
                    },
                )
            )
        return tuple(tools)

    @staticmethod
    def _default_summary(tool_call: ProviderToolCall) -> str:
        if tool_call.name == NO_ACTION_TOOL_NAME:
            return "Hold steady without making a business change."
        return f"Call {tool_call.name}."


def _provider_tool_description(tool: ToolManifestEntry) -> str:
    description = tool.description
    if tool.notes:
        description = f"{description} {tool.notes[0]}"
    return description


def _fallback_parameters_schema(tool: ToolManifestEntry) -> dict[str, JSONValue]:
    return {
        "type": "object",
        "properties": {},
        "required": list(tool.path_params) + list(tool.required_body_fields),
        "additionalProperties": True,
    }


def _string_argument(arguments: dict[str, JSONValue], key: str) -> str | None:
    value = arguments.get(key)
    if isinstance(value, str) and value.strip():
        return value
    return None


def _provider_tool_call_payload(tool_call: ProviderToolCall) -> dict[str, JSONValue]:
    return {
        "name": tool_call.name,
        "arguments": jsonify(tool_call.arguments),
        "call_id": tool_call.call_id,
    }


def _summarize_tool_output(tool_name: str, output: object) -> JSONValue:
    payload = jsonify(output)
    if not isinstance(payload, dict):
        return payload

    if tool_name in {"search_marketplace", "get_shop_listings"}:
        return _summarize_listing_page(payload)
    if tool_name == "get_orders":
        return _summarize_order_page(payload)
    if tool_name == "get_reviews":
        return _summarize_review_page(payload)
    if tool_name in {"get_shop_info", "get_listing"}:
        return _select_keys(
            payload,
            (
                "shop_id",
                "shop_name",
                "listing_id",
                "title",
                "state",
                "price",
                "listing_active_count",
                "total_sales_count",
                "review_average",
                "review_count",
                "currency_code",
            ),
        )
    return payload


def _summarize_listing_page(payload: dict[str, JSONValue]) -> dict[str, JSONValue]:
    results = payload.get("results")
    summarized: list[JSONValue] = []
    if isinstance(results, list):
        for item in results[:3]:
            if isinstance(item, dict):
                summarized.append(
                    _select_keys(
                        item,
                        (
                            "listing_id",
                            "title",
                            "shop_name",
                            "price",
                            "state",
                            "ranking_score",
                            "favorites",
                            "views",
                            "taxonomy_id",
                        ),
                    )
                )
    return {
        "count": payload.get("count"),
        "limit": payload.get("limit"),
        "offset": payload.get("offset"),
        "results": summarized,
    }


def _summarize_order_page(payload: dict[str, JSONValue]) -> dict[str, JSONValue]:
    results = payload.get("results")
    summarized: list[JSONValue] = []
    if isinstance(results, list):
        for item in results[:3]:
            if isinstance(item, dict):
                summarized.append(
                    _select_keys(
                        item,
                        (
                            "receipt_id",
                            "status",
                            "created_timestamp",
                            "grandtotal",
                            "currency_code",
                        ),
                    )
                )
    return {
        "count": payload.get("count"),
        "results": summarized,
    }


def _summarize_review_page(payload: dict[str, JSONValue]) -> dict[str, JSONValue]:
    results = payload.get("results")
    summarized: list[JSONValue] = []
    if isinstance(results, list):
        for item in results[:3]:
            if isinstance(item, dict):
                summarized.append(
                    _select_keys(
                        item,
                        (
                            "review_id",
                            "listing_id",
                            "rating",
                            "buyer_user_id",
                            "buyer_name",
                            "review",
                        ),
                    )
                )
    return {
        "count": payload.get("count"),
        "results": summarized,
    }


def _select_keys(
    payload: dict[str, JSONValue],
    keys: tuple[str, ...],
) -> dict[str, JSONValue]:
    return {key: payload[key] for key in keys if key in payload}
