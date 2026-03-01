import type { Listing, Order, Payment, Review } from "../schemas/domain";
import { isMarketplaceActiveListing } from "../listing-availability";
import { computeListingQuality } from "./ranking";
import { addUtcDays, createPendingEventCounts, withUtcTime } from "./state";
import type {
  DayResolutionSummary,
  ListingDemandFactors,
  ListingDayResolution,
  PendingEvent,
  PendingEventCounts,
  SimulationDay,
  StoredMarketplaceState,
  TrendState
} from "./state-types";

type DayResolutionResult = {
  marketplace: StoredMarketplaceState;
  pendingEvents: PendingEvent[];
  summary: DayResolutionSummary;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function differenceInUtcDays(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Math.max(0, Math.floor((leftTime - rightTime) / 86_400_000));
}

function hashToUnitInterval(input: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_295;
}

function stochasticRound(expected: number, seed: string): number {
  if (expected <= 0) {
    return 0;
  }

  const whole = Math.floor(expected);
  const fraction = expected - whole;
  return whole + (hashToUnitInterval(seed) < fraction ? 1 : 0);
}

function maxId(values: number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), 0);
}

function trendMultiplierForListing(listing: Listing, trendState: TrendState): number {
  const listingTags = new Set(listing.tags.map((tag) => tag.trim().toLowerCase()));
  let multiplier = trendState.baseline_multiplier;

  for (const trend of trendState.active_trends) {
    if (trend.taxonomy_id !== null && trend.taxonomy_id === listing.taxonomy_id) {
      multiplier = Math.max(multiplier, trend.demand_multiplier);
      continue;
    }

    if (trend.tags.some((tag) => listingTags.has(tag.trim().toLowerCase()))) {
      multiplier = Math.max(multiplier, roundTo(1 + (trend.demand_multiplier - 1) * 0.45));
    }
  }

  return multiplier;
}

function buildShopReviewAverage(state: StoredMarketplaceState): Map<number, number> {
  const grouped = new Map<number, number[]>();

  for (const review of state.reviews) {
    const ratings = grouped.get(review.shop_id) ?? [];
    ratings.push(review.rating);
    grouped.set(review.shop_id, ratings);
  }

  return new Map(
    [...grouped.entries()].map(([shopId, ratings]) => [shopId, average(ratings)])
  );
}

function buildTaxonomyReferencePrices(state: StoredMarketplaceState): Map<number, number> {
  const grouped = new Map<number, number[]>();

  for (const listing of state.listings.filter(isMarketplaceActiveListing)) {
    const prices = grouped.get(listing.taxonomy_id) ?? [];
    prices.push(listing.price);
    grouped.set(listing.taxonomy_id, prices);
  }

  return new Map(
    [...grouped.entries()].map(([taxonomyId, prices]) => [taxonomyId, median(prices)])
  );
}

function priceClickFit(listingPrice: number, referencePrice: number): number {
  const priceDelta = referencePrice > 0 ? (listingPrice - referencePrice) / referencePrice : 0;
  return roundTo(clamp(1.05 - priceDelta * 0.35, 0.75, 1.25));
}

function conversionPrice(input: {
  listingPrice: number;
  referencePrice: number;
}): number {
  const { listingPrice, referencePrice } = input;
  const clickFit = priceClickFit(listingPrice, referencePrice);
  return roundTo((clickFit - 1) * 0.02, 4);
}

