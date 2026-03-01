/* ── Run Explorer artifact types ──────────────────────── */
/* Derived from the actual artifact bundle structure under
   artifacts/agent-runtime/<run-id>/                       */

export type ShopStateSnapshot = {
  day: number;
  simulation_date: string;
  available_balance: number;
  currency_code: string;
  active_listing_count: number;
  draft_listing_count: number;
  total_sales_count: number;
  review_average: number;
  review_count: number;
};

export type RunDaySummary = {
  day: number;
  simulation_date: string;
  turn_count: number;
  end_reason: string;
  tool_calls: string[];
  state_before: ShopStateSnapshot;
  state_after: ShopStateSnapshot;
  state_next_day: ShopStateSnapshot | null;
  yesterday_order_count: number;
  yesterday_revenue: number;
  objective_status: string;
  advanced_to_day: number | null;
};

export type RunTotals = {
  tool_call_count: number;
  tool_calls_by_name: Record<string, number>;
  tool_calls_by_surface?: Record<string, number>;
  turn_count: number;
  yesterday_order_count: number;
  yesterday_revenue: number;
  notes_written?: number;
  reminders_set?: number;
  reminders_completed?: number;
  simulation_advances?: number;
};

export type RunMemorySummary = {
  note_count: number;
  reminder_count: number;
  pending_reminder_count: number;
};

export type RunSummary = {
  run_id: string;
  shop_id: number;
  mode: string;
  day_count: number;
  start_day: number;
  end_day: number;
  start_simulation_date: string;
  end_simulation_date: string;
  generated_at: string;
  starting_state: ShopStateSnapshot;
  ending_state: ShopStateSnapshot;
  days: RunDaySummary[];
  totals: RunTotals;
  memory?: RunMemorySummary;
};

export type RunInvocation = {
  command: string;
  days: number;
  max_turns?: number | null;
  turns_per_day?: number | null;
  shop_id: string;
  run_id?: string;
  output_dir?: string;
  reset_world?: boolean;
  [key: string]: unknown;
};

export type RunManifest = {
  artifact_version: number;
  run_id: string;
  shop_id: number;
  mode: string;
  day_count: number;
  generated_at: string;
  invocation: RunInvocation;
  layout: Record<string, string>;
  summary: RunSummary;
};

/* ── Per-day detail types ──────────────────────────────── */

export type BalanceSummary = {
  available: number;
  pending: number;
  currency_code: string;
};

export type ObjectiveProgress = {
  primary_objective: string;
  metric_name: string;
  current_value: number;
  target_value: number | null;
  status_summary: string;
  supporting_diagnostics: string[];
};

export type ListingChange = {
  listing_id: number;
  title: string;
  state: string;
  views_delta: number;
  favorites_delta: number;
  orders_delta: number;
  revenue_delta: number;
};

export type MarketMovement = {
  headline: string;
  summary: string;
  urgency: "high" | "watch" | "low";
};

export type YesterdayOrders = {
  order_count: number;
  revenue: number;
  average_order_value: number;
  refunded_order_count: number;
};

export type DayBriefing = {
  day: number;
  shop_id: number;
  shop_name: string;
  run_id: string;
  generated_at?: string;
  balance_summary: BalanceSummary;
  objective_progress: ObjectiveProgress;
  listing_changes: ListingChange[];
  market_movements: MarketMovement[];
  yesterday_orders: YesterdayOrders;
  new_reviews: unknown[];
  new_customer_messages: unknown[];
  notes: unknown[];
  due_reminders: unknown[];
  priorities_prompt: string;
};

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  tool_name: string;
  arguments: Record<string, unknown>;
  output: unknown;
  surface?: string;
};

export type TurnRecord = {
  turn_index: number;
  tool_call: ToolCall;
  tool_result: ToolResult;
  decision_summary: string;
  assistant_text: string;
  started_at: string;
  completed_at: string;
  state_changes: unknown | null;
  provider_tool_calls?: Array<{
    call_id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
};

export type MemoryNote = {
  note_id: string;
  shop_id: number;
  title: string;
  body: string;
  tags: string[];
  created_day: number;
  created_at: string;
};

export type MemoryReminder = {
  reminder_id: string;
  shop_id: number;
  title: string;
  body: string;
  due_day: number;
  completed: boolean;
  created_at: string;
};

/* ── Run list item (derived from manifest) ─────────────── */

export type RunListItem = {
  run_id: string;
  shop_id: number;
  mode: string;
  day_count: number;
  generated_at: string;
  starting_balance: number;
  ending_balance: number;
  total_tool_calls: number;
  total_revenue: number;
};
