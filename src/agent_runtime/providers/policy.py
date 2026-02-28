from __future__ import annotations

from dataclasses import dataclass

from seller_core.models import JSONValue

from agent_runtime.loop import AgentTurnContext, AgentTurnDecision, DailyAgentPolicy, ToolCall
from agent_runtime.serialization import jsonify
from agent_runtime.tools.registry import ToolManifestEntry

from .base import (
    ProviderError,
    ProviderMessage,
    ProviderMessageRole,
    ProviderToolCall,
    ProviderToolDefinition,
    ToolCallingProvider,
    dump_json,
)


END_DAY_TOOL_NAME = "end_day"
DEFAULT_SYSTEM_PROMPT = (
    "You are the owner-agent for a single Botique shop. "
    "Choose exactly one action for this turn: call one seller-facing tool or call "
    "`end_day` if the day should stop now. "
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
        prompt_payload: dict[str, JSONValue] = {
            "run_id": context.run_id,
            "turn_index": context.turn_index,
            "max_turns": context.max_turns,
            "remaining_turns": context.remaining_turns,
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
                        "output": jsonify(record.tool_result.output),
                    },
                    "state_changes": record.state_changes,
                }
                for record in context.prior_turns
            ],
            "available_tools": [tool.name for tool in context.available_tools] + [END_DAY_TOOL_NAME],
            "instructions": [
                "Return exactly one tool call for this turn.",
                "If the day should stop, call end_day with a short summary.",
                "If you call a seller tool, provide only the arguments for this turn.",
            ],
        }
        return (
            ProviderMessage(
                role=ProviderMessageRole.SYSTEM,
                content=self.config.system_prompt,
            ),
            ProviderMessage(
                role=ProviderMessageRole.USER,
                content=dump_json(prompt_payload),
            ),
        )

    def _build_tools(
        self,
        context: AgentTurnContext,
    ) -> tuple[ProviderToolDefinition, ...]:
        tools = [
            ProviderToolDefinition(
                name=tool.name,
                description=tool.description,
                parameters_schema=tool.parameters_schema or _fallback_parameters_schema(tool),
            )
            for tool in context.available_tools
        ]
        tools.append(
            ProviderToolDefinition(
                name=END_DAY_TOOL_NAME,
                description="End the current simulation day without calling another seller tool.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "Short explanation of why the day is ending now.",
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
            return "End the day."
        return f"Call {tool_call.name}."


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
