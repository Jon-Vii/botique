export type FulfillmentMode = "stocked" | "made_to_order";
export type ScenarioId = "operate" | "bootstrap";

export type SimulationScenario = {
  scenario_id: ScenarioId;
  controlled_shop_ids: number[];
};

export type ProductionQueueItem = {
  job_id: string;
  listing_id: number;
  order_id: number | null;
  kind: "stock" | "customer_order";
  status: "queued" | "in_progress" | "waiting_ready";
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  capacity_units_required: number;
  capacity_units_remaining: number;
  material_cost: number;
};

export type InventoryOffering = {
  offering_id: number;
  price: number;
  quantity: number;
  is_enabled: boolean;
};

export type InventoryProduct = {
  sku: string;
  property_values: { property_id: number; value: string }[];
  offerings: InventoryOffering[];
};

export type Inventory = {
  listing_id: number;
  products: InventoryProduct[];
  price_on_property: number[];
  quantity_on_property: number[];
  sku_on_property: number[];
};

export type Listing = {
  listing_id: number;
  shop_id: number;
  shop_name: string;
  title: string;
  description: string;
  state: "draft" | "active" | "inactive" | "sold_out";
  type: string;
  quantity: number;
  fulfillment_mode: FulfillmentMode;
  quantity_on_hand: number;
  backlog_units: number;
  price: number;
  currency_code: string;
  who_made: string;
  when_made: string;
  taxonomy_id: number;
  tags: string[];
  materials: string[];
  material_cost_per_unit: number;
  capacity_units_per_item: number;
  lead_time_days: number;
  image_ids: number[];
  views: number;
  favorites: number;
  url: string;
  ranking_score?: number;
  created_at: string;
  updated_at: string;
  inventory: Inventory;
};

export type StoredShop = {
  shop_id: number;
  shop_name: string;
  title: string;
  announcement: string;
  sale_message: string;
  currency_code: string;
  digital_product_policy: string;
  production_capacity_per_day: number;
  backlog_units: number;
  material_costs_paid_total: number;
  production_queue: ProductionQueueItem[];
  created_at: string;
  updated_at: string;
};

export type Shop = StoredShop & {
  listing_active_count: number;
  total_sales_count: number;
  review_average: number;
  review_count: number;
};

export type OrderLineItem = {
  listing_id: number;
  title: string;
  quantity: number;
  price: number;
};

export type Order = {
  receipt_id: number;
  shop_id: number;
  buyer_name: string;
  status: "paid" | "fulfilled" | "refunded";
  was_paid: boolean;
  was_shipped: boolean;
  was_delivered: boolean;
  total_price: number;
  currency_code: string;
  line_items: OrderLineItem[];
  created_at: string;
  updated_at: string;
};

export type Review = {
  review_id: number;
  shop_id: number;
  listing_id: number;
  rating: number;
  review: string;
  buyer_name: string;
  created_at: string;
};

export type Payment = {
  payment_id: number;
  shop_id: number;
  receipt_id: number;
  amount: number;
  currency_code: string;
  status: "posted" | "pending";
  available_at: string;
  posted_at: string;
};

export type TaxonomyNode = {
  taxonomy_id: number;
  parent_taxonomy_id: number | null;
  name: string;
  full_path: string;
  level: number;
};

export type PaginatedResults<T> = {
  count: number;
  limit: number;
  offset: number;
  results: T[];
};

/* ── Control / Simulation types ── */

export type SimulationDay = {
  day: number;
  date: string;
  advanced_at: string | null;
};

export type MarketTrend = {
  trend_id: string;
  label: string;
  taxonomy_id: number | null;
  tags: string[];
  demand_multiplier: number;
};

export type TrendState = {
  generated_at: string;
  baseline_multiplier: number;
  active_trends: MarketTrend[];
};

export type TaxonomyMarketSnapshot = {
  taxonomy_id: number;
  listing_count: number;
  average_price: number;
  demand_multiplier: number;
};

export type MarketSnapshot = {
  generated_at: string;
  active_listing_count: number;
  active_shop_count: number;
  average_active_price: number;
  total_quantity_on_hand: number;
  total_backlog_units: number;
  taxonomy: TaxonomyMarketSnapshot[];
};

export type PendingReview = {
  queue_id: string;
  review_id: number;
  shop_id: number;
  receipt_id: number;
  listing_id: number;
  buyer_name: string;
  release_at: string;
  rating: number;
  review: string;
};

export type ShopDayResolution = {
  shop_id: number;
  orders_created: number;
  stocked_units_sold: number;
  made_to_order_units_sold: number;
  production_units_started: number;
  units_released: number;
  payments_posted: number;
  reviews_released: number;
  material_costs_incurred: number;
  backlog_units_end: number;
  queue_depth_end: number;
};

export type DayResolutionSummary = {
  resolved_at: string;
  pending_review_count: number;
  shops: ShopDayResolution[];
};

export type StoredMarketplaceState = {
  shops: StoredShop[];
  listings: Listing[];
  orders: Order[];
  reviews: Review[];
  payments: Payment[];
  taxonomyNodes: TaxonomyNode[];
};

export type SimulationState = {
  current_day: SimulationDay;
  scenario: SimulationScenario;
  market_snapshot: MarketSnapshot;
  trend_state: TrendState;
  pending_reviews: PendingReview[];
  last_resolution: DayResolutionSummary | null;
};

export type WorldState = {
  marketplace: StoredMarketplaceState;
  simulation: SimulationState;
};

/* ── Benchmark / Run Artifact types ── */

