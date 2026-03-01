import { z } from "zod";

import {
  listingSchema,
  orderSchema,
  paymentSchema,
  productionQueueItemSchema,
  reviewSchema,
  storedShopSchema,
  taxonomyNodeSchema
} from "./domain";

export const simulationDaySchema = z.object({
  day: z.number().int().positive(),
  date: z.string(),
  advanced_at: z.string().nullable()
});

export const marketTrendSchema = z.object({
  trend_id: z.string(),
  label: z.string(),
  taxonomy_id: z.number().int().positive().nullable(),
  tags: z.array(z.string()),
  demand_multiplier: z.number().nonnegative()
});

export const trendStateSchema = z.object({
  generated_at: z.string(),
  baseline_multiplier: z.number().nonnegative(),
  active_trends: z.array(marketTrendSchema)
});

export const taxonomyMarketSnapshotSchema = z.object({
  taxonomy_id: z.number().int().positive(),
  listing_count: z.number().int().nonnegative(),
  average_price: z.number().nonnegative(),
  demand_multiplier: z.number().nonnegative()
});

export const marketSnapshotSchema = z.object({
  generated_at: z.string(),
  active_listing_count: z.number().int().nonnegative(),
  active_shop_count: z.number().int().nonnegative(),
  average_active_price: z.number().nonnegative(),
  total_quantity_on_hand: z.number().int().nonnegative(),
  total_backlog_units: z.number().int().nonnegative(),
  taxonomy: z.array(taxonomyMarketSnapshotSchema)
});

export const pendingReviewSchema = z.object({
  queue_id: z.string(),
  review_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  receipt_id: z.number().int().positive(),
  listing_id: z.number().int().positive(),
  buyer_name: z.string(),
  release_at: z.string(),
  rating: z.number().int().min(1).max(5),
  review: z.string()
});

export const shopDayResolutionSchema = z.object({
  shop_id: z.number().int().positive(),
  orders_created: z.number().int().nonnegative(),
  stocked_units_sold: z.number().int().nonnegative(),
  made_to_order_units_sold: z.number().int().nonnegative(),
  production_units_started: z.number().int().nonnegative(),
  units_released: z.number().int().nonnegative(),
  payments_posted: z.number().int().nonnegative(),
  reviews_released: z.number().int().nonnegative(),
  material_costs_incurred: z.number().nonnegative(),
  backlog_units_end: z.number().int().nonnegative(),
  queue_depth_end: z.number().int().nonnegative()
});

export const dayResolutionSummarySchema = z.object({
  resolved_at: z.string(),
  pending_review_count: z.number().int().nonnegative(),
  shops: z.array(shopDayResolutionSchema)
});

export const storedMarketplaceStateSchema = z.object({
  shops: z.array(storedShopSchema),
  listings: z.array(listingSchema),
  orders: z.array(orderSchema),
  reviews: z.array(reviewSchema),
  payments: z.array(paymentSchema),
  taxonomyNodes: z.array(taxonomyNodeSchema)
});

export const simulationStateSchema = z.object({
  current_day: simulationDaySchema,
  market_snapshot: marketSnapshotSchema,
  trend_state: trendStateSchema,
  pending_reviews: z.array(pendingReviewSchema),
  last_resolution: dayResolutionSummarySchema.nullable()
});

export const worldStateSchema = z.object({
  marketplace: storedMarketplaceStateSchema,
  simulation: simulationStateSchema
});

export const advanceDayStepSchema = z.object({
  name: z.enum([
    "advance_clock",
    "refresh_trends",
    "release_completed_production",
    "settle_delayed_events",
    "resolve_market_sales",
    "allocate_production",
    "refresh_market_snapshot"
  ]),
  description: z.string()
});

export const advanceDayResultSchema = z.object({
  world: worldStateSchema,
  previous_day: simulationDaySchema,
  current_day: simulationDaySchema,
  steps: z.array(advanceDayStepSchema)
});
