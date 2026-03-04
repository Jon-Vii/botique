import type {
  Listing,
  ListingInventory,
  Order,
  Payment,
  ProductionQueueItem,
  Review,
  StoredShop
} from "../schemas/domain";
import {
  computeListingQuality
} from "./ranking";
import {
  createProductionQueueJob,
  isMadeToOrderListing,
  isStockedListing,
  queueUnitsForListing,
  recalculateShopBacklog,
  syncListingInventoryState
} from "./production";
import { MS_PER_DAY, addUtcDays, buildMarketSnapshot, buildTrendState, clone, nextSimulationDay, normalizeWorldState } from "./state";
import { isMarketplaceActiveListing } from "../listing-availability";
import { NPC_PRODUCT_POOL, type NpcProductTemplate } from "./npc-product-pool";
import type {
  AdvanceDayResult,
  DayResolutionSummary,
  PendingReview,
  ShopDayResolution,
  StoredWorldState,
  TrendState
} from "./state-types";

export interface DayResolutionOptions {
  controlled_shop_ids?: readonly number[];
}

const BUYER_NAMES = [
  "Ava Chen",
  "Leo Ramirez",
  "Maya Patel",
  "Noah Kim",
  "Riley Brooks",
  "Zoe Carter"
];

// ─── Demand Model Parameters ────────────────────────────────────────
// Staged pipeline grounded in EcoGym (arxiv 2602.09514) demand model
// and calibrated against real Etsy marketplace conversion data.
// See docs/simulation-model.md for full rationale.

const BASE_TAXONOMY_TRAFFIC = 15;
const BASE_CONVERSION_RATE = 0.06;
const BASE_FAVORITE_RATE = 0.12;
const CLICK_ELASTICITY = 1.5;
const QUALITY_EXPONENT = 1.0;
const REPUTATION_EXPONENT = 0.8;
const FRESHNESS_EXPONENT = 0.5;
const TREND_FIT_EXPONENT = 0.7;
const TRAFFIC_NOISE_FLOOR = 0.85;
const TRAFFIC_NOISE_RANGE = 0.30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stableUnitInterval(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10_000) / 10_000;
}

function stochasticRound(value: number, seed: string): number {
  const floor = Math.floor(value);
  const frac = value - floor;
  return floor + (stableUnitInterval(seed) < frac ? 1 : 0);
}

function differenceInDays(start: string, end: string): number {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / MS_PER_DAY));
}

function nextNumericId(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0) + 1;
}

function createResolutionMap(shops: StoredShop[]): Map<number, ShopDayResolution> {
  return new Map(
    shops.map((shop) => [
      shop.shop_id,
      {
        shop_id: shop.shop_id,
        total_views: 0,
        total_favorites: 0,
        orders_created: 0,
        stocked_units_sold: 0,
        made_to_order_units_sold: 0,
        production_units_started: 0,
        units_released: 0,
        payments_posted: 0,
        reviews_released: 0,
        material_costs_incurred: 0,
        backlog_units_end: shop.backlog_units,
        queue_depth_end: shop.production_queue.length
      }
    ])
  );
}

function getDemandMultiplier(listing: Listing, trendState: TrendState): number {
  let multiplier = trendState.baseline_multiplier;
  const listingTags = new Set(listing.tags.map((tag) => tag.toLowerCase()));

  for (const trend of trendState.active_trends) {
    if (trend.taxonomy_id === listing.taxonomy_id) {
      multiplier = Math.max(multiplier, trend.demand_multiplier);
      continue;
    }

    if (trend.tags.some((tag) => listingTags.has(tag.toLowerCase()))) {
      multiplier = Math.max(multiplier, 1 + (trend.demand_multiplier - 1) / 2);
    }
  }

  return multiplier;
}

// ─── Stage 1: Taxonomy-Level Daily Traffic ──────────────────────────

