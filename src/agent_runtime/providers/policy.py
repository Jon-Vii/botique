from __future__ import annotations

import json
from dataclasses import dataclass

from seller_core.models import JSONValue

from agent_runtime.loop import (
    AgentTurnContext,
    AgentTurnDecision,
    DailyAgentPolicy,
    ToolCall,
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


DEFAULT_SYSTEM_PROMPT = (
    "## Role\n"
    "You are an autonomous AI agent running a craft shop on Botique, an online\n"
    "marketplace. You operate across many simulated days with no human oversight.\n"
    "\n"
    "## Objective\n"
    "Maximize your shop's ending cash balance. Cash comes from sales minus material\n"
    "and production costs. Buyer payments may post with a delay — money owed is not\n"
    "the same as cash on hand.\n"
    "\n"
    "## Production\n"
    "Your workshop has fixed daily production capacity. Every product consumes\n"
    "capacity and materials. Two fulfillment modes:\n"
    "- **Stocked**: sells from finished inventory immediately, but ties up capacity\n"
    "  and capital upfront.\n"
    "- **Made-to-order**: customers buy first, production happens from backlog.\n"
    "  Generates demand before production, but increases fulfillment pressure.\n"
    "\n"
    "## Listings\n"
    "Only active listings can sell. Draft listings let you stage new products before\n"
    "committing them to market. You can create new products, expand into adjacent\n"
    "product lines, and pivot over time.\n"
    "\n"
    "## Daily loop\n"
    "Each day starts with a morning briefing: cash position, recent sales and\n"
    "reviews, listing performance, production pressure, and market context. You\n"
    "have a limited number of work slots per day. Each slot is one action. Use\n"
    "every slot to act on, improve, or inspect your business.\n"
    "\n"
    "## Memory\n"
    "You have a persistent scratchpad that carries across days. You can read and\n"
    "update it freely — it does not cost a work slot. Use it to track plans,\n"
    "observations, and anything you want to remember tomorrow.\n"
    "\n"
    "## Principles\n"
    "Think like a business owner. Act on evidence, manage inventory and backlog,\n"
    "and adapt as the market changes."
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
        model_content = response.content.strip()
        summary = model_content or self._default_summary(tool_call)

        return AgentTurnDecision(
            summary=summary,
            tool_call=ToolCall(
                name=tool_call.name,
                arguments=dict(tool_call.arguments),
                call_id=tool_call.call_id,
            ),
            model_content=model_content,
        )

    def _build_messages(self, context: AgentTurnContext) -> tuple[ProviderMessage, ...]:
        messages: list[ProviderMessage] = [
            ProviderMessage(
                role=ProviderMessageRole.SYSTEM,
                content=self.config.system_prompt,
            ),
            ProviderMessage(
                role=ProviderMessageRole.USER,
                content=self._build_briefing_message(context),
            ),
        ]

        # Replay prior turns as proper multi-turn conversation
        for record in context.prior_turns:
            if record.tool_call is not None:
                messages.append(ProviderMessage(
                    role=ProviderMessageRole.ASSISTANT,
                    content=record.model_content,
                    tool_calls=(ProviderToolCall(
                        name=record.tool_call.name,
                        arguments=record.tool_call.arguments,
                        call_id=record.tool_call.call_id,
                    ),),
                ))
                result_json = json.dumps(
                    jsonify(record.tool_result.output), indent=2
                ) if record.tool_result else "{}"
                messages.append(ProviderMessage(
                    role=ProviderMessageRole.TOOL,
                    content=result_json,
                    name=record.tool_call.name,
                    tool_call_id=record.tool_call.call_id,
                ))

        # Add turn status prompt (tells model what slot it's on and what to do)
        if context.prior_turns:
            messages.append(ProviderMessage(
                role=ProviderMessageRole.USER,
                content=self._build_turn_status(context),
            ))

        return tuple(messages)

    def _build_briefing_message(self, context: AgentTurnContext) -> str:
        """First user message: morning briefing + work session info + decision prompt."""
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
                "- Available actions: "
                + ", ".join(tool.name for tool in context.available_tools)
            ),
            "",
            "## Decision",
            "- Choose the single highest-leverage next action for the shop.",
            "- Prefer drilling down or acting over repeating the same summary read.",
        ]
        return "\n".join(lines)

    def _build_turn_status(self, context: AgentTurnContext) -> str:
        """Brief status update for turns 2+, after prior tool results."""
        return (
            f"Work slot {context.turn_index} of {context.turns_per_day} "
            f"({context.turns_remaining} remaining). "
            "Choose the next highest-leverage action."
        )

    def _build_tools(
        self,
        context: AgentTurnContext,
    ) -> tuple[ProviderToolDefinition, ...]:
        return tuple(
            ProviderToolDefinition(
                name=tool.name,
                description=_provider_tool_description(tool),
                parameters_schema=tool.parameters_schema or _fallback_parameters_schema(tool),
            )
            for tool in context.available_tools
        )

    @staticmethod
    def _default_summary(tool_call: ProviderToolCall) -> str:
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


