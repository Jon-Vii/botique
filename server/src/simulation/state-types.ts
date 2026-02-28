import type {
  Listing,
  Order,
  Payment,
  Review,
  StoredShop,
  TaxonomyNode
} from "../schemas/domain";

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
  taxonomy: TaxonomyMarketSnapshot[];
};

export type PendingEventType = "post_payment" | "create_review" | "buyer_message";

export type PendingEvent = {
  event_id: string;
  type: PendingEventType;
  shop_id: number;
  listing_id: number | null;
  receipt_id: number | null;
  scheduled_for_day: number;
  scheduled_for_date: string;
  created_at: string;
  payload: Record<string, string | number | boolean | null>;
};

export type ListingDemandFactors = {
  quality: number;
  reputation: number;
  price: number;
  reference_price?: number;
  conversion_price?: number;
  freshness: number;
  trend: number;
  variation: number;
};

export type ListingDayResolution = {
  listing_id: number;
  shop_id: number;
  views_gained: number;
  favorites_gained: number;
  orders_created: number;
  revenue: number;
  demand_score: number;
  conversion_rate: number;
  demand_factors: ListingDemandFactors;
};

export type PendingEventCounts = Record<PendingEventType, number>;

export type DayResolutionSummary = {
  resolved_for_day: SimulationDay;
  resolved_at: string;
  totals: {
    active_listings: number;
    views_gained: number;
    favorites_gained: number;
    orders_created: number;
    revenue: number;
  };
  listing_metrics: ListingDayResolution[];
  scheduled_events: PendingEventCounts;
  processed_events: PendingEventCounts;
  pending_event_count: number;
};

export type SimulationState = {
  current_day: SimulationDay;
  market_snapshot: MarketSnapshot;
  trend_state: TrendState;
  pending_events: PendingEvent[];
  last_day_resolution: DayResolutionSummary | null;
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
  | "resolve_listing_activity"
  | "settle_pending_events"
  | "advance_clock"
  | "refresh_trends"
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
