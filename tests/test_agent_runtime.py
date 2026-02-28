from __future__ import annotations

import json
import unittest
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import _bootstrap
from agent_runtime import (
    AgentTurnContext,
    AgentTurnDecision,
    BalanceSummary,
    DailyLoopConfig,
    DayEndReason,
    InMemoryAgentMemory,
    InMemoryEventLog,
    ListingSnapshot,
    LiveMorningBriefingBuilder,
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
    ShopStateSnapshot,
    ToolCallingAgentPolicy,
    ToolCall,
    build_default_owner_agent_runner,
    build_owner_agent_tool_registry,
    morning_briefing_from_payload,
    persist_run_artifacts,
)
from agent_runtime.cli import main as runtime_cli_main
from agent_runtime.providers.policy import END_DAY_TOOL_NAME
from agent_runtime.tools import DEFAULT_OWNER_AGENT_CORE_TOOLS
from control_api import (
    AdvanceDayResult,
    AdvanceDayStep,
    GlobalMarketState,
    MarketSnapshot,
    MarketTrend,
    SimulationDay,
    TaxonomyMarketSnapshot,
    TrendState,
)


def page_payload(results):
    return {
        "count": len(results),
        "limit": len(results),
        "offset": 0,
        "results": list(results),
    }


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


class FakeLiveSellerCoreClient(FakeSellerCoreClient):
    def __init__(
        self,
        *,
        shop: dict[str, object],
        listings: list[dict[str, object]],
        orders: list[dict[str, object]],
        reviews: list[dict[str, object]],
        payments: list[dict[str, object]],
    ) -> None:
        super().__init__()
        self.shop = dict(shop)
        self.listings = [dict(item) for item in listings]
        self.orders = [dict(item) for item in orders]
        self.reviews = [dict(item) for item in reviews]
        self.payments = [dict(item) for item in payments]
        self.state_calls: list[tuple[str, dict[str, object]]] = []

    def get_shop_info(self, *, shop_id):
        self.state_calls.append(("get_shop_info", {"shop_id": shop_id}))
        return dict(self.shop)

    def get_shop_listings(self, *, shop_id, limit=100, offset=0, **kwargs):
        self.state_calls.append(
            ("get_shop_listings", {"shop_id": shop_id, "limit": limit, "offset": offset, **kwargs})
        )
        return page_payload(self.listings[offset : offset + limit])

    def get_orders(self, *, shop_id, limit=100, offset=0, **kwargs):
        self.state_calls.append(
            ("get_orders", {"shop_id": shop_id, "limit": limit, "offset": offset, **kwargs})
        )
        return page_payload(self.orders[offset : offset + limit])

    def get_reviews(self, *, shop_id, limit=100, offset=0, **kwargs):
        self.state_calls.append(
            ("get_reviews", {"shop_id": shop_id, "limit": limit, "offset": offset, **kwargs})
        )
        return page_payload(self.reviews[offset : offset + limit])

    def get_payments(self, *, shop_id):
        self.state_calls.append(("get_payments", {"shop_id": shop_id}))
        return page_payload(self.payments)


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


class FakeRunner:
    def __init__(self, result: object) -> None:
        self.result = result
        self.received_briefings = []
        self.live_day_calls = []
        self.live_days_calls = []

    def run_day(self, briefing):
        self.received_briefings.append(briefing)
        return self.result

    def run_live_day(self, *, shop_id, run_id=None):
        self.live_day_calls.append({"shop_id": shop_id, "run_id": run_id})
        return self.result

    def run_live_days(self, *, shop_id, days, run_id=None):
        self.live_days_calls.append({"shop_id": shop_id, "days": days, "run_id": run_id})
        return self.result