function listingDemandFactors(input: {
  listing: Listing;
  currentDay: SimulationDay;
  trendState: TrendState;
  shopReviewAverage: number;
  taxonomyReferencePrice: number;
}): ListingDemandFactors {
  const { listing, currentDay, trendState, shopReviewAverage, taxonomyReferencePrice } = input;
  const quality = clamp(0.8 + computeListingQuality(listing) / 10, 0.85, 1.7);
  const reputation = clamp(0.9 + (shopReviewAverage > 0 ? shopReviewAverage : 4.2) / 10, 0.95, 1.45);
  const referencePrice = taxonomyReferencePrice > 0 ? taxonomyReferencePrice : listing.price;
  const price = priceClickFit(listing.price, referencePrice);
  const freshness = clamp(1.15 - differenceInUtcDays(currentDay.date, listing.created_at) * 0.03, 0.78, 1.15);
  const trend = clamp(trendMultiplierForListing(listing, trendState), 1, 1.35);
  const variation = clamp(
    0.9 + hashToUnitInterval(`variation:${currentDay.day}:${listing.listing_id}`) * 0.2,
    0.9,
    1.1
  );

  return {
    quality: roundTo(quality),
    reputation: roundTo(reputation),
    price: roundTo(price),
    reference_price: roundTo(referencePrice),
    conversion_price: conversionPrice({
      listingPrice: listing.price,
      referencePrice
    }),
    freshness: roundTo(freshness),
    trend: roundTo(trend),
    variation: roundTo(variation)
  };
}

function discoverabilityScore(factors: ListingDemandFactors): number {
  return roundTo(
    factors.quality *
      factors.reputation *
      factors.price *
      factors.freshness *
      factors.trend *
      factors.variation
  );
}

function favoriteRate(factors: ListingDemandFactors): number {
  return clamp(
    0.035 +
      (factors.quality - 1) * 0.05 +
      (factors.reputation - 1) * 0.03 +
      (factors.trend - 1) * 0.03,
    0.02,
    0.18
  );
}

function conversionRate(factors: ListingDemandFactors): number {
  return roundTo(
    clamp(
      0.01 +
        (factors.quality - 1) * 0.02 +
        (factors.reputation - 1) * 0.015 +
        (factors.conversion_price ?? (factors.price - 1) * 0.02) +
        (factors.trend - 1) * 0.015,
      0.004,
      0.08
    ),
    4
  );
}

function taxonomyDailyTraffic(input: {
  taxonomyId: number;
  listingCount: number;
  currentDay: SimulationDay;
  trendState: TrendState;
}): number {
  const { taxonomyId, listingCount, currentDay, trendState } = input;
  const taxonomyMultiplier = Math.max(
    trendState.baseline_multiplier,
    ...trendState.active_trends
      .filter((trend) => trend.taxonomy_id === taxonomyId)
      .map((trend) => trend.demand_multiplier)
  );

  return Math.max(
    listingCount,
    Math.round(
      (8 + listingCount * 4) *
        taxonomyMultiplier *
        (0.9 + hashToUnitInterval(`traffic:${currentDay.day}:${taxonomyId}`) * 0.2)
    )
  );
}

function availableUnits(listing: Listing): number {
  return listing.inventory.products.reduce(
    (sum, product) =>
      sum + product.offerings.reduce((offeringSum, offering) => offeringSum + (offering.is_enabled ? offering.quantity : 0), 0),
    0
  );
}

function consumeInventory(listing: Listing, quantity: number) {
  let remaining = quantity;

  for (const product of listing.inventory.products) {
    for (const offering of product.offerings) {
      if (!offering.is_enabled || remaining === 0) {
        continue;
      }

      const consumed = Math.min(offering.quantity, remaining);
      offering.quantity -= consumed;
      remaining -= consumed;
    }
  }

  listing.quantity = Math.max(0, listing.quantity - (quantity - remaining));
  if (!isMarketplaceActiveListing(listing)) {
    listing.state = "sold_out";
  }
}

function buildBuyerName(seed: string): string {
  const firstNames = [
    "Ava",
    "Noah",
    "Mia",
    "Leo",
    "Ivy",
    "Mason",
    "Zoe",
    "Ethan"
  ];
  const lastNames = [
    "Chen",
    "Brooks",
    "Ramirez",
    "Nguyen",
    "Patel",
    "Kim",
    "Walker",
    "Diaz"
  ];

  const firstIndex = Math.floor(hashToUnitInterval(`buyer:first:${seed}`) * firstNames.length);
  const lastIndex = Math.floor(hashToUnitInterval(`buyer:last:${seed}`) * lastNames.length);
  return `${firstNames[firstIndex]} ${lastNames[lastIndex]}`;
}

