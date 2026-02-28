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
  trend_state: trendStateSchema
});

export const worldStateSchema = z.object({
  marketplace: storedMarketplaceStateSchema,
  simulation: simulationStateSchema
});

export const advanceDayStepSchema = z.object({
  name: z.enum(["advance_clock", "refresh_trends", "refresh_market_snapshot"]),
  description: z.string()
});

export const advanceDayResultSchema = z.object({
  world: worldStateSchema,
  previous_day: simulationDaySchema,
  current_day: simulationDaySchema,
  steps: z.array(advanceDayStepSchema)
});