class FakeControlApiClient:
    def __init__(self, market_states: list[GlobalMarketState]) -> None:
        self.market_states = list(market_states)
        self.index = 0
        self.advance_calls = 0

    def get_global_market_state(self) -> GlobalMarketState:
        return self.market_states[self.index]

    def advance_day(self) -> AdvanceDayResult:
        previous = self.market_states[self.index]
        self.advance_calls += 1
        if self.index < len(self.market_states) - 1:
            self.index += 1
        current = self.market_states[self.index]
        return AdvanceDayResult(
            previous_day=previous.current_day,
            current_day=current.current_day,
            market_snapshot=current.market_snapshot,
            trend_state=current.trend_state,
            steps=(
                AdvanceDayStep(
                    name="advance_clock",
                    description="Increment the simulation day.",
                ),
            ),
        )


def build_market_state(day: int, date: str, *, label: str, taxonomy_id: int) -> GlobalMarketState:
    return GlobalMarketState(
        current_day=SimulationDay(day=day, date=date, advanced_at=None),
        market_snapshot=MarketSnapshot(
            generated_at=date,
            active_listing_count=3,
            active_shop_count=2,
            average_active_price=9.5,
            taxonomy=(
                TaxonomyMarketSnapshot(
                    taxonomy_id=taxonomy_id,
                    listing_count=2,
                    average_price=11.5,
                    demand_multiplier=1.3,
                ),
            ),
        ),
        trend_state=TrendState(
            generated_at=date,
            baseline_multiplier=1.0,
            active_trends=(
                MarketTrend(
                    trend_id=f"trend-{day}",
                    label=label,
                    taxonomy_id=taxonomy_id,
                    tags=("mushroom", "planner"),
                    demand_multiplier=1.3,
                ),
            ),
        ),
    )


