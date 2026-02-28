from __future__ import annotations

import unittest

import _bootstrap
from agent_runtime import (
    AgentTurnContext,
    AgentTurnDecision,
    BalanceSummary,
    DailyLoopConfig,
    DayEndReason,
    InMemoryAgentMemory,
    InMemoryEventLog,
    MistralProviderConfig,
    MistralToolCallingProvider,
    MorningBriefingBuilder,
    ObjectiveProgress,
    OrderSummary,
    ProviderMessage,
    ProviderMessageRole,
    ProviderPolicyConfig,
    ProviderResponse,
    ProviderToolCall,
    ProviderToolDefinition,
    SingleShopDailyLoop,
    ToolCallingAgentPolicy,
    ToolCall,
    build_owner_agent_tool_registry,
)
from agent_runtime.providers.policy import END_DAY_TOOL_NAME
from agent_runtime.tools import DEFAULT_OWNER_AGENT_CORE_TOOLS


class FakeSellerCoreClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def manifest(self) -> list[dict[str, object]]:
        manifest = []
        for name in DEFAULT_OWNER_AGENT_CORE_TOOLS:
            entry = {
                "tool_name": name,
                "operation_id": name,
                "description": f"Stub manifest entry for {name}.",
                "path_params": [],
                "query_params": [],
                "required_body_fields": [],
                "body_encoding": "none",
                "scopes": [],
                "notes": [],
            }
            if name == "search_marketplace":
                entry["query_params"] = ["keywords", "limit", "offset"]
            elif name == "get_shop_info":
                entry["path_params"] = ["shop_id"]
            manifest.append(entry)
        return manifest

    def call(self, tool_name: str, arguments: dict[str, object]) -> dict[str, object]:
        copied = dict(arguments)
        self.calls.append((tool_name, copied))
        return {"tool_name": tool_name, "arguments": copied}


class ScriptedPolicy:
    def __init__(self, decisions: list[AgentTurnDecision]) -> None:
        self._decisions = list(decisions)
        self.contexts = []

    def next_turn(self, context):
        self.contexts.append(context)
        return self._decisions.pop(0)


class RecordingProvider:
    def __init__(self, responses: list[ProviderResponse]) -> None:
        self.responses = list(responses)
        self.calls: list[dict[str, object]] = []

    def complete(self, *, messages, tools, tool_choice="auto", allow_parallel_tool_calls=False):
        self.calls.append(
            {
                "messages": messages,
                "tools": tools,
                "tool_choice": tool_choice,
                "allow_parallel_tool_calls": allow_parallel_tool_calls,
            }
        )
        return self.responses.pop(0)


class FakeMistralClient:
    def __init__(self, response_payload: dict[str, object]) -> None:
        self.response_payload = response_payload
        self.calls: list[dict[str, object]] = []
        self.chat = self.Chat(self)

    class Chat:
        def __init__(self, outer: "FakeMistralClient") -> None:
            self.outer = outer

        def complete(self, **kwargs):
            self.outer.calls.append(kwargs)
            return self.outer.response_payload


class MorningBriefingTests(unittest.TestCase):
    def test_builder_includes_due_reminders_in_briefing_payload(self) -> None:
        memory = InMemoryAgentMemory()
        memory.set_reminder(
            shop_id=7,
            content="Check whether the floral planner needs repricing.",
            due_day=3,
            day=1,
        )
        builder = MorningBriefingBuilder(memory)

        briefing = builder.build(
            run_id="run_test",
            shop_id=7,
            shop_name="Studio North",
            day=3,
            balance_summary=BalanceSummary(available=142.5, pending=20.0),
            yesterday_orders=OrderSummary(order_count=2, revenue=24.0, average_order_value=12.0),
            objective_progress=ObjectiveProgress(
                primary_objective="Grow ending balance",
                metric_name="ending_balance",
                current_value=142.5,
                target_value=200.0,
                status_summary="Still behind pace after a soft conversion day.",
            ),
        )

        self.assertEqual(briefing.shop_name, "Studio North")
        self.assertEqual(len(briefing.due_reminders), 1)
        payload = briefing.to_prompt_payload()
        self.assertEqual(payload["day"], 3)
        self.assertEqual(
            payload["due_reminders"][0]["content"],
            "Check whether the floral planner needs repricing.",
        )