function taxonomyDailyTraffic(
  taxonomyId: number,
  currentDate: string,
  trendState: TrendState,
): number {
  let trendMultiplier = trendState.baseline_multiplier;
  for (const trend of trendState.active_trends) {
    if (trend.taxonomy_id === taxonomyId) {
      trendMultiplier = Math.max(trendMultiplier, trend.demand_multiplier);
    }
  }

  const noise = TRAFFIC_NOISE_FLOOR + TRAFFIC_NOISE_RANGE * stableUnitInterval(`traffic:${currentDate}:${taxonomyId}`);

  return Math.max(1, Math.round(BASE_TAXONOMY_TRAFFIC * trendMultiplier * noise));
}

// ─── Stage 2: Discoverability Score ─────────────────────────────────

function computeDiscoverability(
  listing: Listing,
  trendState: TrendState,
  taxonomyAveragePrice: number,
  reviewAverage: number,
  currentDate: string
): number {
  const quality = Math.max(0.1, computeListingQuality(listing) / 9);
  const reputation = Math.max(0.1, reviewAverage / 5);

  const listingAgeDays = differenceInDays(listing.created_at, currentDate);
  const freshness = Math.max(0.1, 1 - listingAgeDays / 30);

  const trendFit = Math.max(0.1, getDemandMultiplier(listing, trendState));

  const priceRatio = taxonomyAveragePrice > 0
    ? (listing.price - taxonomyAveragePrice) / taxonomyAveragePrice
    : 0;
  const priceClickFit = clamp(1 - CLICK_ELASTICITY * Math.max(0, priceRatio), 0.3, 1.15);

  const exposure =
    Math.pow(quality, QUALITY_EXPONENT) *
    Math.pow(reputation, REPUTATION_EXPONENT) *
    Math.pow(freshness, FRESHNESS_EXPONENT) *
    Math.pow(trendFit, TREND_FIT_EXPONENT);

  return exposure * priceClickFit;
}

// ─── Stage 3: Per-View Conversion Rates ─────────────────────────────

function computeOrderConversionRate(
  listing: Listing,
  shop: StoredShop,
  trendState: TrendState,
  taxonomyAveragePrice: number,
  reviewAverage: number
): number {
  const qualityBonus = (computeListingQuality(listing) / 9) * 0.04;
  const reputationBonus = clamp((reviewAverage - 3) / 2, 0, 1) * 0.04;

  const priceRatio = taxonomyAveragePrice > 0
    ? (listing.price - taxonomyAveragePrice) / taxonomyAveragePrice
    : 0;
  const priceTerm = clamp(-2.0 * priceRatio * 0.04, -0.04, 0.03);

  const trendBonus = Math.max(0, (getDemandMultiplier(listing, trendState) - 1) / 0.3) * 0.02;

  const fulfillmentPenalty = isStockedListing(listing) ? 0 :
    Math.min(0.03, (listing.backlog_units * listing.capacity_units_per_item) /
      Math.max(shop.production_capacity_per_day, 1) * 0.015);

  return clamp(
    BASE_CONVERSION_RATE + qualityBonus + reputationBonus + priceTerm + trendBonus - fulfillmentPenalty,
    0.02,
    0.15
  );
}

function computeFavoriteRate(
  listing: Listing,
  trendState: TrendState
): number {
  const qualityBonus = (computeListingQuality(listing) / 9) * 0.06;
  const trendBonus = Math.max(0, (getDemandMultiplier(listing, trendState) - 1) / 0.3) * 0.04;

  return clamp(BASE_FAVORITE_RATE + qualityBonus + trendBonus, 0.05, 0.25);
}

function buildBuyerName(seed: string): string {
  const index = Math.floor(stableUnitInterval(seed) * BUYER_NAMES.length) % BUYER_NAMES.length;
  return BUYER_NAMES[index];
}