def build_reference_multiday_result():
    seller_client = FakeLiveSellerCoreClient(
        shop={
            "shop_id": 1001,
            "shop_name": "northwind-printables",
            "currency_code": "USD",
            "listing_active_count": 1,
            "total_sales_count": 5,
            "review_average": 4.8,
            "review_count": 3,
        },
        listings=[
            {
                "listing_id": 2001,
                "title": "Mushroom Cottage Printable Wall Art",
                "state": "active",
                "price": 14.0,
                "quantity": 999,
                "views": 140,
                "favorites": 36,
                "updated_at": "2026-02-28T08:00:00Z",
            }
        ],
        orders=[],
        reviews=[],
        payments=[],
    )
    control_client = FakeControlApiClient(
        [
            build_market_state(3, "2026-02-28T00:00:00Z", label="Wall Art", taxonomy_id=9101),
            build_market_state(4, "2026-03-01T00:00:00Z", label="Planner", taxonomy_id=9102),
        ]
    )
    provider = RecordingProvider(
        [
            ProviderResponse(
                content="Check the shop info first.",
                tool_calls=(
                    ProviderToolCall(
                        name="get_shop_info",
                        arguments={},
                    ),
                ),
            ),
            ProviderResponse(
                content="",
                tool_calls=(
                    ProviderToolCall(
                        name=END_DAY_TOOL_NAME,
                        arguments={"summary": "Day three is complete."},
                    ),
                ),
            ),
            ProviderResponse(
                content="Capture the trend note for tomorrow.",
                tool_calls=(
                    ProviderToolCall(
                        name="write_note",
                        arguments={
                            "title": "Trend watch",
                            "body": "Planner demand is rotating up.",
                            "day": 4,
                        },
                    ),
                ),
            ),
            ProviderResponse(
                content="",
                tool_calls=(
                    ProviderToolCall(
                        name=END_DAY_TOOL_NAME,
                        arguments={"summary": "Day four is complete."},
                    ),
                ),
            ),
        ]
    )
    runner = build_default_owner_agent_runner(
        max_turns=4,
        memory=InMemoryAgentMemory(),
        event_log=InMemoryEventLog(),
        policy_config=ProviderPolicyConfig(),
        mistral_api_key="unused",
    )
    runner = type(runner)(
        provider=provider,
        seller_client=seller_client,
        control_client=control_client,
        memory=InMemoryAgentMemory(),
        event_log=InMemoryEventLog(),
    )
    return runner.run_live_days(shop_id=1001, days=2, run_id="run_multi_day")


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

    def test_briefing_round_trips_from_json_payload(self) -> None:
        briefing = morning_briefing_from_payload(
            {
                "run_id": "run_roundtrip",
                "shop_id": 7,
                "shop_name": "Studio North",
                "day": 3,
                "generated_at": "2026-02-28T10:00:00+00:00",
                "balance_summary": {
                    "available": 142.5,
                    "pending": 20.0,
                    "currency_code": "USD",
                },
                "yesterday_orders": {
                    "order_count": 2,
                    "revenue": 24.0,
                    "average_order_value": 12.0,
                },
                "listing_changes": [
                    {
                        "listing_id": 1001,
                        "title": "Mushroom Planner",
                        "state": "active",
                        "views_delta": 12,
                    }
                ],
                "objective_progress": {
                    "primary_objective": "Grow ending balance",
                    "metric_name": "ending_balance",
                    "current_value": 142.5,
                    "target_value": 200.0,
                    "status_summary": "Trending upward.",
                },
                "due_reminders": [
                    {
                        "reminder_id": "rem_1",
                        "shop_id": 7,
                        "content": "Check floral planner pricing.",
                        "due_day": 3,
                        "status": "pending",
                        "created_at": "2026-02-27T09:00:00+00:00",
                    }
                ],
            }
        )

        self.assertEqual(briefing.shop_id, 7)
        self.assertEqual(briefing.listing_changes[0].listing_id, 1001)
        self.assertEqual(briefing.due_reminders[0].reminder_id, "rem_1")

    def test_live_builder_builds_briefing_from_live_state(self) -> None:
        memory = InMemoryAgentMemory()
        memory.write_note(
            shop_id=1001,
            title="Pricing angle",
            body="Keep the planner close to the trend tags.",
            day=3,
        )
        memory.set_reminder(
            shop_id=1001,
            content="Review whether the planner draft should go live.",
            due_day=4,
            day=3,
        )
        seller_client = FakeLiveSellerCoreClient(
            shop={
                "shop_id": 1001,
                "shop_name": "northwind-printables",
                "currency_code": "USD",
                "listing_active_count": 1,
                "total_sales_count": 5,
                "review_average": 4.8,
                "review_count": 3,
            },
            listings=[
                {
                    "listing_id": 2001,
                    "title": "Mushroom Cottage Printable Wall Art",
                    "state": "active",
                    "price": 14.0,
                    "quantity": 999,
                    "views": 140,
                    "favorites": 36,
                    "updated_at": "2026-02-28T08:00:00Z",
                },
                {
                    "listing_id": 2002,
                    "title": "Minimal Focus Planner",
                    "state": "draft",
                    "price": 9.0,
                    "quantity": 999,
                    "views": 12,
                    "favorites": 2,
                    "updated_at": "2026-02-28T08:10:00Z",
                },
            ],
            orders=[
                {
                    "receipt_id": 5004,
                    "shop_id": 1001,
                    "status": "paid",
                    "was_paid": True,
                    "total_price": 14.0,
                    "created_at": "2026-02-28T12:00:00Z",
                    "line_items": [
                        {
                            "listing_id": 2001,
                            "title": "Mushroom Cottage Printable Wall Art",
                            "quantity": 1,
                            "price": 14.0,
                        }
                    ],
                }
            ],
            reviews=[
                {
                    "review_id": 7004,
                    "listing_id": 2001,
                    "rating": 5,
                    "review": "Printed beautifully.",
                    "buyer_name": "Ava Chen",
                    "created_at": "2026-02-28T15:00:00Z",
                }
            ],
            payments=[
                {
                    "payment_id": 8001,
                    "receipt_id": 5001,
                    "amount": 32.0,
                    "currency_code": "USD",
                    "status": "posted",
                    "posted_at": "2026-02-27T10:00:00Z",
                }
            ],
        )
        control_client = FakeControlApiClient(
            [build_market_state(4, "2026-03-01T00:00:00Z", label="Wall Art", taxonomy_id=9101)]
        )
        builder = LiveMorningBriefingBuilder(
            seller_client=seller_client,
            control_client=control_client,
            memory=memory,
        )
        previous_state = ShopStateSnapshot(
            shop_id=1001,
            shop_name="northwind-printables",
            day=3,
            simulation_date="2026-02-28T00:00:00Z",
            balance_summary=BalanceSummary(available=32.0),
            total_sales_count=4,
            review_count=2,
            review_average=4.5,
            active_listing_count=1,
            draft_listing_count=1,
            listings=(
                ListingSnapshot(
                    listing_id=2001,
                    title="Mushroom Cottage Printable Wall Art",
                    state="active",
                    price=14.0,
                    quantity=999,
                    views=120,
                    favorites=30,
                    updated_at="2026-02-27T08:00:00Z",
                ),
                ListingSnapshot(
                    listing_id=2002,
                    title="Minimal Focus Planner",
                    state="draft",
                    price=9.0,
                    quantity=999,
                    views=10,
                    favorites=2,
                    updated_at="2026-02-27T08:10:00Z",
                ),
            ),
        )

        result = builder.build(
            run_id="run_live_briefing",
            shop_id=1001,
            previous_shop_state=previous_state,
        )

        self.assertEqual(result.briefing.shop_name, "northwind-printables")
        self.assertEqual(result.briefing.day, 4)
        self.assertEqual(result.briefing.balance_summary.available, 32.0)
        self.assertEqual(result.briefing.balance_summary.pending, 14.0)
        self.assertEqual(result.briefing.yesterday_orders.order_count, 1)
        self.assertEqual(result.briefing.new_reviews[0].review_id, 7004)
        self.assertEqual(result.briefing.listing_changes[0].views_delta, 20)
        self.assertEqual(result.briefing.listing_changes[0].orders_delta, 1)
        self.assertEqual(len(result.briefing.due_reminders), 1)
        self.assertEqual(result.briefing.market_movements[0].headline, "Trend watch: Wall Art")
        self.assertIn("Pricing angle", result.briefing.notes[0])
        self.assertEqual(result.shop_state.active_listing_count, 1)


