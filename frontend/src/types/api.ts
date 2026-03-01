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
  price: number;
  currency_code: string;
  who_made: string;
  when_made: string;
  taxonomy_id: number;
  tags: string[];
  materials: string[];
  image_ids: number[];
  views: number;
  favorites: number;
  url: string;
  ranking_score?: number;
  created_at: string;
  updated_at: string;
  inventory: Inventory;
};

export type Shop = {
  shop_id: number;
  shop_name: string;
  title: string;
  announcement: string;
  sale_message: string;
  currency_code: string;
  digital_product_policy: string;
  created_at: string;
  updated_at: string;
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
  taxonomy: TaxonomyMarketSnapshot[];
};

export type Payment = {
  payment_id: number;
  shop_id: number;
  receipt_id: number;
  amount: number;
  currency_code: string;
  status: "posted" | "pending";
  posted_at: string;
};

export type StoredMarketplaceState = {
  shops: Shop[];
  listings: Listing[];
  orders: Order[];
  reviews: Review[];
  payments: Payment[];
  taxonomyNodes: TaxonomyNode[];
};

export type SimulationState = {
  current_day: SimulationDay;
  market_snapshot: MarketSnapshot;
  trend_state: TrendState;
};

export type WorldState = {
  marketplace: StoredMarketplaceState;
  simulation: SimulationState;
};