function buildReviewRating(listing: Listing, orderCreatedAt: string, fulfilledAt: string): number {
  const base = computeListingQuality(listing) >= 6 ? 4 : 3;
  const delayPenalty = differenceInDays(orderCreatedAt, fulfilledAt) > listing.lead_time_days + 1 ? 1 : 0;
  const bonus = stableUnitInterval(`review:${listing.listing_id}:${fulfilledAt}`) >= 0.5 ? 1 : 0;
  return clamp(base + bonus - delayPenalty, 1, 5);
}

function buildReviewText(listing: Listing, rating: number): string {
  if (rating >= 5) {
    return `${listing.title} arrived exactly as hoped and felt worth the wait.`;
  }

  if (rating === 4) {
    return `${listing.title} looked great and the shop kept the experience smooth.`;
  }

  return `${listing.title} was good overall, but the turnaround felt a bit slow.`;
}

function finalizeShopMetrics(world: StoredWorldState, resolutions: Map<number, ShopDayResolution>) {
  world.marketplace.shops = world.marketplace.shops.map((shop) => {
    const listings = world.marketplace.listings.filter((listing) => listing.shop_id === shop.shop_id);
    const normalizedShop = recalculateShopBacklog(shop, listings);
    const resolution = resolutions.get(shop.shop_id);

    if (resolution) {
      resolution.backlog_units_end = normalizedShop.backlog_units;
      resolution.queue_depth_end = normalizedShop.production_queue.length;
    }

    return normalizedShop;
  });
}

function releaseCompletedProduction(
  world: StoredWorldState,
  currentDate: string,
  resolutions: Map<number, ShopDayResolution>,
  nextPendingReviews: PendingReview[]
) {
  for (const shop of world.marketplace.shops) {
    const keptJobs: ProductionQueueItem[] = [];
    const resolution = resolutions.get(shop.shop_id)!;

    for (const job of shop.production_queue) {
      if (job.status !== "waiting_ready" || !job.ready_at || Date.parse(job.ready_at) > Date.parse(currentDate)) {
        keptJobs.push(job);
        continue;
      }

      const listing = world.marketplace.listings.find((item) => item.listing_id === job.listing_id);
      if (!listing) {
        continue;
      }

      resolution.units_released += 1;

      if (job.kind === "stock") {
        listing.quantity_on_hand += 1;
        Object.assign(listing, syncListingInventoryState(listing));
        continue;
      }

      listing.backlog_units = Math.max(0, listing.backlog_units - 1);
      listing.updated_at = currentDate;

      const order = world.marketplace.orders.find((item) => item.receipt_id === job.order_id);
      if (!order) {
        continue;
      }

      order.status = "fulfilled";
      order.was_delivered = true;
      order.updated_at = currentDate;

      const nextReviewId = nextNumericId([
        ...world.marketplace.reviews.map((review) => review.review_id),
        ...nextPendingReviews.map((review) => review.review_id)
      ]);
      const rating = buildReviewRating(listing, order.created_at, currentDate);
      nextPendingReviews.push({
        queue_id: `review-${order.receipt_id}`,
        review_id: nextReviewId,
        shop_id: shop.shop_id,
        receipt_id: order.receipt_id,
        listing_id: listing.listing_id,
        buyer_name: order.buyer_name,
        release_at: addUtcDays(currentDate, 1),
        rating,
        review: buildReviewText(listing, rating)
      });
    }

    shop.production_queue = keptJobs;
  }
}