function reviewRating(factors: ListingDemandFactors, seed: string): number {
  const raw =
    3.5 +
    (factors.quality - 1) * 1.2 +
    (factors.reputation - 1) * 0.9 +
    (factors.price - 1) * 0.7 +
    (hashToUnitInterval(`review:rating:${seed}`) - 0.5) * 0.4;

  return Math.round(clamp(raw, 3, 5));
}

function reviewText(listing: Listing, rating: number, seed: string): string {
  const focus = listing.tags[0] ?? listing.title.split(/\s+/)[0]?.toLowerCase() ?? "design";
  const positiveTemplates = [
    `Easy download and polished ${focus} styling.`,
    `Clear files and the ${focus} theme really lands.`,
    `Strong quality and the ${focus} details feel intentional.`
  ];
  const mixedTemplates = [
    `Good overall result and the ${focus} concept works well.`,
    `Nice files and a solid ${focus} direction.`,
    `Happy with the purchase and the ${focus} look feels thoughtful.`
  ];

  const templates = rating >= 5 ? positiveTemplates : mixedTemplates;
  const index = Math.floor(hashToUnitInterval(`review:text:${seed}`) * templates.length);
  return templates[index];
}

function countEvents(events: PendingEvent[]): PendingEventCounts {
  const counts = createPendingEventCounts();
  for (const event of events) {
    counts[event.type] += 1;
  }
  return counts;
}

