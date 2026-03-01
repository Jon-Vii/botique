/**
 * Mock run data derived from actual artifact bundles.
 * This module provides static data for the Run Explorer when the
 * backend /control/runs/* endpoints are not yet available.
 *
 * TODO: Remove this file once real API endpoints are wired in.
 */

import type {
  RunListEntry,
  RunSummary,
  ShopStateSnapshot,
} from "../types/api";
import type {
  DayBriefing,
  MemoryNote,
  RunDaySummary,
  TurnRecord,
} from "../types/runs";

/* ── Run list ──────────────────────────────────────────── */

export const MOCK_RUN_LIST: RunListEntry[] = [
  {
    run_id: "longer_smoke_medium_02",
    shop_id: 1001,
    mode: "live",
    day_count: 5,
    has_summary: true,
    has_manifest: true,
    created_at: "2026-03-01T04:05:06.594Z",
  },
  {
    run_id: "loop_v1_medium_smoke",
    shop_id: 1001,
    mode: "live",
    day_count: 2,
    has_summary: true,
    has_manifest: true,
    created_at: "2026-03-01T01:30:00.000Z",
  },
  {
    run_id: "smoke_reference_01",
    shop_id: 1001,
    mode: "live",
    day_count: 2,
    has_summary: true,
    has_manifest: true,
    created_at: "2026-02-28T21:38:41.364Z",
  },
  {
    run_id: "loop_v1_smoke",
    shop_id: 1001,
    mode: "live",
    day_count: 2,
    has_summary: true,
    has_manifest: true,
    created_at: "2026-02-28T23:15:00.000Z",
  },
];

/* ── Run summaries ─────────────────────────────────────── */

const SMOKE_REF_SUMMARY: RunSummary = {
  run_id: "smoke_reference_01",
  shop_id: 1001,
  mode: "live",
  day_count: 2,
  start_day: 1,
  end_day: 2,
  start_simulation_date: "2026-02-27T00:00:00.000Z",
  end_simulation_date: "2026-02-28T00:00:00.000Z",
  starting_state: {
    available_balance: 14.0,
    active_listing_count: 1,
    draft_listing_count: 1,
    total_sales_count: 1,
    review_average: 5.0,
    review_count: 1,
  },
  ending_state: {
    available_balance: 14.0,
    active_listing_count: 1,
    draft_listing_count: 1,
    total_sales_count: 1,
    review_average: 5.0,
    review_count: 1,
  },
  totals: {
    tool_call_count: 8,
    tool_calls_by_name: { search_marketplace: 8 },
    tool_calls_by_surface: { core: 8 },
    turn_count: 8,
    yesterday_revenue: 14.0,
    notes_written: 0,
    reminders_set: 0,
    reminders_completed: 0,
    simulation_advances: 2,
  },
  memory: { note_count: 0, reminder_count: 0, pending_reminder_count: 0 },
};

const LONGER_SMOKE_SUMMARY: RunSummary = {
  run_id: "longer_smoke_medium_02",
  shop_id: 1001,
  mode: "live",
  day_count: 5,
  start_day: 1,
  end_day: 5,
  start_simulation_date: "2026-02-27T00:00:00.000Z",
  end_simulation_date: "2026-03-03T00:00:00.000Z",
  starting_state: {
    available_balance: 28.0,
    active_listing_count: 1,
    draft_listing_count: 1,
    total_sales_count: 1,
    review_average: 5.0,
    review_count: 1,
  },
  ending_state: {
    available_balance: 56.0,
    active_listing_count: 2,
    draft_listing_count: 0,
    total_sales_count: 2,
    review_average: 5.0,
    review_count: 1,
  },
  totals: {
    tool_call_count: 15,
    tool_calls_by_name: {
      get_listing_details: 7,
      get_shop_dashboard: 5,
      queue_production: 1,
      search_marketplace: 1,
      update_listing: 1,
    },
    tool_calls_by_surface: { core: 2, extension: 13 },
    turn_count: 15,
    yesterday_revenue: 56.0,
    notes_written: 5,
    reminders_set: 0,
    reminders_completed: 0,
    simulation_advances: 4,
  },
  memory: { note_count: 5, reminder_count: 0, pending_reminder_count: 0 },
};

export const MOCK_SUMMARIES: Record<string, RunSummary> = {
  smoke_reference_01: SMOKE_REF_SUMMARY,
  longer_smoke_medium_02: LONGER_SMOKE_SUMMARY,
};

/* ── Day summaries (used in the run detail view) ──────── */

