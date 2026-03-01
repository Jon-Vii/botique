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
    "write_note",
    "read_notes",
    "set_reminder",
    "complete_reminder",
}
DEFAULT_SYSTEM_PROMPT = (
    "You are the owner of a single Botique shop, working through one constrained seller "
    "workday at a time. Each turn must do exactly one thing: call one available tool or "
    "call `end_day` when the remaining work is not worth more budget today. Treat notes "
    "and reminders as optional support tools that are visible to you, not hidden memory. "
    "Use them only when they genuinely help you follow through on a business idea. Use "
    "seller-visible evidence when you need it, keep actions grounded in the current shop "
    "state, and do not rely on hidden world knowledge or provider-specific behavior."
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
            f"- Turn: {context.turn_index}",
            (
                f"- Work budget: {context.work_budget_remaining} left / "
                f"{context.work_budget} total ({context.work_budget_spent} spent)"
            ),
            (
                "- Available tools right now: "
                + ", ".join(
                    f"{tool.name} ({tool.work_cost})" for tool in context.available_tools
                )
            ),
            "",
            "## Work completed so far",
        ]

        if support_tools:
            lines.insert(
                5,
                "- Support tools available now: "
                + ", ".join(
                    f"{tool.name} ({tool.work_cost})" for tool in support_tools
                )
                + ".",
            )

        if context.prior_turns:
            lines.extend(
                f"- {_summarize_turn(record)}" for record in context.prior_turns[-6:]
            )
        else:
            lines.append("- No work completed yet today.")

        lines.extend(
            [
                "",
                "## Decision",
                "- Choose the single highest-leverage next action for the shop.",
                (
                    "- Return exactly one tool call. If it is time to stop for today, "
                    "call end_day with a short business reason."
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
                description="End the current workday without spending more budget.",
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
    description = f"{tool.description} Work cost: {tool.work_cost}."
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


def _summarize_turn(record: TurnRecord) -> str:
    tool_name = "no tool"
    if record.tool_call is not None:
        tool_name = record.tool_call.name

    summary = (
        f"Turn {record.turn_index}: {record.decision_summary} "
        f"Used {tool_name} for {record.work_cost} budget."
    )
    if record.tool_result is None:
        return summary
    return f"{summary} Outcome: {_summarize_tool_output(record.tool_result.output)}"


def _summarize_tool_output(output: object) -> str:
    value = jsonify(output)
    if isinstance(value, dict):
        if isinstance(value.get("count"), int):
            return f"{value['count']} item(s) returned."

        note = value.get("note")
        if isinstance(note, dict):
            title = note.get("title")
            if isinstance(title, str) and title:
                return f'Note saved: "{title}".'
            return "Note saved."

        reminder = value.get("reminder")
        if isinstance(reminder, dict):
            content = reminder.get("content")
            due_day = reminder.get("due_day")
            if isinstance(content, str) and due_day is not None:
                return f'Reminder tracked for day {due_day}: "{content}".'
            status = reminder.get("status")
            if isinstance(status, str) and status:
                return f"Reminder status: {status}."

        results = value.get("results")
        if isinstance(results, list):
            return f"{len(results)} result(s) returned."

    compact = json.dumps(value, separators=(",", ":"), sort_keys=True)
    if len(compact) <= 140:
        return compact
    return f"{compact[:137]}..."
