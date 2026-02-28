import { z } from "zod";

import {
  listingSchema,
  orderSchema,
  paymentSchema,
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
  taxonomy: z.array(taxonomyMarketSnapshotSchema)
});

export const pendingEventSchema = z.object({
  event_id: z.string(),
  type: z.enum(["post_payment", "create_review", "buyer_message"]),
  shop_id: z.number().int().positive(),
  listing_id: z.number().int().positive().nullable(),
  receipt_id: z.number().int().positive().nullable(),
  scheduled_for_day: z.number().int().positive(),
  scheduled_for_date: z.string(),
  created_at: z.string(),
  payload: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
});

export const listingDemandFactorsSchema = z.object({
  quality: z.number().nonnegative(),
  reputation: z.number().nonnegative(),
  price: z.number().nonnegative(),
  freshness: z.number().nonnegative(),
  trend: z.number().nonnegative(),
  variation: z.number().nonnegative()
});

export const listingDayResolutionSchema = z.object({
  listing_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  views_gained: z.number().int().nonnegative(),
  favorites_gained: z.number().int().nonnegative(),
  orders_created: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  demand_score: z.number().nonnegative(),
  conversion_rate: z.number().nonnegative(),
  demand_factors: listingDemandFactorsSchema
});

export const pendingEventCountsSchema = z.object({
  post_payment: z.number().int().nonnegative(),
  create_review: z.number().int().nonnegative(),
  buyer_message: z.number().int().nonnegative()
});

export const dayResolutionSummarySchema = z.object({
  resolved_for_day: simulationDaySchema,
  resolved_at: z.string(),
  totals: z.object({
    active_listings: z.number().int().nonnegative(),
    views_gained: z.number().int().nonnegative(),
    favorites_gained: z.number().int().nonnegative(),
    orders_created: z.number().int().nonnegative(),
    revenue: z.number().nonnegative()
  }),
  listing_metrics: z.array(listingDayResolutionSchema),
  scheduled_events: pendingEventCountsSchema,
  processed_events: pendingEventCountsSchema,
  pending_event_count: z.number().int().nonnegative()
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
  pending_events: z.array(pendingEventSchema),
  last_day_resolution: dayResolutionSummarySchema.nullable()
});

export const worldStateSchema = z.object({
  marketplace: storedMarketplaceStateSchema,
  simulation: simulationStateSchema
});

export const advanceDayStepSchema = z.object({
  name: z.enum([
    "resolve_listing_activity",
    "settle_pending_events",
    "advance_clock",
    "refresh_trends",
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