function settleDelayedEvents(
  world: StoredWorldState,
  currentDate: string,
  resolutions: Map<number, ShopDayResolution>,
  pendingReviews: PendingReview[]
): PendingReview[] {
  for (const payment of world.marketplace.payments) {
    if (payment.status !== "pending") {
      continue;
    }

    if (Date.parse(payment.available_at) > Date.parse(currentDate)) {
      continue;
    }

    payment.status = "posted";
    payment.posted_at = currentDate;
    resolutions.get(payment.shop_id)!.payments_posted += 1;
  }

  const remainingReviews: PendingReview[] = [];
  for (const pendingReview of pendingReviews) {
    if (Date.parse(pendingReview.release_at) > Date.parse(currentDate)) {
      remainingReviews.push(pendingReview);
      continue;
    }

    const review: Review = {
      review_id: pendingReview.review_id,
      shop_id: pendingReview.shop_id,
      listing_id: pendingReview.listing_id,
      rating: pendingReview.rating,
      review: pendingReview.review,
      buyer_name: pendingReview.buyer_name,
      created_at: currentDate
    };
    world.marketplace.reviews.push(review);
    resolutions.get(pendingReview.shop_id)!.reviews_released += 1;
  }

  return remainingReviews;
}

function buildNewListingInventory(listingId: number, sku: string, price: number, quantity: number): ListingInventory {
  return {
    listing_id: listingId,
    products: [
      {
        sku,
        property_values: [],
        offerings: [
          {
            offering_id: listingId * 10,
            price,
            quantity,
            is_enabled: true
          }
        ]
      }
    ],
    price_on_property: [],
    quantity_on_property: [],
    sku_on_property: []
  };
}

function ensureNpcListings(
  world: StoredWorldState,
  currentDate: string,
  controlledShopIds: ReadonlySet<number>
) {
  for (const shop of world.marketplace.shops) {
    if (controlledShopIds.has(shop.shop_id)) {
      continue;
    }

    const pool = NPC_PRODUCT_POOL[shop.shop_id];
    if (!pool || pool.length === 0) {
      continue;
    }

    const existingCount = world.marketplace.listings.filter(
      (listing) => listing.shop_id === shop.shop_id
    ).length;

    if (existingCount >= pool.length) {
      continue;
    }

    let shouldCreate = false;
    if (existingCount === 0) {
      // Day 1: always create the first listing
      shouldCreate = true;
    } else {
      // ~70% chance to add the next listing
      shouldCreate = stableUnitInterval(`npc-listing:${shop.shop_id}:${currentDate}:${existingCount}`) < 0.7;
    }

    if (!shouldCreate) {
      continue;
    }

    const template = pool[existingCount];
    const nextListingId = nextNumericId(world.marketplace.listings.map((l) => l.listing_id));
    const sku = `NPC-${shop.shop_id}-${nextListingId}`;

    const newListing: Listing = {
      ...template,
      listing_id: nextListingId,
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      views: 0,
      favorites: 0,
      url: `https://botique.example/listings/${nextListingId}`,
      created_at: currentDate,
      updated_at: currentDate,
      inventory: buildNewListingInventory(nextListingId, sku, template.price, template.quantity)
    };

    world.marketplace.listings.push(newListing);

    // Queue initial stock production for stocked listings
    if (template.fulfillment_mode === "stocked") {
      const jobSequence = world.marketplace.shops.reduce(
        (sum, s) => sum + s.production_queue.length, 0
      ) + 1;
      shop.production_queue.push(
        createProductionQueueJob(newListing, currentDate, jobSequence, "stock", null)
      );
    }
  }
}

function ensureStockJobs(
  world: StoredWorldState,
  currentDate: string,
  trendState: TrendState,
  controlledShopIds: ReadonlySet<number>
) {
  let sequence = world.marketplace.shops.reduce((sum, shop) => sum + shop.production_queue.length, 0);

  for (const shop of world.marketplace.shops) {
    if (controlledShopIds.has(shop.shop_id)) {
      continue;
    }

    for (const listing of world.marketplace.listings) {
      if (listing.shop_id !== shop.shop_id || !isStockedListing(listing) || listing.state !== "active") {
        continue;
      }

      const targetInventory = Math.max(1, Math.ceil((listing.lead_time_days + 1) * getDemandMultiplier(listing, trendState)));
      const queuedStockUnits = queueUnitsForListing(shop.production_queue, listing.listing_id, "stock");
      const missingUnits = Math.max(0, targetInventory - (listing.quantity_on_hand + queuedStockUnits));

      for (let index = 0; index < missingUnits; index += 1) {
        sequence += 1;
        shop.production_queue.push(createProductionQueueJob(listing, currentDate, sequence, "stock", null));
      }
    }
  }
}