function resolveActiveListings(input: {
  marketplace: StoredMarketplaceState;
  currentDay: SimulationDay;
  trendState: TrendState;
}): {
  marketplace: StoredMarketplaceState;
  listingMetrics: ListingDayResolution[];
  scheduledEvents: PendingEvent[];
} {
  const { marketplace, currentDay, trendState } = input;
  const nextMarketplace = clone(marketplace);
  const activeListings = nextMarketplace.listings.filter(isMarketplaceActiveListing);
  const activeByTaxonomy = new Map<number, Listing[]>();
  const shopReviewAverage = buildShopReviewAverage(nextMarketplace);
  const taxonomyReferencePrices = buildTaxonomyReferencePrices(nextMarketplace);
  const scheduledEvents: PendingEvent[] = [];
  const listingMetrics: ListingDayResolution[] = [];

  let nextReceiptId = maxId(nextMarketplace.orders.map((order) => order.receipt_id));
  let nextPaymentId = maxId(nextMarketplace.payments.map((payment) => payment.payment_id));

  for (const listing of activeListings) {
    const items = activeByTaxonomy.get(listing.taxonomy_id) ?? [];
    items.push(listing);
    activeByTaxonomy.set(listing.taxonomy_id, items);
  }

  for (const [taxonomyId, listings] of activeByTaxonomy.entries()) {
    const taxonomyTraffic = taxonomyDailyTraffic({
      taxonomyId,
      listingCount: listings.length,
      currentDay,
      trendState
    });

    const scoredListings = listings.map((listing) => {
      const factors = listingDemandFactors({
        listing,
        currentDay,
        trendState,
        shopReviewAverage: shopReviewAverage.get(listing.shop_id) ?? 0,
        taxonomyReferencePrice:
          taxonomyReferencePrices.get(listing.taxonomy_id) ?? listing.price
      });

      return {
        listing,
        factors,
        score: discoverabilityScore(factors)
      };
    });

    const totalScore = scoredListings.reduce((sum, item) => sum + item.score, 0);

    for (const item of scoredListings) {
      const share = totalScore > 0 ? item.score / totalScore : 1 / scoredListings.length;
      const viewsGained = stochasticRound(
        taxonomyTraffic * share,
        `views:${currentDay.day}:${item.listing.listing_id}`
      );
      const favoritesGained = Math.min(
        viewsGained,
        stochasticRound(
          viewsGained * favoriteRate(item.factors),
          `favorites:${currentDay.day}:${item.listing.listing_id}`
        )
      );
      const orderExpectation =
        viewsGained * conversionRate(item.factors) + favoritesGained * 0.2;
      const orderCount = Math.min(
        availableUnits(item.listing),
        stochasticRound(
          orderExpectation,
          `orders:${currentDay.day}:${item.listing.listing_id}`
        )
      );

      item.listing.views += viewsGained;
      item.listing.favorites += favoritesGained;
      if (orderCount > 0) {
        consumeInventory(item.listing, orderCount);
      }

      for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
        nextReceiptId += 1;
        nextPaymentId += 1;

        const seed = `${currentDay.day}:${item.listing.listing_id}:${orderIndex}`;
        const buyerName = buildBuyerName(seed);
        const orderTimestamp = withUtcTime(
          currentDay.date,
          9 + Math.floor(hashToUnitInterval(`order:hour:${seed}`) * 8),
          Math.floor(hashToUnitInterval(`order:minute:${seed}`) * 12) * 5
        );

        const order: Order = {
          receipt_id: nextReceiptId,
          shop_id: item.listing.shop_id,
          buyer_name: buyerName,
          status: "paid",
          was_paid: true,
          was_shipped: false,
          was_delivered: true,
          total_price: item.listing.price,
          currency_code: item.listing.currency_code,
          line_items: [
            {
              listing_id: item.listing.listing_id,
              title: item.listing.title,
              quantity: 1,
              price: item.listing.price
            }
          ],
          created_at: orderTimestamp,
          updated_at: orderTimestamp
        };
        nextMarketplace.orders.push(order);

        const payment: Payment = {
          payment_id: nextPaymentId,
          shop_id: item.listing.shop_id,
          receipt_id: order.receipt_id,
          amount: item.listing.price,
          currency_code: item.listing.currency_code,
          status: "pending",
          posted_at: orderTimestamp
        };
        nextMarketplace.payments.push(payment);

        const paymentDelayDays = 1;
        scheduledEvents.push({
          event_id: `payment-${payment.payment_id}`,
          type: "post_payment",
          shop_id: payment.shop_id,
          listing_id: item.listing.listing_id,
          receipt_id: payment.receipt_id,
          scheduled_for_day: currentDay.day + paymentDelayDays,
          scheduled_for_date: withUtcTime(addUtcDays(currentDay.date, paymentDelayDays), 8, 0),
          created_at: currentDay.date,
          payload: {
            payment_id: payment.payment_id,
            amount: payment.amount,
            currency_code: payment.currency_code
          }
        });

        const reviewLikelihood = clamp(
          0.28 +
            (item.factors.quality - 1) * 0.2 +
            (item.factors.reputation - 1) * 0.15,
          0.18,
          0.72
        );
        if (hashToUnitInterval(`review:chance:${seed}`) < reviewLikelihood) {
          const rating = reviewRating(item.factors, seed);
          const reviewDelayDays = hashToUnitInterval(`review:delay:${seed}`) < 0.55 ? 2 : 3;
          scheduledEvents.push({
            event_id: `review-${order.receipt_id}`,
            type: "create_review",
            shop_id: order.shop_id,
            listing_id: item.listing.listing_id,
            receipt_id: order.receipt_id,
            scheduled_for_day: currentDay.day + reviewDelayDays,
            scheduled_for_date: withUtcTime(addUtcDays(currentDay.date, reviewDelayDays), 10, 30),
            created_at: currentDay.date,
            payload: {
              buyer_name: buyerName,
              rating,
              review: reviewText(item.listing, rating, seed)
            }
          });
        }
      }

      listingMetrics.push({
        listing_id: item.listing.listing_id,
        shop_id: item.listing.shop_id,
        views_gained: viewsGained,
        favorites_gained: favoritesGained,
        orders_created: orderCount,
        revenue: roundTo(orderCount * item.listing.price),
        demand_score: item.score,
        conversion_rate: conversionRate(item.factors),
        demand_factors: item.factors
      });
    }
  }

  return {
    marketplace: nextMarketplace,
    listingMetrics: listingMetrics.sort(
      (left, right) =>
        right.orders_created - left.orders_created ||
        right.views_gained - left.views_gained ||
        left.listing_id - right.listing_id
    ),
    scheduledEvents
  };
}