class ToolRegistryTests(unittest.TestCase):
    def test_owner_registry_wraps_core_tools_and_memory_extensions(self) -> None:
        client = FakeSellerCoreClient()
        memory = InMemoryAgentMemory()
        registry = build_owner_agent_tool_registry(client, memory=memory)

        tool_names = {entry.name for entry in registry.manifest()}
        self.assertIn("search_marketplace", tool_names)
        self.assertIn("write_note", tool_names)
        self.assertIn("set_reminder", tool_names)

        core_result = registry.invoke("search_marketplace", {"keywords": "mushroom planner"})
        note_result = registry.invoke(
            "write_note",
            {
                "shop_id": 7,
                "title": "Today's angle",
                "body": "Lean into mushroom planner keywords.",
                "tags": ["seo"],
                "day": 3,
            },
        )
        reminder_result = registry.invoke(
            "set_reminder",
            {
                "shop_id": 7,
                "content": "Review conversion on the mushroom planner.",
                "due_day": 4,
                "day": 3,
            },
        )
        notes_result = registry.invoke("read_notes", {"shop_id": 7})

        self.assertEqual(client.calls, [("search_marketplace", {"keywords": "mushroom planner"})])
        self.assertEqual(core_result.output["tool_name"], "search_marketplace")
        self.assertEqual(note_result.output["note"]["title"], "Today's angle")
        self.assertEqual(reminder_result.output["reminder"]["due_day"], 4)
        self.assertEqual(notes_result.output["count"], 1)

    def test_registry_manifest_includes_parameter_schemas_for_provider_use(self) -> None:
        registry = build_owner_agent_tool_registry(FakeSellerCoreClient(), memory=InMemoryAgentMemory())

        manifests = {entry.name: entry for entry in registry.manifest()}
        self.assertEqual(
            manifests["search_marketplace"].parameters_schema["type"],
            "object",
        )
        self.assertIn(
            "keywords",
            manifests["search_marketplace"].parameters_schema["properties"],
        )
        self.assertEqual(
            manifests["write_note"].parameters_schema["required"],
            ["shop_id", "title", "body"],
        )


class DailyLoopTests(unittest.TestCase):
    def test_single_shop_loop_runs_one_tool_per_turn_and_logs_note_writes(self) -> None:
        client = FakeSellerCoreClient()
        memory = InMemoryAgentMemory()
        registry = build_owner_agent_tool_registry(client, memory=memory)
        event_log = InMemoryEventLog()
        builder = MorningBriefingBuilder(memory)
        briefing = builder.build(
            run_id="run_day_1",
            shop_id=7,
            shop_name="Studio North",
            day=3,
            balance_summary=BalanceSummary(available=142.5, pending=20.0),
            yesterday_orders=OrderSummary(order_count=2, revenue=24.0, average_order_value=12.0),
            objective_progress=ObjectiveProgress(
                primary_objective="Grow ending balance",
                metric_name="ending_balance",
                current_value=142.5,
                target_value=200.0,
                status_summary="Needs a stronger conversion day.",
            ),
        )
        policy = ScriptedPolicy(
            [
                AgentTurnDecision(
                    summary="Inspect the market before changing the shop.",
                    tool_call=ToolCall("search_marketplace", {"keywords": "mushroom planner"}),
                ),
                AgentTurnDecision(
                    summary="Capture the pricing hypothesis for tomorrow.",
                    tool_call=ToolCall(
                        "write_note",
                        {
                            "shop_id": 7,
                            "title": "Pricing follow-up",
                            "body": "If the retro planner stalls again, test a lower price.",
                            "day": 3,
                        },
                    ),
                ),
                AgentTurnDecision(
                    summary="The main priorities are complete for today.",
                    end_day=True,
                ),
            ]
        )
        loop = SingleShopDailyLoop(
            tool_registry=registry,
            event_log=event_log,
            config=DailyLoopConfig(max_turns=5),
        )

        result = loop.run_day(briefing=briefing, policy=policy)

        self.assertEqual(result.end_reason, DayEndReason.AGENT_ENDED_DAY)
        self.assertEqual(len(result.turns), 2)
        self.assertEqual(policy.contexts[1].prior_turns[0].tool_call.name, "search_marketplace")
        self.assertEqual(client.calls, [("search_marketplace", {"keywords": "mushroom planner"})])
        self.assertIn("write_note", [turn.tool_result.tool_name for turn in result.turns if turn.tool_result])
        event_kinds = [event.kind.value for event in result.events]
        self.assertIn("briefing_generated", event_kinds)
        self.assertIn("note_written", event_kinds)
        self.assertEqual(event_kinds[-1], "day_ended")

    def test_daily_loop_stops_at_max_turns_when_agent_never_ends_day(self) -> None:
        client = FakeSellerCoreClient()
        registry = build_owner_agent_tool_registry(client, memory=InMemoryAgentMemory())
        briefing = MorningBriefingBuilder(InMemoryAgentMemory()).build(
            run_id="run_day_2",
            shop_id=7,
            shop_name="Studio North",
            day=4,
            balance_summary=BalanceSummary(available=150.0),
            yesterday_orders=OrderSummary(order_count=0, revenue=0.0),
            objective_progress=ObjectiveProgress(
                primary_objective="Grow ending balance",
                metric_name="ending_balance",
                current_value=150.0,
                target_value=200.0,
                status_summary="No sales yesterday.",
            ),
        )
        policy = ScriptedPolicy(
            [
                AgentTurnDecision(
                    summary="Check the marketplace once.",
                    tool_call=ToolCall("search_marketplace", {"keywords": "planner"}),
                )
            ]
        )
        loop = SingleShopDailyLoop(
            tool_registry=registry,
            config=DailyLoopConfig(max_turns=1),
        )

        result = loop.run_day(briefing=briefing, policy=policy)

        self.assertEqual(result.end_reason, DayEndReason.MAX_TURNS_REACHED)
        self.assertEqual(len(result.turns), 1)


