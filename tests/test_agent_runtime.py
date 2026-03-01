from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
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
    OwnerAgentRunner,
    OwnerAgentRunnerConfig,
    OrderSummary,
    ProviderMessage,
    ProviderMessageRole,
    ProviderPolicyConfig,
    ProviderResponse,
    ProviderToolCall,
    ProviderToolDefinition,
    ArenaTournamentRunner,
    SingleShopDailyLoop,
    ShopStateSnapshot,
    TournamentConfig,
    TournamentEntrant,
    TournamentEntrantConfig,
    ToolCallingAgentPolicy,
    ToolCall,
    ToolExecutionResult,
    TurnRecord,
    WorkspaceEntryRecord,
    WorkspaceRecord,
    WorkSessionState,
    build_default_owner_agent_runner,
    build_owner_agent_tool_registry,
    load_tournament_entrants_from_payload,
    morning_briefing_from_payload,
)
from agent_runtime.artifacts import persist_run_artifacts
from agent_runtime.cli import main as runtime_cli_main
from agent_runtime.providers.policy import END_DAY_TOOL_NAME
from agent_runtime.tools import (
    DEFAULT_OWNER_AGENT_CORE_TOOLS,
    DEFAULT_OWNER_AGENT_EXTENSION_TOOLS,
    DEFAULT_OWNER_AGENT_SELLER_TOOLS,
)
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
        for name in DEFAULT_OWNER_AGENT_SELLER_TOOLS:
            entry = {
                "tool_name": name,
                "operation_id": name,
                "description": f"Stub manifest entry for {name}.",
                "surface": "core" if name in DEFAULT_OWNER_AGENT_CORE_TOOLS else "extension",
                "path_params": [],
                "query_params": [],
                "required_body_fields": [],
                "body_encoding": "none",
                "scopes": [],
                "notes": [],
            }
            if name == "search_marketplace":
                entry["query_params"] = ["keywords", "limit", "offset"]
            elif name in {"get_shop_info", "get_capacity_status"}:
                entry["path_params"] = ["shop_id"]
            elif name == "queue_production":
                entry["path_params"] = ["shop_id"]
                entry["required_body_fields"] = ["listing_id", "units"]
            manifest.append(entry)
        return manifest

    def tool_manifest(self, *, surfaces=None):
        manifest = self.manifest()
        if surfaces is None:
            return manifest
        surface_names = {surface.value if hasattr(surface, "value") else surface for surface in surfaces}
        return [item for item in manifest if item["surface"] in surface_names]

    def call(self, tool_name: str, arguments: dict[str, object]) -> dict[str, object]:
        copied = dict(arguments)
        self.calls.append((tool_name, copied))
        method = getattr(self, tool_name, None)
        if callable(method):
            return method(**copied)
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

    def get_capacity_status(self, *, shop_id):
        self.state_calls.append(("get_capacity_status", {"shop_id": shop_id}))
        queue_depth = int(self.shop.get("queue_depth", 0))
        queued_stock_units = int(self.shop.get("queued_stock_units", 0))
        queued_customer_order_units = int(self.shop.get("queued_customer_order_units", 0))
        backlog_units = int(self.shop.get("backlog_units", 0))
        return {
            "shop_id": shop_id,
            "generated_at": self.shop.get("generated_at", "2026-03-01T00:00:00Z"),
            "production_capacity_per_day": int(self.shop.get("production_capacity_per_day", 0)),
            "backlog_units": backlog_units,
            "queue_depth": queue_depth,
            "queued_stock_units": queued_stock_units,
            "queued_customer_order_units": queued_customer_order_units,
            "listings": [
                {
                    "listing_id": item.get("listing_id", 0),
                    "title": item.get("title", ""),
                    "state": item.get("state", "draft"),
                    "fulfillment_mode": item.get("fulfillment_mode", "stocked"),
                    "quantity_on_hand": item.get("quantity_on_hand", item.get("quantity", 0)),
                    "backlog_units": item.get("backlog_units", 0),
                    "queued_stock_units": item.get("queued_stock_units", 0),
                    "queued_customer_order_units": item.get("queued_customer_order_units", 0),
                    "capacity_units_per_item": item.get("capacity_units_per_item", 1),
                    "lead_time_days": item.get("lead_time_days", 1),
                }
                for item in self.listings
            ],
        }

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
        self.tournament_calls = []

    def run_day(self, briefing):
        self.received_briefings.append(briefing)
        return self.result

    def run_live_day(self, *, shop_id, run_id=None, reset_world=False):
        self.live_day_calls.append({"shop_id": shop_id, "run_id": run_id, "reset_world": reset_world})
        return self.result

    def run_live_days(self, *, shop_id, days, run_id=None, reset_world=False):
        self.live_days_calls.append(
            {"shop_id": shop_id, "days": days, "run_id": run_id, "reset_world": reset_world}
        )
        return self.result

    def run(self, *, entrants, shop_ids, run_id=None):
        self.tournament_calls.append(
            {"entrants": entrants, "shop_ids": shop_ids, "run_id": run_id}
        )
        return self.result


class FakeControlApiClient:
    def __init__(self, market_states: list[GlobalMarketState]) -> None:
        self.market_states = list(market_states)
        self.index = 0
        self.advance_calls = 0
        self.reset_calls = 0

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

    def reset_world(self) -> None:
        self.reset_calls += 1
        self.index = 0