class ToolRegistryTests(unittest.TestCase):
    def test_owner_registry_wraps_core_tools_and_memory_extensions(self) -> None:
        client = FakeSellerCoreClient()
        memory = InMemoryAgentMemory()
        registry = build_owner_agent_tool_registry(client, memory=memory, shop_id=7)

        tool_names = {entry.name for entry in registry.manifest()}
        self.assertIn("search_marketplace", tool_names)
        self.assertIn("write_note", tool_names)
        self.assertIn("set_reminder", tool_names)
        self.assertIn("complete_reminder", tool_names)

        core_result = registry.invoke("search_marketplace", {"keywords": "mushroom planner"})
        shop_result = registry.invoke("get_shop_info", {})
        note_result = registry.invoke(
            "write_note",
            {
                "title": "Today's angle",
                "body": "Lean into mushroom planner keywords.",
                "tags": ["seo"],
                "day": 3,
            },
        )
        reminder_result = registry.invoke(
            "set_reminder",
            {
                "content": "Review conversion on the mushroom planner.",
                "due_day": 4,
                "day": 3,
            },
        )
        notes_result = registry.invoke("read_notes", {})

        self.assertEqual(
            client.calls,
            [
                ("search_marketplace", {"keywords": "mushroom planner"}),
                ("get_shop_info", {"shop_id": 7}),
            ],
        )
        self.assertEqual(core_result.output["tool_name"], "search_marketplace")
        self.assertEqual(shop_result.output["arguments"]["shop_id"], 7)
        self.assertEqual(note_result.output["note"]["title"], "Today's angle")
        self.assertEqual(note_result.output["note"]["shop_id"], 7)
        self.assertEqual(reminder_result.output["reminder"]["due_day"], 4)
        self.assertEqual(notes_result.output["count"], 1)

    def test_owner_registry_rejects_attempts_to_override_bound_shop_id(self) -> None:
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
            shop_id=7,
        )

        with self.assertRaisesRegex(ValueError, "shop_id is bound to 7"):
            registry.invoke("write_note", {"shop_id": 8, "title": "Wrong", "body": "nope"})

    def test_registry_manifest_includes_parameter_schemas_for_provider_use(self) -> None:
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
            shop_id=7,
        )

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
            ["title", "body"],
        )
        self.assertNotIn("shop_id", manifests["write_note"].parameters_schema["properties"])
        self.assertNotIn("shop_id", manifests["get_shop_info"].parameters_schema["properties"])

    def test_completed_reminders_stop_showing_up_in_future_briefings(self) -> None:
        memory = InMemoryAgentMemory()
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=memory,
            shop_id=7,
        )
        reminder = registry.invoke(
            "set_reminder",
            {"content": "Review planner pricing.", "due_day": 3, "day": 1},
        ).output["reminder"]
        builder = MorningBriefingBuilder(memory)
        common = {
            "run_id": "run_reminders",
            "shop_id": 7,
            "shop_name": "Studio North",
            "balance_summary": BalanceSummary(available=120.0),
            "yesterday_orders": OrderSummary(order_count=0, revenue=0.0),
            "objective_progress": ObjectiveProgress(
                primary_objective="Grow ending balance",
                metric_name="ending_balance",
                current_value=120.0,
                status_summary="Need a stronger conversion day.",
            ),
        }

        self.assertEqual(len(builder.build(day=3, **common).due_reminders), 1)
        completed = registry.invoke(
            "complete_reminder",
            {"reminder_id": reminder["reminder_id"]},
        )
        self.assertEqual(completed.output["reminder"]["status"], "completed")
        self.assertEqual(len(builder.build(day=4, **common).due_reminders), 0)


