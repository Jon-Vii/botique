import type { Listing } from "../schemas/domain";
import { isMarketplaceActiveListing } from "../listing-availability";
import {
  normalizeListingProduction,
  normalizeShopProduction,
  recalculateShopBacklog
} from "./production";
import { normalizeSimulationScenario, type ScenarioResetOptions } from "./scenario-types";
import type {
  DayResolutionSummary,
  MarketSnapshot,
  MarketTrend,
  PendingReview,
  SimulationDay,
  SimulationState,
  StoredMarketplaceState,
  StoredWorldState,
  TrendState
} from "./state-types";

export const MS_PER_DAY = 86_400_000;

export function clone<T>(value: T): T {
  return structuredClone(value);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function startOfUtcDay(value: string): string {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

export function addUtcDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return startOfUtcDay(date.toISOString());
}

function normalizePaymentAvailability<T extends { available_at?: string; posted_at: string }>(value: T): T {
  return {
    ...value,
    available_at: value.available_at ?? value.posted_at
  };
}

function normalizePendingReview(review: PendingReview): PendingReview {
  return {
    ...review,
    release_at: startOfUtcDay(review.release_at)
  };
}

function normalizeLastResolution(summary?: DayResolutionSummary | null): DayResolutionSummary | null {
  if (!summary) {
    return null;
  }

  return clone(summary);
}

export function normalizeMarketplaceState(state: StoredMarketplaceState): StoredMarketplaceState {
  const listings = state.listings.map(normalizeListingProduction);
  const shopsById = new Map(
    state.shops.map((shop) => {
      const normalizedShop = normalizeShopProduction(shop);
      return [
        normalizedShop.shop_id,
        recalculateShopBacklog(
          normalizedShop,
          listings.filter((listing) => listing.shop_id === normalizedShop.shop_id)
        )
      ];
    })
  );

  return {
    shops: state.shops.map((shop) => clone(shopsById.get(shop.shop_id)!)),
    listings,
    orders: state.orders.map((order) => clone(order)),
    reviews: state.reviews.map((review) => clone(review)),
    payments: state.payments.map((payment) => clone(normalizePaymentAvailability(payment))),
    taxonomyNodes: state.taxonomyNodes.map((node) => clone(node))
  };
}

function collectTimestamps(state: StoredMarketplaceState): string[] {
  const values: string[] = [];

  for (const shop of state.shops) {
    values.push(shop.created_at, shop.updated_at);
  }

  for (const listing of state.listings) {
    values.push(listing.created_at, listing.updated_at);
  }

  for (const order of state.orders) {
    values.push(order.created_at, order.updated_at);
  }

  for (const review of state.reviews) {
    values.push(review.created_at);
  }

  for (const payment of state.payments) {
    values.push(payment.posted_at);
  }

  return values;
}

function inferCurrentDayDate(state: StoredMarketplaceState): string {
  const timestamps = collectTimestamps(state);
  if (timestamps.length === 0) {
    return startOfUtcDay(new Date().toISOString());
  }

  const latest = timestamps.reduce((max, value) => {
    const timestamp = Date.parse(value);
    return timestamp > max ? timestamp : max;
  }, 0);

  return startOfUtcDay(new Date(latest).toISOString());
}

function pickTrendTags(listings: Listing[]): string[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    for (const tag of listing.tags) {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([tag]) => tag);
}

function isWorldState(input: StoredMarketplaceState | StoredWorldState): input is StoredWorldState {
  return "marketplace" in input && "simulation" in input;
}

export function createSimulationDay(day: number, date: string, advancedAt: string | null = null): SimulationDay {
  return {
    day,
    date: startOfUtcDay(date),
    advanced_at: advancedAt
  };
}

export function buildTrendState(
  marketplaceState: StoredMarketplaceState,
  currentDay: SimulationDay,
  generatedAt = currentDay.advanced_at ?? currentDay.date
): TrendState {
  const activeListings = marketplaceState.listings.filter(isMarketplaceActiveListing);
  const taxonomyNodes = marketplaceState.taxonomyNodes
    .filter((node) => node.level > 0)
    .sort((left, right) => left.level - right.level || left.taxonomy_id - right.taxonomy_id);

  if (taxonomyNodes.length === 0) {
    return {
      generated_at: generatedAt,
      baseline_multiplier: 1,
      active_trends: []
    };
  }

  const activeTrends: MarketTrend[] = [];
  const startIndex = (currentDay.day - 1) % taxonomyNodes.length;
  const trendCount = Math.min(2, taxonomyNodes.length);

  for (let offset = 0; offset < trendCount; offset += 1) {
    const node = taxonomyNodes[(startIndex + offset) % taxonomyNodes.length];
    const matchingListings = activeListings.filter((listing) => listing.taxonomy_id === node.taxonomy_id);
    activeTrends.push({
      trend_id: `day-${currentDay.day}-trend-${offset + 1}`,
      label: node.name,
      taxonomy_id: node.taxonomy_id,
      tags: pickTrendTags(matchingListings.length > 0 ? matchingListings : activeListings),
      demand_multiplier: offset === 0 ? 1.3 : 1.15
    });
  }

  return {
    generated_at: generatedAt,
    baseline_multiplier: 1,
    active_trends: activeTrends
  };
}

export function buildMarketSnapshot(
  marketplaceState: StoredMarketplaceState,
  trendState: TrendState,
  generatedAt = trendState.generated_at
): MarketSnapshot {
  const activeListings = marketplaceState.listings.filter(isMarketplaceActiveListing);
  const activeShops = new Set(activeListings.map((listing) => listing.shop_id));
  const trendMultipliers = new Map<number, number>();

  for (const trend of trendState.active_trends) {
    if (trend.taxonomy_id === null) {
      continue;
    }

    const current = trendMultipliers.get(trend.taxonomy_id) ?? trendState.baseline_multiplier;
    trendMultipliers.set(trend.taxonomy_id, Math.max(current, trend.demand_multiplier));
  }

  const grouped = new Map<number, Listing[]>();
  for (const listing of activeListings) {
    const items = grouped.get(listing.taxonomy_id) ?? [];
    items.push(listing);
    grouped.set(listing.taxonomy_id, items);
  }

  return {
    generated_at: generatedAt,
    active_listing_count: activeListings.length,
    active_shop_count: activeShops.size,
    average_active_price: average(activeListings.map((listing) => listing.price)),
    total_quantity_on_hand: activeListings.reduce((sum, listing) => sum + listing.quantity_on_hand, 0),
    total_backlog_units: marketplaceState.listings.reduce((sum, listing) => sum + listing.backlog_units, 0),
    taxonomy: [...grouped.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([taxonomyId, listings]) => ({
        taxonomy_id: taxonomyId,
        listing_count: listings.length,
        average_price: average(listings.map((listing) => listing.price)),
        demand_multiplier: trendMultipliers.get(taxonomyId) ?? trendState.baseline_multiplier
      }))
  };
}

export function createSimulationState(
  marketplaceState: StoredMarketplaceState,
  options: {
    currentDay?: SimulationDay;
    scenario?: ScenarioResetOptions;
    pendingReviews?: PendingReview[];
    lastResolution?: DayResolutionSummary | null;
  } = {}
): SimulationState {
  const normalizedMarketplaceState = normalizeMarketplaceState(marketplaceState);
  const currentDay = options.currentDay ?? createSimulationDay(1, inferCurrentDayDate(normalizedMarketplaceState));
  const scenario = normalizeSimulationScenario(
    options.scenario,
    normalizedMarketplaceState.shops.map((shop) => shop.shop_id)
  );
  const trendState = buildTrendState(normalizedMarketplaceState, currentDay);
  const marketSnapshot = buildMarketSnapshot(normalizedMarketplaceState, trendState);

  return {
    current_day: currentDay,
    scenario,
    market_snapshot: marketSnapshot,
    trend_state: trendState,
    pending_reviews: (options.pendingReviews ?? []).map(normalizePendingReview),
    last_resolution: normalizeLastResolution(options.lastResolution)
  };
}

export function createWorldState(
  marketplaceState: StoredMarketplaceState,
  options: {
    currentDay?: SimulationDay;
    scenario?: ScenarioResetOptions;
    pendingReviews?: PendingReview[];
    lastResolution?: DayResolutionSummary | null;
  } = {}
): StoredWorldState {
  const marketplace = normalizeMarketplaceState(marketplaceState);
  return {
    marketplace,
    simulation: createSimulationState(marketplace, options)
  };
}

export function normalizeWorldState(
  input: StoredMarketplaceState | StoredWorldState
): StoredWorldState {
  if (isWorldState(input)) {
    const marketplace = normalizeMarketplaceState(input.marketplace);
    return {
      marketplace,
      simulation: input.simulation
        ? {
            ...clone(input.simulation),
            scenario: normalizeSimulationScenario(
              input.simulation.scenario,
              marketplace.shops.map((shop) => shop.shop_id)
            ),
            pending_reviews: (input.simulation.pending_reviews ?? []).map(normalizePendingReview),
            last_resolution: normalizeLastResolution(input.simulation.last_resolution)
          }
        : createSimulationState(marketplace)
    };
  }

  return createWorldState(input);
}

export function nextSimulationDay(currentDay: SimulationDay, advancedAt: string): SimulationDay {
  return createSimulationDay(currentDay.day + 1, addUtcDays(currentDay.date, 1), advancedAt);
}