class FakeTournamentControlApiClient:
    def __init__(self, market_states: list[GlobalMarketState]) -> None:
        self.market_states = list(market_states)
        self.index = 0
        self.advance_calls = 0
        self.replace_calls = 0

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

    def get_world_state(self):
        return {"cursor": self.index}

    def replace_world_state(self, state):
        self.replace_calls += 1
        self.index = int(state["cursor"])
        return {"cursor": self.index}


class FakeTournamentSellerCoreClient(FakeSellerCoreClient):
    def __init__(
        self,
        *,
        shops: dict[int, dict[str, object]],
        listings: dict[int, list[dict[str, object]]],
        payments: dict[int, list[dict[str, object]]],
    ) -> None:
        super().__init__()
        self.shops = {shop_id: dict(value) for shop_id, value in shops.items()}
        self.listings = {
            shop_id: [dict(item) for item in values] for shop_id, values in listings.items()
        }
        self.payments = {
            shop_id: [dict(item) for item in values] for shop_id, values in payments.items()
        }
        self.state_calls: list[tuple[str, dict[str, object]]] = []

    def get_shop_info(self, *, shop_id):
        self.state_calls.append(("get_shop_info", {"shop_id": shop_id}))
        return dict(self.shops[shop_id])

    def get_shop_listings(self, *, shop_id, limit=100, offset=0, **kwargs):
        self.state_calls.append(
            ("get_shop_listings", {"shop_id": shop_id, "limit": limit, "offset": offset, **kwargs})
        )
        values = self.listings.get(shop_id, [])
        return page_payload(values[offset : offset + limit])

    def get_orders(self, *, shop_id, limit=100, offset=0, **kwargs):
        self.state_calls.append(
            ("get_orders", {"shop_id": shop_id, "limit": limit, "offset": offset, **kwargs})
        )
        return page_payload([])

    def get_reviews(self, *, shop_id, limit=100, offset=0, **kwargs):
        self.state_calls.append(
            ("get_reviews", {"shop_id": shop_id, "limit": limit, "offset": offset, **kwargs})
        )
        return page_payload([])

    def get_capacity_status(self, *, shop_id):
        self.state_calls.append(("get_capacity_status", {"shop_id": shop_id}))
        shop = self.shops[shop_id]
        return {
            "shop_id": shop_id,
            "generated_at": shop.get("generated_at", "2026-03-01T00:00:00Z"),
            "production_capacity_per_day": int(shop.get("production_capacity_per_day", 0)),
            "backlog_units": int(shop.get("backlog_units", 0)),
            "queue_depth": int(shop.get("queue_depth", 0)),
            "queued_stock_units": int(shop.get("queued_stock_units", 0)),
            "queued_customer_order_units": int(shop.get("queued_customer_order_units", 0)),
            "listings": [],
        }

    def get_payments(self, *, shop_id):
        self.state_calls.append(("get_payments", {"shop_id": shop_id}))
        return page_payload(self.payments.get(shop_id, []))