class DailyLoopTests(unittest.TestCase):
    def test_single_shop_loop_runs_one_tool_per_turn_and_logs_note_writes(self) -> None:
        client = FakeSellerCoreClient()
        memory = InMemoryAgentMemory()
        registry = build_owner_agent_tool_registry(client, memory=memory, shop_id=7)
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
        registry = build_owner_agent_tool_registry(client, memory=InMemoryAgentMemory(), shop_id=7)
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
            shop_id=7,
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


class OwnerAgentRunnerTests(unittest.TestCase):
    def test_default_runner_wires_provider_policy_and_loop(self) -> None:
        seller_client = FakeSellerCoreClient()
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="Check the shop health before browsing the market.",
                    tool_calls=(
                        ProviderToolCall(
                            name="get_shop_info",
                            arguments={},
                        ),
                    ),
                ),
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name=END_DAY_TOOL_NAME,
                            arguments={"summary": "That is enough for today."},
                        ),
                    ),
                ),
            ]
        )
        briefing = morning_briefing_from_payload(
            {
                "run_id": "run_owner",
                "shop_id": 7,
                "shop_name": "Studio North",
                "day": 5,
                "balance_summary": {"available": 150.0},
                "yesterday_orders": {"order_count": 1, "revenue": 12.0},
                "objective_progress": {
                    "primary_objective": "Grow ending balance",
                    "metric_name": "ending_balance",
                    "current_value": 150.0,
                    "status_summary": "Steady but slow growth.",
                },
            }
        )
        runner = build_default_owner_agent_runner(
            max_turns=4,
            memory=InMemoryAgentMemory(),
            event_log=InMemoryEventLog(),
            policy_config=ProviderPolicyConfig(),
            mistral_api_key="unused",
        )
        runner = type(runner)(
            provider=provider,
            seller_client=seller_client,
            memory=InMemoryAgentMemory(),
            event_log=InMemoryEventLog(),
        )

        result = runner.run_day(briefing)

        self.assertEqual(result.end_reason, DayEndReason.AGENT_ENDED_DAY)
        self.assertEqual(len(result.turns), 1)
        self.assertEqual(seller_client.calls, [("get_shop_info", {"shop_id": 7})])

    def test_runner_can_execute_multiple_live_days_and_advance_simulation(self) -> None:
        seller_client = FakeLiveSellerCoreClient(
            shop={
                "shop_id": 1001,
                "shop_name": "northwind-printables",
                "currency_code": "USD",
                "listing_active_count": 1,
                "total_sales_count": 5,
                "review_average": 4.8,
                "review_count": 3,
            },
            listings=[
                {
                    "listing_id": 2001,
                    "title": "Mushroom Cottage Printable Wall Art",
                    "state": "active",
                    "price": 14.0,
                    "quantity": 999,
                    "views": 140,
                    "favorites": 36,
                    "updated_at": "2026-02-28T08:00:00Z",
                }
            ],
            orders=[],
            reviews=[],
            payments=[],
        )
        control_client = FakeControlApiClient(
            [
                build_market_state(3, "2026-02-28T00:00:00Z", label="Wall Art", taxonomy_id=9101),
                build_market_state(4, "2026-03-01T00:00:00Z", label="Planner", taxonomy_id=9102),
            ]
        )
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="Check the shop info first.",
                    tool_calls=(
                        ProviderToolCall(
                            name="get_shop_info",
                            arguments={},
                        ),
                    ),
                ),
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name=END_DAY_TOOL_NAME,
                            arguments={"summary": "Day three is complete."},
                        ),
                    ),
                ),
                ProviderResponse(
                    content="Capture the trend note for tomorrow.",
                    tool_calls=(
                        ProviderToolCall(
                            name="write_note",
                            arguments={
                                "title": "Trend watch",
                                "body": "Planner demand is rotating up.",
                                "day": 4,
                            },
                        ),
                    ),
                ),
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name=END_DAY_TOOL_NAME,
                            arguments={"summary": "Day four is complete."},
                        ),
                    ),
                ),
            ]
        )
        runner = build_default_owner_agent_runner(
            max_turns=4,
            memory=InMemoryAgentMemory(),
            event_log=InMemoryEventLog(),
            policy_config=ProviderPolicyConfig(),
            mistral_api_key="unused",
        )
        runner = type(runner)(
            provider=provider,
            seller_client=seller_client,
            control_client=control_client,
            memory=InMemoryAgentMemory(),
            event_log=InMemoryEventLog(),
        )

        result = runner.run_live_days(shop_id=1001, days=2, run_id="run_multi_day")

        self.assertEqual(len(result.days), 2)
        self.assertEqual(result.days[0].day, 3)
        self.assertEqual(result.days[1].day, 4)
        self.assertIsNotNone(result.days[0].advancement)
        self.assertIsNone(result.days[1].advancement)
        self.assertEqual(control_client.advance_calls, 1)
        self.assertEqual(result.days[1].market_state_before.current_day.day, 4)
        self.assertEqual(seller_client.calls, [("get_shop_info", {"shop_id": 1001})])
        self.assertEqual(len(result.notes), 1)
        self.assertEqual(result.notes[0].title, "Trend watch")
        self.assertIn(
            "simulation_advanced",
            [event.kind.value for event in result.events],
        )