export type ShopStateSnapshot = {
  available_balance: number;
  active_listing_count: number;
  draft_listing_count: number;
  total_sales_count: number;
  review_average: number;
  review_count: number;
};

export type RunTotals = {
  tool_call_count: number;
  tool_calls_by_name: Record<string, number>;
  tool_calls_by_surface: Record<string, number>;
  turn_count: number;
  yesterday_revenue: number;
  notes_written: number;
  reminders_set: number;
  reminders_completed: number;
  simulation_advances: number;
};

export type RunMemory = {
  note_count: number;
  reminder_count: number;
  pending_reminder_count: number;
};

export type RunIdentity = {
  provider?: string | null;
  model?: string | null;
  turns_per_day?: number;
  temperature?: number;
  top_p?: number;
};

export type RunSummary = {
  run_id: string;
  shop_id: number;
  shop_name?: string | null;
  mode: "live" | "mock";
  scenario?: SimulationScenario | null;
  identity?: RunIdentity | null;
  day_count: number;
  start_day: number;
  end_day: number;
  start_simulation_date: string;
  end_simulation_date: string;
  starting_state: ShopStateSnapshot;
  ending_state: ShopStateSnapshot;
  totals: RunTotals;
  memory: RunMemory;
};

export type RunManifest = {
  artifact_version: number;
  run_id: string;
  shop_id: number;
  mode: "live" | "mock";
  day_count: number;
  invocation: Record<string, unknown> & {
    command?: string;
    days?: number;
    max_turns?: number;
    turns_per_day?: number;
    shop_id?: string | number;
    run_id?: string;
    provider?: string;
    model?: string;
    mistral_model?: string;
    temperature?: number;
    mistral_temperature?: number;
    top_p?: number;
    mistral_top_p?: number;
    scenario?: ScenarioId;
    scenario_id?: ScenarioId;
  };
  summary?: Partial<RunSummary>;
};

export type RunListEntry = {
  run_id: string;
  shop_id: number;
  mode: "live" | "mock";
  scenario?: SimulationScenario | null;
  identity?: RunIdentity | null;
  day_count: number;
  has_summary: boolean;
  has_manifest: boolean;
  created_at?: string;
  status?: "running" | "completed" | "failed";
  completed_day_count?: number;
};

export type RunProgressDay = {
  day: number;
  simulation_date: string | null;
  turn_count: number;
  tool_calls: string[];
  available_balance: number;
  active_listing_count: number;
  total_sales_count: number;
  review_average: number;
  review_count: number;
};

export type RunProgress = {
  run_id: string;
  shop_id: number;
  status: "running" | "completed" | "failed";
  total_days: number;
  completed_day_count: number;
  updated_at: string;
  days: RunProgressDay[];
};

export type DaySnapshot = {
  day: number;
  simulation_date: string;
  available_balance: number;
  currency_code: string;
  active_listing_count: number;
  draft_listing_count: number;
  total_sales_count: number;
  review_average: number;
  review_count: number;
  turn_count?: number;
  yesterday_revenue?: number;
  tool_calls?: string[];
};

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

export type WorkspaceRevision = {
  shop_id: number | string;
  content: string;
  revision: number;
  updated_day: number | null;
  is_truncated?: boolean;
  updated_at: string;
};

export type Workspace = WorkspaceRevision | null;

/* ── Tournament types ── */

export type TournamentEntrant = {
  entrant_id: string;
  display_name: string;
  provider: string;
  model: string;
};

export type TournamentScorecard = {
  primary_score_name: string;
  primary_score: number;
  available_cash: number;
  pending_cash: number;
  total_sales_count: number;
  review_average: number | null;
  review_count: number;
  active_listing_count: number;
  draft_listing_count: number;
  workspace_entries_written: number;
  open_reminders: number;
  final_day: number;
  final_simulation_date: string;
};

export type TournamentStanding = {
  rank: number;
  entrant: TournamentEntrant;
  shop_id: number;
  shop_name: string;
  round_index: number;
  scorecard: TournamentScorecard;
};

export type TournamentShopAssignment = {
  entrant_id: string;
  shop_id: number;
};

export type TournamentEntrantDayResult = {
  entrant?: TournamentEntrant;
  entrant_id?: string;
  live_day: number;
};

export type TournamentRoundDayResult = {
  day: number;
  simulation_date: string;
  turn_order: string[];
  entrant_results: TournamentEntrantDayResult[];
};

export type TournamentBalancePoint = {
  entrant_id: string;
  day: number;
  balance: number;
};

export type TournamentRoundResult = {
  round_index: number;
  run_id: string;
  shop_assignments: TournamentShopAssignment[];
  days: TournamentRoundDayResult[];
  standings: TournamentStanding[];
  balance_timeline?: TournamentBalancePoint[];
};

export type TournamentAggregateStanding = {
  rank: number;
  entrant: TournamentEntrant;
  rounds_played: number;
  primary_score_name: string;
  average_primary_score: number;
  round_scores: number[];
  round_wins: number;
  average_total_sales_count: number;
  average_review_average: number | null;
};

export type TournamentResult = {
  run_id: string;
  scenario: SimulationScenario;
  days_per_round: number;
  round_count: number;
  entrants: TournamentEntrant[];
  shop_ids: number[];
  rounds: TournamentRoundResult[];
  standings: TournamentAggregateStanding[];
};

export type TournamentListItem = {
  run_id: string;
  scenario: SimulationScenario;
  entrant_count: number;
  round_count: number;
  days_per_round: number;
  created_at: string;
  status: "running" | "completed" | "failed";
  winner?: TournamentEntrant;
  entrants?: TournamentEntrant[];
};