class TournamentStubProvider:
    def __init__(self, label: str) -> None:
        self.label = label

    def complete(self, *, messages, tools, tool_choice="auto", allow_parallel_tool_calls=False):
        tool_names = {tool.name for tool in tools}
        if "save_end_of_day_journal_entry" in tool_names:
            return ProviderResponse(
                content="",
                tool_calls=(
                    ProviderToolCall(
                        name="save_end_of_day_journal_entry",
                        arguments={"content": f"{self.label} notes the day."},
                    ),
                ),
            )

        return ProviderResponse(
            content=f"{self.label} ends the day cleanly.",
            tool_calls=(
                ProviderToolCall(
                    name=END_DAY_TOOL_NAME,
                    arguments={"summary": f"{self.label} ends the day."},
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


class MorningBriefingTests(unittest.TestCase):
    def test_builder_includes_due_reminders_in_briefing_payload(self) -> None:
        memory = InMemoryAgentMemory()
        memory.add_workspace_entry(
            shop_id=7,
            content="Woodwork might be worth a look if planners soften.",
            tags=("research",),
            day=2,
        )
        memory.update_workspace(
            shop_id=7,
            content="Watch woodwork demand if planners soften.",
            day=2,
        )
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
            simulation_date="2026-03-03T00:00:00Z",
            balance_summary=BalanceSummary(available=142.5, pending=20.0),
            yesterday_orders=OrderSummary(order_count=2, revenue=24.0, average_order_value=12.0),
            production_focus=("Backlog is at 2 units.",),
            workspace=memory.read_workspace(shop_id=7),
            recent_workspace_entries=memory.read_workspace_entries(shop_id=7, limit=3),
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
        self.assertEqual(payload["simulation_date"], "2026-03-03T00:00:00Z")
        self.assertEqual(
            payload["due_reminders"][0]["content"],
            "Check whether the floral planner needs repricing.",
        )
        rendered = briefing.render_for_agent()
        self.assertIn("# Studio North workday", rendered)
        self.assertIn("Date: 2026-03-03T00:00:00Z", rendered)
        self.assertIn("Production watch:", rendered)
        self.assertIn("## Scratchpad", rendered)
        self.assertIn("Watch woodwork demand if planners soften.", rendered)
        self.assertIn("## Recent journal entries", rendered)
        self.assertIn("Woodwork might be worth a look if planners soften.", rendered)
        self.assertIn("Reminders due:", rendered)
        self.assertIn("Check whether the floral planner needs repricing.", rendered)

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
                "workspace": {
                    "shop_id": 7,
                    "content": "Review pricing before touching the listing copy.",
                    "revision": 2,
                    "updated_day": 3,
                    "updated_at": "2026-02-28T08:30:00+00:00",
                },
                "recent_workspace_entries": [
                    {
                        "entry_id": "ws_entry_1",
                        "shop_id": 7,
                        "content": "Conversion improved after the last price cut.",
                        "tags": ["pricing"],
                        "created_day": 2,
                        "created_at": "2026-02-27T09:30:00+00:00",
                    }
                ],
            }
        )

        self.assertEqual(briefing.shop_id, 7)
        self.assertEqual(briefing.listing_changes[0].listing_id, 1001)
        self.assertEqual(briefing.due_reminders[0].reminder_id, "rem_1")
        self.assertEqual(briefing.workspace.revision, 2)
        self.assertEqual(briefing.recent_workspace_entries[0].entry_id, "ws_entry_1")

    def test_live_builder_builds_briefing_from_live_state(self) -> None:
        memory = InMemoryAgentMemory()
        memory.add_workspace_entry(
            shop_id=1001,
            content="Keep the planner close to the trend tags.",
            tags=("pricing",),
            day=3,
        )
        memory.update_workspace(
            shop_id=1001,
            content="Current strategy: activate the draft and watch capacity.",
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
                "production_capacity_per_day": 6,
                "backlog_units": 1,
                "queue_depth": 1,
                "queued_customer_order_units": 1,
            },
            listings=[
                {
                    "listing_id": 2001,
                    "title": "Mushroom Cottage Printable Wall Art",
                    "state": "active",
                    "price": 14.0,
                    "quantity": 999,
                    "quantity_on_hand": 1,
                    "fulfillment_mode": "stocked",
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
                    "fulfillment_mode": "made_to_order",
                    "backlog_units": 1,
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
        self.assertEqual(result.briefing.simulation_date, "2026-03-01T00:00:00Z")
        self.assertEqual(result.briefing.balance_summary.available, 32.0)
        self.assertEqual(result.briefing.balance_summary.pending, 14.0)
        self.assertEqual(result.briefing.yesterday_orders.order_count, 1)
        self.assertEqual(result.briefing.new_reviews[0].review_id, 7004)
        self.assertEqual(result.briefing.listing_changes[0].views_delta, 20)
        self.assertEqual(result.briefing.listing_changes[0].orders_delta, 1)
        self.assertEqual(len(result.briefing.due_reminders), 1)
        self.assertEqual(result.briefing.market_movements[0].headline, "Trend watch: Wall Art")
        self.assertEqual(result.briefing.workspace.content, "Current strategy: activate the draft and watch capacity.")
        self.assertEqual(result.briefing.workspace.updated_day, 3)
        self.assertEqual(len(result.briefing.recent_workspace_entries), 1)
        self.assertEqual(
            result.briefing.recent_workspace_entries[0].content,
            "Keep the planner close to the trend tags.",
        )
        self.assertIn("Low-stock active listings", result.briefing.production_focus[0])
        self.assertEqual(result.shop_state.active_listing_count, 1)
        self.assertIn(("get_capacity_status", {"shop_id": 1001}), seller_client.state_calls)


class ToolRegistryTests(unittest.TestCase):
    def test_owner_registry_wraps_core_tools_and_memory_extensions(self) -> None:
        client = FakeSellerCoreClient()
        memory = InMemoryAgentMemory()
        registry = build_owner_agent_tool_registry(client, memory=memory, shop_id=7)

        tool_names = {entry.name for entry in registry.manifest()}
        self.assertIn("get_shop_dashboard", tool_names)
        self.assertIn("get_listing_details", tool_names)
        self.assertIn("search_marketplace", tool_names)
        self.assertIn("queue_production", tool_names)
        self.assertIn("read_scratchpad", tool_names)
        self.assertIn("update_scratchpad", tool_names)
        self.assertIn("add_journal_entry", tool_names)
        self.assertIn("read_journal_entries", tool_names)
        self.assertIn("set_reminder", tool_names)
        self.assertIn("complete_reminder", tool_names)
        self.assertNotIn("get_shop_info", tool_names)
        self.assertNotIn("get_shop_listings", tool_names)
        self.assertNotIn("get_capacity_status", tool_names)
        self.assertNotIn("update_shop", tool_names)
        self.assertNotIn("write_note", tool_names)

        core_result = registry.invoke("search_marketplace", {"keywords": "mushroom planner"})
        shop_result = registry.invoke("get_shop_dashboard", {})
        listing_result = registry.invoke("get_listing_details", {"listing_id": 2001})
        production_result = registry.invoke(
            "queue_production",
            {
                "listing_id": 2001,
                "units": 2,
            },
        )
        workspace_result = registry.invoke(
            "update_scratchpad",
            {
                "content": "Current plan: activate the draft and watch backlog.",
                "day": 3,
            },
        )
        entry_result = registry.invoke(
            "add_journal_entry",
            {
                "content": "Lean into mushroom planner keywords.",
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
        entries_result = registry.invoke("read_journal_entries", {})
        workspace_read_result = registry.invoke("read_scratchpad", {})

        self.assertEqual(
            client.calls,
            [
                ("search_marketplace", {"keywords": "mushroom planner"}),
                ("get_shop_info", {"shop_id": 7}),
                ("get_shop_listings", {"shop_id": 7, "limit": 100, "offset": 0}),
                ("get_orders", {"shop_id": 7, "limit": 5, "offset": 0}),
                ("get_reviews", {"shop_id": 7, "limit": 3, "offset": 0}),
                ("get_payments", {"shop_id": 7}),
                ("get_capacity_status", {"shop_id": 7}),
                ("get_listing", {"listing_id": 2001}),
                ("get_reviews", {"shop_id": 7, "listing_id": 2001, "limit": 3, "offset": 0}),
                ("get_capacity_status", {"shop_id": 7}),
                ("queue_production", {"listing_id": 2001, "units": 2, "shop_id": 7}),
            ],
        )
        self.assertEqual(core_result.output["tool_name"], "search_marketplace")
        self.assertEqual(shop_result.output["shop"]["shop_id"], 0)
        self.assertEqual(shop_result.output["catalog_summary"]["total_listings"], 0)
        self.assertEqual(listing_result.output["listing"]["listing_id"], 0)
        self.assertEqual(production_result.output["arguments"]["units"], 2)
        self.assertEqual(workspace_result.output["scratchpad"]["shop_id"], 7)
        self.assertEqual(workspace_result.output["scratchpad"]["revision"], 1)
        self.assertEqual(entry_result.output["journal_entry"]["shop_id"], 7)
        self.assertEqual(entry_result.output["journal_entry"]["tags"], ["seo"])
        self.assertEqual(
            workspace_read_result.output["scratchpad"]["content"],
            "Current plan: activate the draft and watch backlog.",
        )
        self.assertEqual(reminder_result.output["reminder"]["due_day"], 4)
        self.assertEqual(entries_result.output["count"], 1)

    def test_owner_registry_rejects_attempts_to_override_bound_shop_id(self) -> None:
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
            shop_id=7,
        )

        with self.assertRaisesRegex(ValueError, "arguments.shop_id is not allowed"):
            registry.invoke("update_scratchpad", {"shop_id": 8, "content": "nope"})

    def test_registry_manifest_includes_parameter_schemas_for_provider_use(self) -> None:
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
            shop_id=7,
        )

        manifests = {entry.name: entry for entry in registry.manifest()}
        self.assertEqual(
            manifests["get_shop_dashboard"].parameters_schema["type"],
            "object",
        )
        self.assertIn(
            "listing_id",
            manifests["get_listing_details"].parameters_schema["properties"],
        )
        self.assertEqual(
            manifests["read_scratchpad"].parameters_schema["required"],
            [],
        )
        self.assertEqual(
            manifests["update_scratchpad"].parameters_schema["required"],
            ["content"],
        )
        self.assertEqual(
            manifests["add_journal_entry"].parameters_schema["required"],
            ["content"],
        )
        self.assertEqual(manifests["update_listing"].work_cost, 1)
        self.assertEqual(manifests["add_journal_entry"].work_cost, 1)
        self.assertNotIn("shop_id", manifests["read_scratchpad"].parameters_schema["properties"])
        self.assertNotIn(
            "shop_id", manifests["update_scratchpad"].parameters_schema["properties"]
        )
        self.assertEqual(manifests["get_shop_dashboard"].parameters_schema["required"], [])
        self.assertEqual(
            manifests["queue_production"].surface,
            "extension",
        )
        self.assertEqual(
            manifests["queue_production"].parameters_schema["required"],
            ["listing_id", "units"],
        )

    def test_registry_rejects_unexpected_arguments_for_summary_tools(self) -> None:
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
            shop_id=7,
        )

        with self.assertRaisesRegex(ValueError, "arguments.unexpected is not allowed"):
            registry.invoke("get_shop_dashboard", {"unexpected": True})

    def test_workspace_queries_support_limit_tag_and_since_day(self) -> None:
        registry = build_owner_agent_tool_registry(
            FakeSellerCoreClient(),
            memory=InMemoryAgentMemory(),
            shop_id=7,
        )

        registry.invoke(
            "add_journal_entry",
            {"content": "Old pricing note.", "tags": ["pricing"], "day": 1},
        )
        registry.invoke(
            "add_journal_entry",
            {"content": "Queue check.", "tags": ["ops"], "day": 2},
        )
        registry.invoke(
            "add_journal_entry",
            {"content": "New pricing note.", "tags": ["pricing"], "day": 3},
        )

        result = registry.invoke(
            "read_journal_entries",
            {"limit": 1, "tag": "pricing", "since_day": 2},
        )

        self.assertEqual(result.output["count"], 1)
        self.assertEqual(
            result.output["journal_entries"][0]["content"], "New pricing note."
        )

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
    def test_single_shop_loop_runs_one_tool_per_turn_and_logs_workspace_entries(self) -> None:
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
                        "add_journal_entry",
                        {
                            "content": "If the retro planner stalls again, test a lower price.",
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
            config=DailyLoopConfig(turns_per_day=5),
        )

        result = loop.run_day(briefing=briefing, policy=policy)

        self.assertEqual(result.end_reason, DayEndReason.AGENT_ENDED_DAY)
        self.assertEqual(len(result.turns), 2)
        self.assertEqual(result.work_budget, 5)
        self.assertEqual(result.work_budget_spent, 2)
        self.assertEqual(result.work_budget_remaining, 3)
        self.assertEqual(policy.contexts[1].prior_turns[0].tool_call.name, "search_marketplace")
        self.assertEqual(policy.contexts[1].work_budget_remaining, 4)
        self.assertEqual(client.calls, [("search_marketplace", {"keywords": "mushroom planner"})])
        self.assertIn(
            "add_journal_entry",
            [turn.tool_result.tool_name for turn in result.turns if turn.tool_result],
        )
        event_kinds = [event.kind.value for event in result.events]
        self.assertIn("briefing_generated", event_kinds)
        self.assertIn("workspace_entry_added", event_kinds)
        self.assertEqual(event_kinds[-1], "day_ended")

    def test_daily_loop_stops_when_turns_are_exhausted(self) -> None:
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
            config=DailyLoopConfig(turns_per_day=1),
        )

        result = loop.run_day(briefing=briefing, policy=policy)

        self.assertEqual(result.end_reason, DayEndReason.TURNS_EXHAUSTED)
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
            session=WorkSessionState(
                turn_index=1,
                turns_completed=0,
                turns_per_day=5,
                turns_used=0,
                turns_remaining=5,
            ),
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
        user_prompt = provider.calls[0]["messages"][1].content
        self.assertIn("# Studio North workday", user_prompt)
        self.assertIn("Work slots: 5 left / 5 total", user_prompt)
        self.assertIn("read_scratchpad", user_prompt)
        self.assertIn("add_journal_entry", user_prompt)

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

    def test_tool_calling_policy_preserves_exact_same_day_tool_results_in_prompt(self) -> None:
        registry, briefing = self._make_context()
        dashboard_manifest = next(
            entry for entry in registry.manifest() if entry.name == "get_shop_dashboard"
        )
        prior_turn = TurnRecord(
            turn_index=1,
            decision_summary="Check the shop dashboard before acting.",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            tool_call=ToolCall("get_shop_dashboard", {}),
            tool_result=ToolExecutionResult(
                tool=dashboard_manifest,
                arguments={},
                output={
                    "shop": {"shop_id": 7, "shop_name": "Studio North"},
                    "alerts": ["Low stock risk: Mushroom Planter."],
                    "active_listings": [
                        {"listing_id": 2001, "title": "Mushroom Planter", "quantity_on_hand": 1}
                    ],
                },
            ),
        )
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="Inspect the listing that is low on stock.",
                    tool_calls=(
                        ProviderToolCall(
                            name="get_listing_details",
                            arguments={"listing_id": 2001},
                        ),
                    ),
                )
            ]
        )
        policy = ToolCallingAgentPolicy(provider)
        context = AgentTurnContext(
            run_id=briefing.run_id,
            briefing=briefing,
            session=WorkSessionState(
                turn_index=2,
                turns_completed=1,
                turns_per_day=5,
                turns_used=1,
                turns_remaining=4,
            ),
            available_tools=tuple(registry.manifest()),
            prior_turns=(prior_turn,),
        )

        policy.next_turn(context=context)

        user_prompt = provider.calls[0]["messages"][1].content
        self.assertIn("### Work slot 1", user_prompt)
        self.assertIn('"alerts": [', user_prompt)
        self.assertIn('"Low stock risk: Mushroom Planter."', user_prompt)
        self.assertIn('"listing_id": 2001', user_prompt)
        self.assertNotIn("1 item(s) returned.", user_prompt)


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
        memory = InMemoryAgentMemory()
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="Check the shop dashboard before browsing the market.",
                    tool_calls=(
                        ProviderToolCall(
                            name="get_shop_dashboard",
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
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name="save_end_of_day_journal_entry",
                            arguments={
                                "content": "The shop needs a clearer follow-up tomorrow."
                            },
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
            turns_per_day=4,
            memory=InMemoryAgentMemory(),
            event_log=InMemoryEventLog(),
            policy_config=ProviderPolicyConfig(),
            mistral_api_key="unused",
        )
        runner = type(runner)(
            provider=provider,
            seller_client=seller_client,
            memory=memory,
            event_log=InMemoryEventLog(),
        )

        result = runner.run_day(briefing)

        self.assertEqual(result.end_reason, DayEndReason.AGENT_ENDED_DAY)
        self.assertEqual(len(result.turns), 1)
        self.assertIsNotNone(result.day_workspace_entry)
        self.assertEqual(
            result.day_workspace_entry.content,
            "The shop needs a clearer follow-up tomorrow.",
        )
        self.assertIn("future self", provider.calls[2]["messages"][0].content)
        self.assertEqual(len(memory.list_workspace_entries(shop_id=7)), 1)
        self.assertEqual(
            memory.list_workspace_entries(shop_id=7)[0].content,
            "The shop needs a clearer follow-up tomorrow.",
        )
        self.assertIn(
            "workspace_entry_added",
            [event.kind.value for event in result.events],
        )
        self.assertEqual(
            seller_client.calls,
            [
                ("get_shop_info", {"shop_id": 7}),
                ("get_shop_listings", {"shop_id": 7, "limit": 100, "offset": 0}),
                ("get_orders", {"shop_id": 7, "limit": 5, "offset": 0}),
                ("get_reviews", {"shop_id": 7, "limit": 3, "offset": 0}),
                ("get_payments", {"shop_id": 7}),
                ("get_capacity_status", {"shop_id": 7}),
            ],
        )

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
                    content="Check the shop dashboard first.",
                    tool_calls=(
                        ProviderToolCall(
                            name="get_shop_dashboard",
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
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name="save_end_of_day_journal_entry",
                            arguments={
                                "content": "Woodwork is worth checking if current listings stall.",
                            },
                        ),
                    ),
                ),
                ProviderResponse(
                    content="Capture the trend entry for tomorrow.",
                    tool_calls=(
                        ProviderToolCall(
                            name="add_journal_entry",
                            arguments={
                                "content": "Planner demand is rotating up.",
                                "tags": ["trend"],
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
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name="save_end_of_day_journal_entry",
                            arguments={
                                "content": "The planner angle may be stronger than the current catalog mix.",
                            },
                        ),
                    ),
                ),
            ]
        )
        memory = InMemoryAgentMemory()
        memory.update_workspace(
            shop_id=1001,
            content="Current thesis: wall art may be stalling.",
            day=2,
        )
        runner = build_default_owner_agent_runner(
            turns_per_day=4,
            memory=memory,
            event_log=InMemoryEventLog(),
            policy_config=ProviderPolicyConfig(),
            mistral_api_key="unused",
        )
        runner = type(runner)(
            provider=provider,
            seller_client=seller_client,
            control_client=control_client,
            memory=memory,
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
        self.assertEqual(
            result.days[0].day_result.day_workspace_entry.content,
            "Woodwork is worth checking if current listings stall.",
        )
        self.assertEqual(
            result.days[1].day_result.day_workspace_entry.content,
            "The planner angle may be stronger than the current catalog mix.",
        )
        self.assertEqual(
            seller_client.calls,
            [
                ("get_shop_info", {"shop_id": 1001}),
                ("get_shop_listings", {"shop_id": 1001, "limit": 100, "offset": 0}),
                ("get_orders", {"shop_id": 1001, "limit": 5, "offset": 0}),
                ("get_reviews", {"shop_id": 1001, "limit": 3, "offset": 0}),
                ("get_payments", {"shop_id": 1001}),
                ("get_capacity_status", {"shop_id": 1001}),
            ],
        )
        self.assertEqual(len(result.workspace_entries), 3)
        self.assertEqual(
            result.workspace_entries[0].content,
            "Woodwork is worth checking if current listings stall.",
        )
        self.assertEqual(
            result.workspace_entries[1].content,
            "Planner demand is rotating up.",
        )
        self.assertEqual(
            result.workspace_entries[2].content,
            "The planner angle may be stronger than the current catalog mix.",
        )
        self.assertIsNotNone(result.workspace)
        self.assertEqual(
            result.workspace.content,
            "Current thesis: wall art may be stalling.",
        )
        self.assertEqual(len(result.workspace_revisions), 1)
        self.assertIn(
            "simulation_advanced",
            [event.kind.value for event in result.events],
        )

    def test_runner_can_reset_world_before_live_days(self) -> None:
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
        control_client.index = 1
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name=END_DAY_TOOL_NAME,
                            arguments={"summary": "Done."},
                        ),
                    ),
                ),
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name="save_end_of_day_journal_entry",
                            arguments={"content": "Reset smoke note."},
                        ),
                    ),
                ),
            ]
        )
        runner = build_default_owner_agent_runner(
            turns_per_day=4,
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

        result = runner.run_live_days(shop_id=1001, days=1, run_id="run_reset", reset_world=True)

        self.assertEqual(control_client.reset_calls, 1)
        self.assertEqual(result.days[0].day, 3)
        self.assertEqual(result.days[0].market_state_before.current_day.day, 3)

class TournamentModeTests(unittest.TestCase):
    def test_tournament_runner_rotates_shops_resets_world_and_aggregates_standings(self) -> None:
        seller_client = FakeTournamentSellerCoreClient(
            shops={
                1001: {
                    "shop_id": 1001,
                    "shop_name": "alpha-atelier",
                    "currency_code": "USD",
                    "listing_active_count": 1,
                    "total_sales_count": 12,
                    "review_average": 4.9,
                    "review_count": 8,
                },
                1002: {
                    "shop_id": 1002,
                    "shop_name": "beta-bench",
                    "currency_code": "USD",
                    "listing_active_count": 1,
                    "total_sales_count": 6,
                    "review_average": 4.4,
                    "review_count": 5,
                },
            },
            listings={
                1001: [
                    {
                        "listing_id": 2001,
                        "title": "High Margin Planter",
                        "state": "active",
                        "price": 32.0,
                        "quantity": 4,
                        "views": 120,
                        "favorites": 30,
                        "updated_at": "2026-02-28T08:00:00Z",
                    }
                ],
                1002: [
                    {
                        "listing_id": 2002,
                        "title": "Budget Desk Tray",
                        "state": "active",
                        "price": 18.0,
                        "quantity": 7,
                        "views": 80,
                        "favorites": 12,
                        "updated_at": "2026-02-28T08:00:00Z",
                    }
                ],
            },
            payments={
                1001: [
                    {
                        "payment_id": 7001,
                        "receipt_id": 5001,
                        "amount": 120.0,
                        "currency_code": "USD",
                    }
                ],
                1002: [
                    {
                        "payment_id": 7002,
                        "receipt_id": 5002,
                        "amount": 80.0,
                        "currency_code": "USD",
                    }
                ],
            },
        )
        control_client = FakeTournamentControlApiClient(
            [
                build_market_state(3, "2026-02-28T00:00:00Z", label="Planters", taxonomy_id=9101),
                build_market_state(4, "2026-03-01T00:00:00Z", label="Desk Goods", taxonomy_id=9102),
            ]
        )
        entrants = (
            TournamentEntrantConfig(
                entrant=TournamentEntrant(
                    entrant_id="mistral-medium",
                    display_name="Mistral Medium",
                    provider="mistral",
                    model="mistral-medium-latest",
                )
            ),
            TournamentEntrantConfig(
                entrant=TournamentEntrant(
                    entrant_id="mistral-small",
                    display_name="Mistral Small",
                    provider="mistral",
                    model="mistral-small-latest",
                )
            ),
        )

        def entrant_runner_factory(entrant: TournamentEntrantConfig):
            return OwnerAgentRunner(
                provider=TournamentStubProvider(entrant.entrant.display_name),
                seller_client=seller_client,
                control_client=control_client,
                memory=InMemoryAgentMemory(),
                event_log=InMemoryEventLog(),
                config=OwnerAgentRunnerConfig(turns_per_day=3),
            )

        runner = ArenaTournamentRunner(
            control_client=control_client,
            entrant_runner_factory=entrant_runner_factory,
            config=TournamentConfig(days_per_round=2, rounds=2),
        )

        result = runner.run(
            entrants=entrants,
            shop_ids=(1001, 1002),
            run_id="arena_suite",
        )

        self.assertEqual(result.run_id, "arena_suite")
        self.assertEqual(result.round_count, 2)
        self.assertEqual(len(result.rounds), 2)
        self.assertEqual(
            [assignment.shop_id for assignment in result.rounds[0].shop_assignments],
            [1001, 1002],
        )
        self.assertEqual(
            [assignment.shop_id for assignment in result.rounds[1].shop_assignments],
            [1002, 1001],
        )
        self.assertEqual(result.rounds[0].days[0].turn_order, ("mistral-medium", "mistral-small"))
        self.assertEqual(result.rounds[0].days[1].turn_order, ("mistral-small", "mistral-medium"))
        self.assertEqual(control_client.advance_calls, 2)
        self.assertEqual(control_client.replace_calls, 1)
        self.assertEqual(result.rounds[0].standings[0].entrant.entrant_id, "mistral-medium")
        self.assertEqual(result.rounds[1].standings[0].entrant.entrant_id, "mistral-small")
        self.assertEqual(result.standings[0].average_primary_score, 100.0)
        self.assertEqual(result.standings[1].average_primary_score, 100.0)
        self.assertEqual(result.standings[0].round_wins, 1)
        self.assertEqual(result.standings[1].round_wins, 1)
        self.assertTrue(
            all(
                entrant_result.live_day.day_result.end_reason == DayEndReason.AGENT_ENDED_DAY
                for round_result in result.rounds
                for day_result in round_result.days
                for entrant_result in day_result.entrant_results
            )
        )

    def test_tournament_entrant_loader_applies_defaults(self) -> None:
        entrants = load_tournament_entrants_from_payload(
            {
                "entrants": [
                    {
                        "entrant_id": "mistral-medium",
                    },
                    {
                        "entrant_id": "mistral-small",
                        "display_name": "Mistral Small",
                        "model": "mistral-small-latest",
                        "temperature": 0.3,
                    },
                ]
            },
            default_model="mistral-medium-latest",
            default_temperature=0.1,
        )

        self.assertEqual(entrants[0].entrant.display_name, "mistral-medium")
        self.assertEqual(entrants[0].entrant.model, "mistral-medium-latest")
        self.assertEqual(entrants[0].temperature, 0.1)
        self.assertEqual(entrants[1].entrant.display_name, "Mistral Small")
        self.assertEqual(entrants[1].entrant.model, "mistral-small-latest")
        self.assertEqual(entrants[1].temperature, 0.3)


class ArtifactPersistenceTests(unittest.TestCase):
    def test_persist_run_artifacts_writes_workspace_memory_files(self) -> None:
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
            [build_market_state(3, "2026-02-28T00:00:00Z", label="Wall Art", taxonomy_id=9101)]
        )
        provider = RecordingProvider(
            [
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name=END_DAY_TOOL_NAME,
                            arguments={"summary": "Done for today."},
                        ),
                    ),
                ),
                ProviderResponse(
                    content="",
                    tool_calls=(
                        ProviderToolCall(
                            name="save_end_of_day_journal_entry",
                            arguments={"content": "Watch whether wall art keeps softening."},
                        ),
                    ),
                ),
            ]
        )
        memory = InMemoryAgentMemory()
        memory.update_workspace(
            shop_id=1001,
            content="Current thesis: wall art may be stalling.",
            day=2,
        )
        memory.add_workspace_entry(
            shop_id=1001,
            content="Trend check: planner demand may be rising.",
            tags=("trend",),
            day=2,
        )
        memory.set_reminder(
            shop_id=1001,
            content="Review whether to activate a planner listing.",
            due_day=3,
            day=2,
        )
        runner = build_default_owner_agent_runner(
            turns_per_day=4,
            memory=memory,
            event_log=InMemoryEventLog(),
            policy_config=ProviderPolicyConfig(),
            mistral_api_key="unused",
        )
        runner = type(runner)(
            provider=provider,
            seller_client=seller_client,
            control_client=control_client,
            memory=memory,
            event_log=InMemoryEventLog(),
        )

        result = runner.run_live_days(shop_id=1001, days=1, run_id="run_artifacts")

        with TemporaryDirectory() as tmpdir:
            bundle = persist_run_artifacts(
                result,
                output_dir=Path(tmpdir) / "workspace-artifacts",
            )
            memory_dir = Path(bundle.output_dir) / "memory"
            workspace_payload = json.loads((memory_dir / "workspace.json").read_text())
            entries_payload = json.loads(
                (memory_dir / "workspace_entries.json").read_text()
            )
            reminders_payload = json.loads((memory_dir / "reminders.json").read_text())
            revisions_payload = json.loads(
                (memory_dir / "workspace_revisions.json").read_text()
            )
            summary_payload = json.loads(
                (Path(bundle.output_dir) / "summary.json").read_text()
            )

        self.assertEqual(
            workspace_payload["content"],
            "Current thesis: wall art may be stalling.",
        )
        self.assertEqual(len(entries_payload), 2)
        self.assertEqual(entries_payload[0]["content"], "Trend check: planner demand may be rising.")
        self.assertEqual(entries_payload[1]["content"], "Watch whether wall art keeps softening.")
        self.assertEqual(len(reminders_payload), 1)
        self.assertEqual(len(revisions_payload), 1)
        self.assertEqual(summary_payload["memory"]["workspace_entry_count"], 2)
        self.assertTrue(summary_payload["memory"]["workspace_has_content"])


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

    def test_run_days_command_can_request_world_reset(self) -> None:
        fake_runner = FakeRunner(
            {
                "run_id": "run_reset_cli",
                "days": [{"day": 1}],
            }
        )
        stdout = StringIO()

        with patch("agent_runtime.cli.build_default_owner_agent_runner", return_value=fake_runner):
            with patch("sys.stdout", stdout):
                exit_code = runtime_cli_main(
                    ["run-days", "--shop-id", "1001", "--days", "1", "--reset-world"]
                )

        self.assertEqual(exit_code, 0)
        self.assertTrue(json.loads(stdout.getvalue())["ok"])
        self.assertTrue(fake_runner.live_days_calls[0]["reset_world"])

    def test_run_days_command_persists_artifacts_when_supported(self) -> None:
        fake_runner = FakeRunner(
            {
                "run_id": "run_artifacts_cli",
                "days": [{"day": 1}],
            }
        )
        stdout = StringIO()
        fake_bundle = SimpleNamespace(
            to_payload=lambda: {"output_dir": "/tmp/fake-artifacts"}
        )

        with patch("agent_runtime.cli.build_default_owner_agent_runner", return_value=fake_runner):
            with patch("agent_runtime.cli.supports_run_artifacts", return_value=True):
                with patch("agent_runtime.cli.persist_run_artifacts", return_value=fake_bundle) as persist:
                    with patch("sys.stdout", stdout):
                        exit_code = runtime_cli_main(
                            [
                                "run-days",
                                "--shop-id",
                                "1001",
                                "--days",
                                "1",
                                "--output-dir",
                                "artifacts/test-output",
                            ]
                        )

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["artifacts"]["output_dir"], "/tmp/fake-artifacts")
        self.assertEqual(persist.call_args.kwargs["output_dir"], "artifacts/test-output")

    def test_run_tournament_command_executes_arena_flow(self) -> None:
        fake_runner = FakeRunner(
            {
                "run_id": "run_tournament_cli",
                "round_count": 1,
            }
        )
        stdout = StringIO()
        entrants_payload = {
            "entrants": [
                {"entrant_id": "mistral-medium", "model": "mistral-medium-latest"},
                {"entrant_id": "mistral-small", "model": "mistral-small-latest"},
            ]
        }

        with tempfile.NamedTemporaryFile("w+", encoding="utf-8") as handle:
            json.dump(entrants_payload, handle)
            handle.flush()

            with patch("agent_runtime.cli.build_default_tournament_runner", return_value=fake_runner):
                with patch("sys.stdout", stdout):
                    exit_code = runtime_cli_main(
                        [
                            "run-tournament",
                            "--entrants-file",
                            handle.name,
                            "--shop-ids",
                            "1001,1002",
                            "--days",
                            "3",
                            "--rounds",
                            "2",
                            "--run-id",
                            "run_tournament_cli",
                        ]
                    )

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["result"]["run_id"], "run_tournament_cli")
        self.assertEqual(fake_runner.tournament_calls[0]["shop_ids"], (1001, 1002))
        self.assertEqual(fake_runner.tournament_calls[0]["run_id"], "run_tournament_cli")
        self.assertEqual(
            fake_runner.tournament_calls[0]["entrants"][0].entrant.entrant_id,
            "mistral-medium",
        )


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
