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


END_DAY_TOOL_NAME = "end_day"
SUPPORT_TOOL_NAMES = {
    "set_reminder",
    "complete_reminder",
}
DEFAULT_SYSTEM_PROMPT = (
    "You are an autonomous AI agent managing a craft shop on Botique, an online "
    "marketplace. You are fully responsible for running this business across many "
    "simulated days. No outside user will step in to manage it for you. "
    "Your performance is judged primarily by ending available cash and the realized "
    "business results that produce it. Revenue comes from sales. Materials and "
    "production decisions create costs. Buyer payments may post with a delay, so money "
    "you are owed is not the same as cash you currently have. "
    "Your shop has a workshop with fixed daily production capacity. Every product you "
    "make consumes capacity and materials. Some listings sell from finished inventory on "
    "hand. Others are made-to-order: customers buy first, then production happens from "
    "backlog. Stocked items can sell immediately but tie up capacity and capital. "
    "Made-to-order items can create demand before production is finished, but they "
    "increase backlog and fulfillment pressure. "
    "Only active listings can sell. Draft listings are staging work: useful for "
    "preparing a new product before committing it to the market. Your starting catalog "
    "reflects your shop's production identity, but you are free to experiment, expand "
    "into adjacent product lines, and gradually pivot over time. "
    "Each day you receive a morning briefing with the seller-visible business state you "
    "need to operate: cash position, recent sales and reviews, shop and listing signals, "
    "production pressure, and market movements. You have a limited number of work slots "
    "each day. Use them carefully. In each work slot, do one meaningful piece of work "
    "using one available action. End the day when further work is unlikely to improve "
    "outcomes. "
    "You have a persistent memory system for cross-day work. Your scratchpad "
    "carries working context from one day to the next and is automatically "
    "revised between days — you do not need to update it manually. Reminders "
    "resurface on a future day. Use reminders when they help you think across "
    "time, not by reflex. "
    "Think like a business owner: inspect enough evidence to make decisions, improve the "
    "shop when action is warranted, manage inventory and backlog carefully, and adapt as "
    "the market changes."
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
        if tool_call.name == END_DAY_TOOL_NAME:
            end_summary = _string_argument(tool_call.arguments, "summary") or summary
            return AgentTurnDecision(summary=end_summary, end_day=True)

        return AgentTurnDecision(
            summary=summary,
            tool_call=ToolCall(
                name=tool_call.name,
                arguments=dict(tool_call.arguments),
            ),
        )

    def _build_messages(self, context: AgentTurnContext) -> tuple[ProviderMessage, ...]:
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
        tools.append(
            ProviderToolDefinition(
                name=END_DAY_TOOL_NAME,
                description="End the current workday and leave any remaining work slots unused.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "Short business reason for stopping work now.",
                        }
                    },
                    "required": ["summary"],
                    "additionalProperties": False,
                },
            )
        )
        return tuple(tools)

    @staticmethod
    def _default_summary(tool_call: ProviderToolCall) -> str:
        if tool_call.name == END_DAY_TOOL_NAME:
            return "End the workday."
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


def _render_prior_turn(record: TurnRecord) -> list[str]:
    lines = [
        "",
        f"### Work slot {record.turn_index}",
        f"- Decision summary: {record.decision_summary}",
    ]
    if record.tool_call is not None:
        lines.append(f"- Action used: {record.tool_call.name}")
        lines.extend(
            [
                "- Exact action arguments:",
                "```json",
                _render_json(record.tool_call.arguments),
                "```",
            ]
        )
    if record.tool_result is not None:
        lines.extend(
            [
                "- Exact action result:",
                "```json",
                _render_json(record.tool_result.output),
                "```",
            ]
        )
    if record.state_changes is not None:
        lines.extend(
            [
                "- Recorded state changes:",
                "```json",
                _render_json(record.state_changes),
                "```",
            ]
        )
    return lines


def _render_json(value: object) -> str:
    return json.dumps(jsonify(value), indent=2)