function applyPendingEvents(input: {
  marketplace: StoredMarketplaceState;
  pendingEvents: PendingEvent[];
  nextDay: SimulationDay;
}): {
  marketplace: StoredMarketplaceState;
  pendingEvents: PendingEvent[];
  processedEvents: PendingEventCounts;
} {
  const { pendingEvents, nextDay } = input;
  const nextMarketplace = clone(input.marketplace);
  const remainingEvents: PendingEvent[] = [];
  const processedEvents = createPendingEventCounts();
  let nextReviewId = maxId(nextMarketplace.reviews.map((review) => review.review_id));

  for (const event of pendingEvents) {
    if (event.scheduled_for_day > nextDay.day) {
      remainingEvents.push(event);
      continue;
    }

    if (event.type === "post_payment") {
      const paymentId = Number(event.payload.payment_id ?? 0);
      const payment = nextMarketplace.payments.find((item) => item.payment_id === paymentId);
      if (!payment || payment.status === "posted") {
        continue;
      }

      payment.status = "posted";
      payment.posted_at = event.scheduled_for_date;
      processedEvents.post_payment += 1;
      continue;
    }

    if (event.type === "create_review") {
      const listingId = event.listing_id;
      if (listingId === null) {
        continue;
      }

      const buyerName = String(event.payload.buyer_name ?? "Botique Customer");
      const receiptId = event.receipt_id;
      const alreadyExists = nextMarketplace.reviews.some(
        (review) =>
          (receiptId !== null && review.receipt_id === receiptId) ||
          (review.receipt_id == null && review.listing_id === listingId && review.buyer_name === buyerName)
      );
      if (alreadyExists) {
        continue;
      }

      nextReviewId += 1;
      const review: Review = {
        review_id: nextReviewId,
        shop_id: event.shop_id,
        listing_id: listingId,
        receipt_id: receiptId,
        rating: Number(event.payload.rating ?? 4),
        review: String(event.payload.review ?? "Solid purchase experience."),
        buyer_name: buyerName,
        created_at: event.scheduled_for_date
      };
      nextMarketplace.reviews.push(review);
      processedEvents.create_review += 1;
      continue;
    }

    remainingEvents.push(event);
  }

  return {
    marketplace: nextMarketplace,
    pendingEvents: remainingEvents,
    processedEvents
  };
}

export function resolveMarketplaceDay(input: {
  marketplace: StoredMarketplaceState;
  currentDay: SimulationDay;
  nextDay: SimulationDay;
  trendState: TrendState;
  pendingEvents: PendingEvent[];
  advancedAt: string;
}): DayResolutionResult {
  const listingResolution = resolveActiveListings({
    marketplace: input.marketplace,
    currentDay: input.currentDay,
    trendState: input.trendState
  });
  const combinedPendingEvents = [...input.pendingEvents, ...listingResolution.scheduledEvents].sort(
    (left, right) =>
      left.scheduled_for_day - right.scheduled_for_day ||
      left.event_id.localeCompare(right.event_id)
  );
  const pendingResolution = applyPendingEvents({
    marketplace: listingResolution.marketplace,
    pendingEvents: combinedPendingEvents,
    nextDay: input.nextDay
  });
  const scheduledEvents = countEvents(listingResolution.scheduledEvents);
  const totals = listingResolution.listingMetrics.reduce(
    (summary, metric) => ({
      active_listings: summary.active_listings + 1,
      views_gained: summary.views_gained + metric.views_gained,
      favorites_gained: summary.favorites_gained + metric.favorites_gained,
      orders_created: summary.orders_created + metric.orders_created,
      revenue: roundTo(summary.revenue + metric.revenue)
    }),
    {
      active_listings: 0,
      views_gained: 0,
      favorites_gained: 0,
      orders_created: 0,
      revenue: 0
    }
  );

  return {
    marketplace: pendingResolution.marketplace,
    pendingEvents: pendingResolution.pendingEvents,
    summary: {
      resolved_for_day: clone(input.currentDay),
      resolved_at: input.advancedAt,
      totals,
      listing_metrics: listingResolution.listingMetrics,
      scheduled_events: scheduledEvents,
      processed_events: pendingResolution.processedEvents,
      pending_event_count: pendingResolution.pendingEvents.length
    }
  };
}
