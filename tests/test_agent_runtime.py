from __future__ import annotations

import unittest

import _bootstrap
from agent_runtime import (
    AgentTurnDecision,
    BalanceSummary,
    DailyLoopConfig,
    DayEndReason,
    InMemoryAgentMemory,
    InMemoryEventLog,
    MorningBriefingBuilder,
    ObjectiveProgress,
    OrderSummary,
    SingleShopDailyLoop,
    ToolCall,
    build_owner_agent_tool_registry,
)
from agent_runtime.tools import DEFAULT_OWNER_AGENT_CORE_TOOLS


class FakeSellerCoreClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def manifest(self) -> list[dict[str, object]]:
        return [
            {
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
            for name in DEFAULT_OWNER_AGENT_CORE_TOOLS
        ]

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
