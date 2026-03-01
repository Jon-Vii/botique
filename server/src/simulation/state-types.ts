import type {
  Listing,
  Order,
  Payment,
  ProductionQueueItem,
  Review,
  StoredShop,
  TaxonomyNode
} from "../schemas/domain";
import type { SimulationScenario } from "./scenario-types";

export type StoredMarketplaceState = {
  shops: StoredShop[];
  listings: Listing[];
  orders: Order[];
  reviews: Review[];
  payments: Payment[];
  taxonomyNodes: TaxonomyNode[];
};

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
  total_views: number;
  total_favorites: number;
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

export type SimulationState = {
  current_day: SimulationDay;
  scenario: SimulationScenario;
  market_snapshot: MarketSnapshot;
  trend_state: TrendState;
  pending_reviews: PendingReview[];
  last_resolution: DayResolutionSummary | null;
};

export type StoredWorldState = {
  marketplace: StoredMarketplaceState;
  simulation: SimulationState;
};

export type MarketplaceSearchContext = {
  current_day: SimulationDay;
  market_snapshot: MarketSnapshot;
  trend_state: TrendState;
};

export type AdvanceDayStepName =
  | "advance_clock"
  | "refresh_trends"
  | "release_completed_production"
  | "settle_delayed_events"
  | "resolve_market_sales"
  | "allocate_production"
  | "refresh_market_snapshot";

export type AdvanceDayStep = {
  name: AdvanceDayStepName;
  description: string;
};

export type AdvanceDayResult = {
  world: StoredWorldState;
  previous_day: SimulationDay;
  current_day: SimulationDay;
  steps: AdvanceDayStep[];
};

export type ShopProductionState = Pick<
  StoredShop,
  "shop_id" | "production_capacity_per_day" | "backlog_units" | "material_costs_paid_total" | "production_queue"
>;

export type ProductionQueueSnapshot = {
  shop_id: number;
  production_queue: ProductionQueueItem[];
};