class RuntimeCliTests(unittest.TestCase):
    def test_run_day_command_loads_briefing_and_emits_json(self) -> None:
        fake_runner = FakeRunner(
            {
                "run_id": "run_cli",
                "end_reason": "agent_ended_day",
            }
        )
        stdout = StringIO()
        briefing_payload = {
            "run_id": "run_cli",
            "shop_id": 7,
            "shop_name": "Studio North",
            "day": 3,
            "balance_summary": {"available": 100.0},
            "yesterday_orders": {"order_count": 1, "revenue": 12.0},
            "objective_progress": {
                "primary_objective": "Grow ending balance",
                "metric_name": "ending_balance",
                "current_value": 100.0,
                "status_summary": "Early stage.",
            },
        }

        with patch("agent_runtime.cli.build_default_owner_agent_runner", return_value=fake_runner):
            with patch("sys.stdout", stdout):
                exit_code = runtime_cli_main(
                    ["run-day", "--briefing", json.dumps(briefing_payload)]
                )

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["result"]["run_id"], "run_cli")
        self.assertEqual(fake_runner.received_briefings[0].shop_name, "Studio North")

    def test_run_days_command_executes_live_multi_day_flow(self) -> None:
        fake_runner = FakeRunner(
            {
                "run_id": "run_live_cli",
                "days": [
                    {"day": 3},
                    {"day": 4},
                ],
            }
        )
        stdout = StringIO()

        with patch("agent_runtime.cli.build_default_owner_agent_runner", return_value=fake_runner):
            with patch("sys.stdout", stdout):
                exit_code = runtime_cli_main(
                    ["run-days", "--shop-id", "1001", "--days", "2", "--run-id", "run_live_cli"]
                )

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["result"]["run_id"], "run_live_cli")
        self.assertEqual(fake_runner.live_days_calls[0]["shop_id"], 1001)
        self.assertEqual(fake_runner.live_days_calls[0]["days"], 2)

    def test_run_days_command_persists_artifacts_for_runtime_results(self) -> None:
        fake_runner = FakeRunner(build_reference_multiday_result())
        stdout = StringIO()

        with TemporaryDirectory() as tmpdir:
            with patch(
                "agent_runtime.cli.build_default_owner_agent_runner",
                return_value=fake_runner,
            ):
                with patch("sys.stdout", stdout):
                    exit_code = runtime_cli_main(
                        [
                            "run-days",
                            "--shop-id",
                            "1001",
                            "--days",
                            "2",
                            "--run-id",
                            "run_multi_day",
                            "--output-dir",
                            tmpdir,
                        ]
                    )

            self.assertEqual(exit_code, 0)
            payload = json.loads(stdout.getvalue())
            self.assertTrue(payload["ok"])
            self.assertEqual(
                payload["artifacts"]["output_dir"],
                str(Path(tmpdir).resolve()),
            )
            self.assertTrue((Path(tmpdir) / "summary.md").exists())
            self.assertTrue((Path(tmpdir) / "days" / "day-0003" / "summary.md").exists())