function resolveMarketSales(
  world: StoredWorldState,
  currentDate: string,
  trendState: TrendState,
  resolutions: Map<number, ShopDayResolution>,
  pendingReviews: PendingReview[]
) {
  const preSalesSnapshot = buildMarketSnapshot(world.marketplace, trendState, currentDate);
  let orderId = nextNumericId(world.marketplace.orders.map((order) => order.receipt_id));
  let paymentId = nextNumericId(world.marketplace.payments.map((payment) => payment.payment_id));
  let reviewId = nextNumericId([
    ...world.marketplace.reviews.map((review) => review.review_id),
    ...pendingReviews.map((review) => review.review_id)
  ]);
  let jobSequence = world.marketplace.shops.reduce((sum, shop) => sum + shop.production_queue.length, 0);

  // Group marketplace-active listings by taxonomy
  const activeListings = world.marketplace.listings.filter(isMarketplaceActiveListing);
  const listingsByTaxonomy = new Map<number, Listing[]>();
  for (const listing of activeListings) {
    const group = listingsByTaxonomy.get(listing.taxonomy_id) ?? [];
    group.push(listing);
    listingsByTaxonomy.set(listing.taxonomy_id, group);
  }

  // Pre-build lookup maps to avoid O(N) scans per listing
  const shopById = new Map(world.marketplace.shops.map((shop) => [shop.shop_id, shop]));
  const shopReviewAvgs = new Map<number, number>();
  for (const shop of world.marketplace.shops) {
    const reviews = world.marketplace.reviews.filter((r) => r.shop_id === shop.shop_id);
    shopReviewAvgs.set(
      shop.shop_id,
      reviews.length === 0 ? 4 : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
    );
  }

  for (const [taxonomyId, taxonomyListings] of listingsByTaxonomy) {
    // Stage 1: Generate buyer session traffic for this taxonomy
    const traffic = taxonomyDailyTraffic(taxonomyId, currentDate, trendState);
    const taxonomyAvgPrice =
      preSalesSnapshot.taxonomy.find((item) => item.taxonomy_id === taxonomyId)?.average_price ?? 0;

    // Stage 2: Compute discoverability and allocate views by share-of-voice
    const listingScores = taxonomyListings.map((listing) => {
      const shop = shopById.get(listing.shop_id)!;
      const reviewAvg = shopReviewAvgs.get(shop.shop_id) ?? 4;
      const score = computeDiscoverability(listing, trendState, taxonomyAvgPrice, reviewAvg, currentDate);
      return { listing, shop, reviewAvg, score };
    });
    const totalScore = listingScores.reduce((sum, item) => sum + item.score, 0);

    for (const { listing, shop, reviewAvg, score } of listingScores) {
      const viewShare = totalScore > 0 ? score / totalScore : 1 / taxonomyListings.length;
      const views = stochasticRound(
        traffic * viewShare,
        `views:${currentDate}:${listing.listing_id}`
      );

      listing.views += views;
      const resolution = resolutions.get(shop.shop_id)!;
      resolution.total_views += views;

      // Stage 3: Convert each view independently into favorites and orders
      const favoriteRate = computeFavoriteRate(listing, trendState);
      const orderRate = computeOrderConversionRate(listing, shop, trendState, taxonomyAvgPrice, reviewAvg);

      for (let viewIdx = 0; viewIdx < views; viewIdx += 1) {
        // Favorite check (independent of stock availability)
        if (stableUnitInterval(`fav:${currentDate}:${listing.listing_id}:${viewIdx}`) < favoriteRate) {
          listing.favorites += 1;
          resolution.total_favorites += 1;
        }

        // Order check — stocked listings stop selling at zero inventory
        if (isStockedListing(listing) && listing.quantity_on_hand <= 0) {
          continue;
        }

        if (stableUnitInterval(`order:${currentDate}:${listing.listing_id}:${viewIdx}`) >= orderRate) {
          continue;
        }

        const buyerName = buildBuyerName(`buyer:${currentDate}:${listing.listing_id}:${viewIdx}`);
        const order: Order = {
          receipt_id: orderId,
          shop_id: shop.shop_id,
          buyer_name: buyerName,
          status: isStockedListing(listing) ? "fulfilled" : "paid",
          was_paid: true,
          was_shipped: false,
          was_delivered: isStockedListing(listing),
          total_price: listing.price,
          currency_code: listing.currency_code,
          line_items: [
            {
              listing_id: listing.listing_id,
              title: listing.title,
              quantity: 1,
              price: listing.price
            }
          ],
          created_at: currentDate,
          updated_at: currentDate
        };
        world.marketplace.orders.push(order);

        const payment: Payment = {
          payment_id: paymentId,
          shop_id: shop.shop_id,
          receipt_id: orderId,
          amount: listing.price,
          currency_code: listing.currency_code,
          status: "pending",
          available_at: addUtcDays(currentDate, 1),
          posted_at: currentDate
        };
        world.marketplace.payments.push(payment);

        resolution.orders_created += 1;

        if (isStockedListing(listing)) {
          listing.quantity_on_hand = Math.max(0, listing.quantity_on_hand - 1);
          listing.updated_at = currentDate;
          Object.assign(listing, syncListingInventoryState(listing));
          resolution.stocked_units_sold += 1;

          const rating = buildReviewRating(listing, currentDate, currentDate);
          pendingReviews.push({
            queue_id: `review-${orderId}`,
            review_id: reviewId,
            shop_id: shop.shop_id,
            receipt_id: orderId,
            listing_id: listing.listing_id,
            buyer_name: buyerName,
            release_at: addUtcDays(currentDate, 2),
            rating,
            review: buildReviewText(listing, rating)
          });
          reviewId += 1;
        } else {
          listing.backlog_units += 1;
          listing.updated_at = currentDate;
          resolution.made_to_order_units_sold += 1;
          jobSequence += 1;
          shop.production_queue.unshift(
            createProductionQueueJob(listing, currentDate, jobSequence, "customer_order", orderId)
          );
        }

        orderId += 1;
        paymentId += 1;
      }
    }
  }
}