class ProviderPolicyTests(unittest.TestCase):
    def _make_context(self):
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
        )
        briefing = MorningBriefingBuilder(InMemoryAgentMemory()).build(
            run_id="run_provider",
            shop_id=7,
            shop_name="Studio North",
            day=5,
            balance_summary=BalanceSummary(available=175.0),
            yesterday_orders=OrderSummary(order_count=1, revenue=12.0),
            objective_progress=ObjectiveProgress(
                primary_objective="Grow ending balance",
                metric_name="ending_balance",
                current_value=175.0,
                target_value=220.0,
                status_summary="One sale yesterday, but traffic is soft.",
            ),
        )
        return registry, briefing

    def _turn_context(self, registry, briefing) -> AgentTurnContext:
        return AgentTurnContext(
            run_id=briefing.run_id,
            briefing=briefing,
            turn_index=1,
            max_turns=3,
            remaining_turns=3,
            available_tools=tuple(registry.manifest()),
            prior_turns=(),
        )

    def test_tool_calling_policy_maps_provider_tool_calls_to_turn_decisions(self) -> None:
        registry, briefing = self._make_context()
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="Search the market before editing listings.",
                    tool_calls=(
                        ProviderToolCall(
                            name="search_marketplace",
                            arguments={"keywords": "planner"},
                        ),
                    ),
                )
            ]
        )
        policy = ToolCallingAgentPolicy(provider)
        decision = policy.next_turn(context=self._turn_context(registry, briefing))

        self.assertEqual(decision.tool_call.name, "search_marketplace")
        self.assertEqual(decision.tool_call.arguments["keywords"], "planner")
        self.assertEqual(provider.calls[0]["tool_choice"], "any")
        self.assertFalse(provider.calls[0]["allow_parallel_tool_calls"])
        tool_names = [tool.name for tool in provider.calls[0]["tools"]]
        self.assertIn("search_marketplace", tool_names)
        self.assertIn(END_DAY_TOOL_NAME, tool_names)
        self.assertEqual(provider.calls[0]["messages"][0].role, ProviderMessageRole.SYSTEM)

    def test_tool_calling_policy_maps_end_day_tool(self) -> None:
        registry, briefing = self._make_context()
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name=END_DAY_TOOL_NAME,
                            arguments={"summary": "Priority work is complete for today."},
                        ),
                    ),
                )
            ]
        )
        policy = ToolCallingAgentPolicy(provider, config=ProviderPolicyConfig())
        decision = policy.next_turn(context=self._turn_context(registry, briefing))

        self.assertTrue(decision.end_day)
        self.assertEqual(decision.summary, "Priority work is complete for today.")


class MistralProviderTests(unittest.TestCase):
    def test_mistral_provider_formats_sdk_request_and_parses_tool_calls(self) -> None:
        fake_client = FakeMistralClient(
            {
                "choices": [
                    {
                        "message": {
                            "content": "Inspect the market first.",
                            "tool_calls": [
                                {
                                    "id": "call_123",
                                    "function": {
                                        "name": "search_marketplace",
                                        "arguments": '{"keywords":"planner","limit":5}',
                                    },
                                }
                            ],
                        }
                    }
                ]
            }
        )
        provider = MistralToolCallingProvider(
            MistralProviderConfig(api_key="test-key"),
            client=fake_client,
        )

        response = provider.complete(
            messages=(
                ProviderMessage(role=ProviderMessageRole.SYSTEM, content="rule"),
                ProviderMessage(role=ProviderMessageRole.USER, content="payload"),
            ),
            tools=(
                ProviderToolDefinition(
                    name="search_marketplace",
                    description="Search listings.",
                    parameters_schema={"type": "object", "properties": {}},
                ),
            ),
            tool_choice="any",
            allow_parallel_tool_calls=False,
        )

        self.assertEqual(response.content, "Inspect the market first.")
        self.assertEqual(response.tool_calls[0].name, "search_marketplace")
        self.assertEqual(response.tool_calls[0].arguments["limit"], 5)
        sdk_call = fake_client.calls[0]
        self.assertEqual(sdk_call["model"], "mistral-medium-latest")
        self.assertEqual(sdk_call["tool_choice"], "any")
        self.assertFalse(sdk_call["parallel_tool_calls"])
        self.assertEqual(sdk_call["messages"][0]["role"], "system")
        self.assertEqual(sdk_call["tools"][0]["function"]["name"], "search_marketplace")


class TurnDecisionValidationTests(unittest.TestCase):
    def test_turn_decision_requires_exactly_one_action(self) -> None:
        with self.assertRaisesRegex(ValueError, "exactly one tool or end the day"):
            AgentTurnDecision(summary="Do something later.")

        with self.assertRaisesRegex(ValueError, "exactly one tool or end the day"):
            AgentTurnDecision(
                summary="This is invalid.",
                tool_call=ToolCall("search_marketplace", {}),
                end_day=True,
            )


if __name__ == "__main__":
    unittest.main()