class RunArtifactTests(unittest.TestCase):
    def test_persist_run_artifacts_writes_reference_run_layout(self) -> None:
        result = build_reference_multiday_result()

        with TemporaryDirectory() as tmpdir:
            bundle = persist_run_artifacts(
                result,
                output_dir=tmpdir,
                invocation={"command": "run-days", "shop_id": 1001, "days": 2},
            )

            root = Path(bundle.output_dir)
            summary_payload = json.loads((root / "summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary_payload["run_id"], "run_multi_day")
            self.assertEqual(summary_payload["totals"]["tool_calls_by_name"]["get_shop_info"], 1)
            self.assertEqual(summary_payload["totals"]["tool_calls_by_name"]["write_note"], 1)

            self.assertIn(
                "human-readable run summary",
                (root / "README.md").read_text(encoding="utf-8"),
            )
            self.assertIn(
                "Day 3 Summary",
                (root / "days" / "day-0003" / "summary.md").read_text(encoding="utf-8"),
            )
            self.assertIn(
                "get_shop_info",
                (root / "days" / "day-0003" / "summary.md").read_text(encoding="utf-8"),
            )
            self.assertTrue((root / "events.jsonl").exists())
            self.assertTrue((root / "memory" / "notes.json").exists())
            self.assertTrue((root / "days" / "day-0003" / "briefing.md").exists())
            self.assertTrue((root / "days" / "day-0003" / "advancement.json").exists())
            self.assertTrue((root / "days" / "day-0004" / "state_after.json").exists())


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