function sortQueue(queue: ProductionQueueItem[]): ProductionQueueItem[] {
  return [...queue].sort((left, right) => {
    const leftPriority = left.kind === "customer_order" ? 0 : 1;
    const rightPriority = right.kind === "customer_order" ? 0 : 1;
    return (
      leftPriority - rightPriority ||
      Date.parse(left.created_at) - Date.parse(right.created_at) ||
      left.job_id.localeCompare(right.job_id)
    );
  });
}

function allocateProduction(
  world: StoredWorldState,
  currentDate: string,
  resolutions: Map<number, ShopDayResolution>
) {
  for (const shop of world.marketplace.shops) {
    let capacityRemaining = shop.production_capacity_per_day;
    const resolution = resolutions.get(shop.shop_id)!;
    const listingById = new Map(
      world.marketplace.listings.filter((listing) => listing.shop_id === shop.shop_id).map((listing) => [listing.listing_id, listing])
    );

    shop.production_queue = sortQueue(shop.production_queue).map((job) => clone(job));

    for (const job of shop.production_queue) {
      if (job.status === "waiting_ready" || capacityRemaining <= 0) {
        continue;
      }

      const spend = Math.min(capacityRemaining, job.capacity_units_remaining);
      if (spend <= 0) {
        continue;
      }

      if (job.started_at === null) {
        job.started_at = currentDate;
        resolution.production_units_started += 1;
        resolution.material_costs_incurred += job.material_cost;
        shop.material_costs_paid_total = Number((shop.material_costs_paid_total + job.material_cost).toFixed(2));
      }

      job.capacity_units_remaining -= spend;
      job.status = job.capacity_units_remaining === 0 ? "waiting_ready" : "in_progress";
      capacityRemaining -= spend;

      if (job.capacity_units_remaining === 0) {
        const listing = listingById.get(job.listing_id);
        job.ready_at = addUtcDays(currentDate, listing?.lead_time_days ?? 1);
      }
    }
  }
}

