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

export type SimulationState = {
  current_day: SimulationDay;
  market_snapshot: MarketSnapshot;
  trend_state: TrendState;
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

export type AdvanceDayStepName = "advance_clock" | "refresh_trends" | "refresh_market_snapshot";

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
