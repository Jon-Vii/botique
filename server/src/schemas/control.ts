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

export const advanceDayRequestSchema = z.object({
  controlled_shop_ids: z.array(z.number().int().positive()).optional()
});

export const tournamentEntrantSchema = z.object({
  entrant_id: z.string().min(1),
  display_name: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1)
});

export const tournamentLaunchRequestSchema = z.object({
  entrants: z.array(tournamentEntrantSchema).min(2),
  shop_ids: z.array(z.number().int().positive()).min(2),
  days_per_round: z.number().int().positive(),
  rounds: z.number().int().positive(),
  turns_per_day: z.number().int().positive(),
  run_id: z.string().min(1).optional()
});

export const tournamentLaunchResponseSchema = z.object({
  tournament_id: z.string().min(1)
});

export const tournamentScorecardSchema = z.object({
  primary_score_name: z.string(),
  primary_score: z.number(),
  available_cash: z.number(),
  pending_cash: z.number(),
  total_sales_count: z.number().int().nonnegative(),
  review_average: z.number().nullable(),
  review_count: z.number().int().nonnegative(),
  active_listing_count: z.number().int().nonnegative(),
  draft_listing_count: z.number().int().nonnegative(),
  workspace_entries_written: z.number().int().nonnegative(),
  open_reminders: z.number().int().nonnegative(),
  final_day: z.number().int().positive(),
  final_simulation_date: z.string()
});

export const tournamentStandingSchema = z.object({
  rank: z.number().int().positive(),
  entrant: tournamentEntrantSchema,
  shop_id: z.number().int().positive(),
  shop_name: z.string(),
  round_index: z.number().int().nonnegative(),
  scorecard: tournamentScorecardSchema
});

export const tournamentShopAssignmentSchema = z.object({
  entrant_id: z.string().min(1),
  shop_id: z.number().int().positive()
});

export const tournamentEntrantDayResultSchema = z.object({
  entrant_id: z.string().min(1),
  live_day: z.number().int().positive()
});

export const tournamentRoundDayResultSchema = z.object({
  day: z.number().int().positive(),
  simulation_date: z.string(),
  turn_order: z.array(z.string()),
  entrant_results: z.array(tournamentEntrantDayResultSchema)
});

export const tournamentRoundResultSchema = z.object({
  round_index: z.number().int().nonnegative(),
  run_id: z.string().min(1),
  shop_assignments: z.array(tournamentShopAssignmentSchema),
  days: z.array(tournamentRoundDayResultSchema),
  standings: z.array(tournamentStandingSchema)
});

export const tournamentAggregateStandingSchema = z.object({
  rank: z.number().int().positive(),
  entrant: tournamentEntrantSchema,
  rounds_played: z.number().int().positive(),
  primary_score_name: z.string(),
  average_primary_score: z.number(),
  round_scores: z.array(z.number()),
  round_wins: z.number().int().nonnegative(),
  average_total_sales_count: z.number(),
  average_review_average: z.number().nullable()
});

export const tournamentResultSchema = z.object({
  run_id: z.string().min(1),
  days_per_round: z.number().int().positive(),
  round_count: z.number().int().positive(),
  entrants: z.array(tournamentEntrantSchema),
  shop_ids: z.array(z.number().int().positive()),
  rounds: z.array(tournamentRoundResultSchema),
  standings: z.array(tournamentAggregateStandingSchema)
});

export const tournamentListItemSchema = z.object({
  run_id: z.string().min(1),
  entrant_count: z.number().int().nonnegative(),
  round_count: z.number().int().positive(),
  days_per_round: z.number().int().positive(),
  created_at: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  winner: tournamentEntrantSchema.optional()
});

export const tournamentListSchema = z.array(tournamentListItemSchema);