function buildStepResult(world: StoredWorldState, previousDayDate: string, nextDayDate: string): AdvanceDayResult["steps"] {
  return [
    {
      name: "advance_clock",
      description: `Advance the simulation clock from ${previousDayDate} to ${nextDayDate}.`
    },
    {
      name: "refresh_trends",
      description: "Rotate the active deterministic trend state before the next day of customer demand resolves."
    },
    {
      name: "release_completed_production",
      description: "Release finished production jobs into stocked inventory or made-to-order fulfillment once their ready date arrives."
    },
    {
      name: "settle_delayed_events",
      description: "Post payments whose delay has elapsed and release queued reviews into the marketplace."
    },
    {
      name: "resolve_market_sales",
      description: "Generate taxonomy-level buyer traffic, distribute views by discoverability share, convert views into favorites and orders, and route orders into stock depletion or backlog creation."
    },
    {
      name: "allocate_production",
      description: "Spend each shop's daily production capacity on a shared queue and incur material cost when new units enter work."
    },
    {
      name: "refresh_market_snapshot",
      description: "Recompute inspectable market totals after sales, backlog changes, and production scheduling."
    }
  ];
}

export function resolveAdvanceDay(
  world: StoredWorldState,
  options: DayResolutionOptions = {}
): AdvanceDayResult {
  const currentWorld = normalizeWorldState(world);
  const advancedAt = new Date().toISOString();
  const nextDay = nextSimulationDay(currentWorld.simulation.current_day, advancedAt);
  const nextTrendState = buildTrendState(currentWorld.marketplace, nextDay, advancedAt);
  const resolutions = createResolutionMap(currentWorld.marketplace.shops);
  const pendingReviews = clone(currentWorld.simulation.pending_reviews ?? []);
  const controlledShopIds = new Set(
    (options.controlled_shop_ids ?? []).map((shopId) => Number(shopId))
  );

  releaseCompletedProduction(currentWorld, nextDay.date, resolutions, pendingReviews);
  const unsettledReviews = settleDelayedEvents(currentWorld, nextDay.date, resolutions, pendingReviews);
  ensureNpcListings(currentWorld, nextDay.date, controlledShopIds);
  resolveMarketSales(currentWorld, nextDay.date, nextTrendState, resolutions, unsettledReviews);
  ensureStockJobs(currentWorld, nextDay.date, nextTrendState, controlledShopIds);
  allocateProduction(currentWorld, nextDay.date, resolutions);
  finalizeShopMetrics(currentWorld, resolutions);

  const nextSimulation = {
    current_day: nextDay,
    scenario: currentWorld.simulation.scenario,
    trend_state: nextTrendState,
    market_snapshot: buildMarketSnapshot(currentWorld.marketplace, nextTrendState, advancedAt),
    pending_reviews: unsettledReviews,
    last_resolution: {
      resolved_at: advancedAt,
      pending_review_count: unsettledReviews.length,
      shops: [...resolutions.values()].sort((left, right) => left.shop_id - right.shop_id)
    } satisfies DayResolutionSummary
  };

  return {
    world: {
      marketplace: currentWorld.marketplace,
      simulation: nextSimulation
    },
    previous_day: currentWorld.simulation.current_day,
    current_day: nextSimulation.current_day,
    steps: buildStepResult(currentWorld, currentWorld.simulation.current_day.date, nextDay.date)
  };
}