export const MOCK_DAY_SUMMARIES: Record<string, RunDaySummary[]> = {
  smoke_reference_01: [
    {
      day: 1,
      simulation_date: "2026-02-27T00:00:00.000Z",
      turn_count: 4,
      end_reason: "max_turns_reached",
      tool_calls: ["search_marketplace", "search_marketplace", "search_marketplace", "search_marketplace"],
      state_before: { day: 1, simulation_date: "2026-02-27T00:00:00.000Z", available_balance: 14.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_after: { day: 1, simulation_date: "2026-02-27T00:00:00.000Z", available_balance: 14.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_next_day: { day: 2, simulation_date: "2026-02-28T00:00:00.000Z", available_balance: 14.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      yesterday_order_count: 1,
      yesterday_revenue: 14.0,
      objective_status: "Available balance is $14.00; 1 orders brought in $14.00 yesterday.",
      advanced_to_day: 2,
    },
    {
      day: 2,
      simulation_date: "2026-02-28T00:00:00.000Z",
      turn_count: 4,
      end_reason: "max_turns_reached",
      tool_calls: ["search_marketplace", "search_marketplace", "search_marketplace", "search_marketplace"],
      state_before: { day: 2, simulation_date: "2026-02-28T00:00:00.000Z", available_balance: 14.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_after: { day: 2, simulation_date: "2026-02-28T00:00:00.000Z", available_balance: 14.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_next_day: { day: 3, simulation_date: "2026-03-01T00:00:00.000Z", available_balance: 14.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      yesterday_order_count: 0,
      yesterday_revenue: 0,
      objective_status: "Available balance is $14.00; 0 orders brought in $0.00 yesterday.",
      advanced_to_day: 3,
    },
  ],
  longer_smoke_medium_02: [
    {
      day: 1, simulation_date: "2026-02-27T00:00:00.000Z", turn_count: 3, end_reason: "agent_ended_day",
      tool_calls: ["get_shop_dashboard", "get_listing_details", "get_listing_details"],
      state_before: { day: 1, simulation_date: "2026-02-27T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_after: { day: 1, simulation_date: "2026-02-27T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_next_day: { day: 2, simulation_date: "2026-02-28T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      yesterday_order_count: 1, yesterday_revenue: 28.0,
      objective_status: "Available balance is $28.00; 1 orders brought in $28.00 yesterday. Production queue depth is 1.",
      advanced_to_day: 2,
    },
    {
      day: 2, simulation_date: "2026-02-28T00:00:00.000Z", turn_count: 2, end_reason: "agent_ended_day",
      tool_calls: ["get_shop_dashboard", "update_listing"],
      state_before: { day: 2, simulation_date: "2026-02-28T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 1, draft_listing_count: 1, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_after: { day: 2, simulation_date: "2026-02-28T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_next_day: { day: 3, simulation_date: "2026-03-01T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      yesterday_order_count: 0, yesterday_revenue: 0,
      objective_status: "Available balance is $28.00; 0 orders brought in $0.00 yesterday.",
      advanced_to_day: 3,
    },
    {
      day: 3, simulation_date: "2026-03-01T00:00:00.000Z", turn_count: 4, end_reason: "agent_ended_day",
      tool_calls: ["get_shop_dashboard", "get_listing_details", "get_listing_details", "search_marketplace"],
      state_before: { day: 3, simulation_date: "2026-03-01T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_after: { day: 3, simulation_date: "2026-03-01T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 1, review_average: 5.0, review_count: 1 },
      state_next_day: { day: 4, simulation_date: "2026-03-02T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 2, review_average: 5.0, review_count: 1 },
      yesterday_order_count: 0, yesterday_revenue: 0,
      objective_status: "Available balance is $28.00; 0 orders brought in $0.00 yesterday.",
      advanced_to_day: 4,
    },
    {
      day: 4, simulation_date: "2026-03-02T00:00:00.000Z", turn_count: 3, end_reason: "agent_ended_day",
      tool_calls: ["get_shop_dashboard", "get_listing_details", "queue_production"],
      state_before: { day: 4, simulation_date: "2026-03-02T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 2, review_average: 5.0, review_count: 1 },
      state_after: { day: 4, simulation_date: "2026-03-02T00:00:00.000Z", available_balance: 28.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 2, review_average: 5.0, review_count: 1 },
      state_next_day: { day: 5, simulation_date: "2026-03-03T00:00:00.000Z", available_balance: 56.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 2, review_average: 5.0, review_count: 1 },
      yesterday_order_count: 0, yesterday_revenue: 0,
      objective_status: "Available balance is $28.00; 0 orders brought in $0.00 yesterday.",
      advanced_to_day: 5,
    },
    {
      day: 5, simulation_date: "2026-03-03T00:00:00.000Z", turn_count: 3, end_reason: "agent_ended_day",
      tool_calls: ["get_shop_dashboard", "get_listing_details", "get_listing_details"],
      state_before: { day: 5, simulation_date: "2026-03-03T00:00:00.000Z", available_balance: 56.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 2, review_average: 5.0, review_count: 1 },
      state_after: { day: 5, simulation_date: "2026-03-03T00:00:00.000Z", available_balance: 56.0, currency_code: "USD", active_listing_count: 2, draft_listing_count: 0, total_sales_count: 2, review_average: 5.0, review_count: 1 },
      state_next_day: null,
      yesterday_order_count: 1, yesterday_revenue: 28.0,
      objective_status: "Available balance is $56.00; 1 orders brought in $28.00 yesterday.",
      advanced_to_day: null,
    },
  ],
};

/* ── Briefings ─────────────────────────────────────────── */

const SMOKE_DAY1_BRIEFING: DayBriefing = {
  day: 1, shop_id: 1001, shop_name: "northwind-printables", run_id: "smoke_reference_01",
  generated_at: "2026-02-28T21:38:36.161Z",
  balance_summary: { available: 14.0, pending: 0, currency_code: "USD" },
  objective_progress: {
    primary_objective: "Grow ending balance",
    metric_name: "available_balance",
    current_value: 14.0,
    target_value: null,
    status_summary: "Available balance is $14.00; 1 orders brought in $14.00 yesterday. Top market watch: Printable Wall Art.",
    supporting_diagnostics: ["active_listings=1", "draft_listings=1", "review_average=5.00", "yesterday_orders=1"],
  },
  listing_changes: [{
    listing_id: 2001, title: "Mushroom Cottage Printable Wall Art", state: "active",
    views_delta: 0, favorites_delta: 0, orders_delta: 1, revenue_delta: 14.0,
  }],
  market_movements: [
    { headline: "Trend watch: Printable Wall Art", summary: "demand x1.30; 1 active listings avg $14.00; tags: cottagecore, mushroom, printable", urgency: "high" },
    { headline: "Trend watch: Digital Planners", summary: "demand x1.15; tags: celestial, cottagecore, mushroom", urgency: "watch" },
  ],
  yesterday_orders: { order_count: 1, revenue: 14.0, average_order_value: 14.0, refunded_order_count: 0 },
  new_reviews: [], new_customer_messages: [], notes: [], due_reminders: [],
  priorities_prompt: "Choose the highest-leverage priorities for today, then use the available tools to inspect evidence, adjust the shop, and end the day once the plan is done.",
};

export const MOCK_BRIEFINGS: Record<string, Record<number, DayBriefing>> = {
  smoke_reference_01: { 1: SMOKE_DAY1_BRIEFING },
  longer_smoke_medium_02: {
    1: {
      ...SMOKE_DAY1_BRIEFING,
      run_id: "longer_smoke_medium_02",
      balance_summary: { available: 28.0, pending: 0, currency_code: "USD" },
      objective_progress: {
        ...SMOKE_DAY1_BRIEFING.objective_progress,
        current_value: 28.0,
        status_summary: "Available balance is $28.00; 1 orders brought in $28.00 yesterday.",
      },
      yesterday_orders: { order_count: 1, revenue: 28.0, average_order_value: 28.0, refunded_order_count: 0 },
      market_movements: [
        { headline: "Trend watch: 3D Printed Goods", summary: "demand x1.25; tags: planter, organizer, functional", urgency: "high" },
        { headline: "Trend watch: Laser Cut Decor", summary: "demand x1.10; tags: wood, geometric", urgency: "watch" },
      ],
    },
  },
};

/* ── Turns ─────────────────────────────────────────────── */

const SMOKE_DAY1_TURNS: TurnRecord[] = [
  {
    turn_index: 1,
    tool_call: { name: "search_marketplace", arguments: { keywords: "Printable Wall Art", limit: 10 } },
    tool_result: {
      tool_name: "search_marketplace",
      arguments: { keywords: "Printable Wall Art", limit: 10 },
      output: { count: 3, results: [
        { listing_id: 2001, title: "Mushroom Cottage Printable Wall Art", price: 14, ranking_score: 47.36 },
        { listing_id: 2004, title: "Celestial Phone Wallpaper Bundle", price: 8, ranking_score: 21.41 },
        { listing_id: 2003, title: "Retro Celestial Sticker Pack", price: 6, ranking_score: 16.45 },
      ]},
      surface: "core",
    },
    decision_summary: "Call search_marketplace.",
    assistant_text: "",
    started_at: "2026-02-28T21:38:36.162Z",
    completed_at: "2026-02-28T21:38:37.602Z",
    state_changes: null,
  },
  {
    turn_index: 2,
    tool_call: { name: "search_marketplace", arguments: { keywords: "cottagecore printable", limit: 10 } },
    tool_result: {
      tool_name: "search_marketplace",
      arguments: { keywords: "cottagecore printable", limit: 10 },
      output: { count: 2, results: [
        { listing_id: 2001, title: "Mushroom Cottage Printable Wall Art", price: 14, ranking_score: 34.36 },
        { listing_id: 2003, title: "Retro Celestial Sticker Pack", price: 6, ranking_score: 16.45 },
      ]},
      surface: "core",
    },
    decision_summary: "Call search_marketplace.",
    assistant_text: "",
    started_at: "2026-02-28T21:38:37.602Z",
    completed_at: "2026-02-28T21:38:38.088Z",
    state_changes: null,
  },
  {
    turn_index: 3,
    tool_call: { name: "search_marketplace", arguments: { keywords: "cottagecore printable", limit: 10 } },
    tool_result: {
      tool_name: "search_marketplace",
      arguments: { keywords: "cottagecore printable", limit: 10 },
      output: { count: 2, results: [
        { listing_id: 2001, title: "Mushroom Cottage Printable Wall Art", price: 14, ranking_score: 34.36 },
        { listing_id: 2003, title: "Retro Celestial Sticker Pack", price: 6, ranking_score: 16.45 },
      ]},
      surface: "core",
    },
    decision_summary: "Call search_marketplace.",
    assistant_text: "",
    started_at: "2026-02-28T21:38:38.088Z",
    completed_at: "2026-02-28T21:38:38.442Z",
    state_changes: null,
  },
  {
    turn_index: 4,
    tool_call: { name: "search_marketplace", arguments: { keywords: "cottagecore printable", limit: 10 } },
    tool_result: {
      tool_name: "search_marketplace",
      arguments: { keywords: "cottagecore printable", limit: 10 },
      output: { count: 2, results: [
        { listing_id: 2001, title: "Mushroom Cottage Printable Wall Art", price: 14 },
        { listing_id: 2003, title: "Retro Celestial Sticker Pack", price: 6 },
      ]},
      surface: "core",
    },
    decision_summary: "Call search_marketplace.",
    assistant_text: "",
    started_at: "2026-02-28T21:38:38.442Z",
    completed_at: "2026-02-28T21:38:38.918Z",
    state_changes: null,
  },
];

export const MOCK_TURNS: Record<string, Record<number, TurnRecord[]>> = {
  smoke_reference_01: { 1: SMOKE_DAY1_TURNS, 2: SMOKE_DAY1_TURNS },
  longer_smoke_medium_02: {
    1: [
      { turn_index: 1, tool_call: { name: "get_shop_dashboard", arguments: {} }, tool_result: { tool_name: "get_shop_dashboard", arguments: {}, output: { shop_name: "northwind-printables", active_listings: 1, balance: 28.0 }, surface: "extension" }, decision_summary: "Check shop status.", assistant_text: "", started_at: "2026-03-01T04:04:35.000Z", completed_at: "2026-03-01T04:04:36.000Z", state_changes: null },
      { turn_index: 2, tool_call: { name: "get_listing_details", arguments: { listing_id: 2001 } }, tool_result: { tool_name: "get_listing_details", arguments: { listing_id: 2001 }, output: { title: "Stackable Seed Starter Tray Set", price: 28, views: 164, favorites: 42 }, surface: "extension" }, decision_summary: "Inspect top listing.", assistant_text: "", started_at: "2026-03-01T04:04:36.000Z", completed_at: "2026-03-01T04:04:38.000Z", state_changes: null },
      { turn_index: 3, tool_call: { name: "get_listing_details", arguments: { listing_id: 2002 } }, tool_result: { tool_name: "get_listing_details", arguments: { listing_id: 2002 }, output: { title: "Custom Herb Marker Stakes", price: 18, views: 33, favorites: 8, state: "draft" }, surface: "extension" }, decision_summary: "Inspect draft listing.", assistant_text: "", started_at: "2026-03-01T04:04:38.000Z", completed_at: "2026-03-01T04:04:40.000Z", state_changes: null },
    ],
    2: [
      { turn_index: 1, tool_call: { name: "get_shop_dashboard", arguments: {} }, tool_result: { tool_name: "get_shop_dashboard", arguments: {}, output: { shop_name: "northwind-printables", active_listings: 1, balance: 28.0 }, surface: "extension" }, decision_summary: "Check shop status.", assistant_text: "", started_at: "2026-03-01T04:04:42.000Z", completed_at: "2026-03-01T04:04:43.000Z", state_changes: null },
      { turn_index: 2, tool_call: { name: "update_listing", arguments: { listing_id: 2002, state: "active" } }, tool_result: { tool_name: "update_listing", arguments: { listing_id: 2002, state: "active" }, output: { success: true, listing_id: 2002, new_state: "active" }, surface: "extension" }, decision_summary: "Activate draft listing.", assistant_text: "", started_at: "2026-03-01T04:04:44.000Z", completed_at: "2026-03-01T04:04:47.000Z", state_changes: { active_listing_count: { before: 1, after: 2 }, draft_listing_count: { before: 1, after: 0 } } },
    ],
    3: [
      { turn_index: 1, tool_call: { name: "get_shop_dashboard", arguments: {} }, tool_result: { tool_name: "get_shop_dashboard", arguments: {}, output: { shop_name: "northwind-printables", active_listings: 2, balance: 28.0 }, surface: "extension" }, decision_summary: "Check shop status.", assistant_text: "", started_at: "2026-03-01T04:04:48.000Z", completed_at: "2026-03-01T04:04:49.000Z", state_changes: null },
      { turn_index: 2, tool_call: { name: "get_listing_details", arguments: { listing_id: 2001 } }, tool_result: { tool_name: "get_listing_details", arguments: { listing_id: 2001 }, output: { title: "Stackable Seed Starter Tray Set", views: 164, favorites: 42 }, surface: "extension" }, decision_summary: "Review performance.", assistant_text: "", started_at: "2026-03-01T04:04:49.000Z", completed_at: "2026-03-01T04:04:50.000Z", state_changes: null },
      { turn_index: 3, tool_call: { name: "get_listing_details", arguments: { listing_id: 2002 } }, tool_result: { tool_name: "get_listing_details", arguments: { listing_id: 2002 }, output: { title: "Custom Herb Marker Stakes", views: 33, favorites: 8 }, surface: "extension" }, decision_summary: "Review second listing.", assistant_text: "", started_at: "2026-03-01T04:04:50.000Z", completed_at: "2026-03-01T04:04:51.000Z", state_changes: null },
      { turn_index: 4, tool_call: { name: "search_marketplace", arguments: { keywords: "ceramics", limit: 5 } }, tool_result: { tool_name: "search_marketplace", arguments: { keywords: "ceramics", limit: 5 }, output: { count: 4, results: [] }, surface: "core" }, decision_summary: "Scout market.", assistant_text: "", started_at: "2026-03-01T04:04:52.000Z", completed_at: "2026-03-01T04:04:53.000Z", state_changes: null },
    ],
  },
};

/* ── Memory notes ──────────────────────────────────────── */

export const MOCK_NOTES: Record<string, MemoryNote[]> = {
  smoke_reference_01: [],
  longer_smoke_medium_02: [
    { note_id: "note_301d04aa8aea", shop_id: 1001, title: "Day 1 note", body: "The Stackable Seed Starter Tray Set received a 5-star review from Ava Chen, highlighting its quality and functionality.", tags: [], created_day: 1, created_at: "2026-03-01T04:04:40.334Z" },
    { note_id: "note_2434947a02bf", shop_id: 1001, title: "Day 2 note", body: "Activated the draft listing for Custom Herb Marker Stakes. Monitor its performance and consider promoting it given the trend in laser-cut decor and ceramics.", tags: [], created_day: 2, created_at: "2026-03-01T04:04:47.456Z" },
    { note_id: "note_02980fbff3b3", shop_id: 1001, title: "Day 3 note", body: "The ceramics trend is strong with high demand and good prices. Consider exploring this category further.", tags: [], created_day: 3, created_at: "2026-03-01T04:04:53.863Z" },
    { note_id: "note_aa6f16e373cc", shop_id: 1001, title: "Day 4 note", body: "Seed Starter Tray performing well (164 views, 42 favs). Herb Markers underperforming (33 views, 8 favs); needs visibility boost.", tags: [], created_day: 4, created_at: "2026-03-01T04:05:00.030Z" },
    { note_id: "note_1275438956be", shop_id: 1001, title: "Day 5 note", body: "Consider revising Herb Marker listing or adding more tags to improve visibility.", tags: [], created_day: 5, created_at: "2026-03-01T04:05:06.564Z" },
  ],
};
