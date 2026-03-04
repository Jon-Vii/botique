import type { Listing } from "../schemas/domain";
import { MS_PER_DAY } from "./state";
import type { MarketplaceSearchContext } from "./state-types";
const PRICE_FIT_LOW_THRESHOLD = 15;
const PRICE_FIT_HIGH_THRESHOLD = 25;

function differenceInUtcDays(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Math.max(0, Math.floor((leftTime - rightTime) / MS_PER_DAY));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function computeListingQuality(listing: Listing): number {
  const titleScore = Math.min(listing.title.length / 20, 3);
  const descriptionScore = Math.min(listing.description.length / 80, 3);
  const tagScore = Math.min(listing.tags.length * 0.6, 3);
  return Number((titleScore + descriptionScore + tagScore).toFixed(2));
}

export function computeTrendBonus(listing: Listing, context: MarketplaceSearchContext): number {
  const listingTags = new Set(listing.tags.map(normalizeText));

  let bonus = 0;
  for (const trend of context.trend_state.active_trends) {
    const taxonomyMatch = trend.taxonomy_id !== null && listing.taxonomy_id === trend.taxonomy_id;
    const tagMatch = trend.tags.some((tag) => listingTags.has(normalizeText(tag)));

    if (taxonomyMatch) {
      bonus = Math.max(bonus, (trend.demand_multiplier - 1) * 4);
      continue;
    }

    if (tagMatch) {
      bonus = Math.max(bonus, (trend.demand_multiplier - 1) * 2);
    }
  }

  return Number(bonus.toFixed(2));
}

export function computeKeywordRelevance(
  listing: Listing,
  keywords: string[],
  supplementalTexts: string[] = []
): number {
  if (keywords.length === 0) {
    return 0;
  }

  const title = listing.title.toLowerCase();
  const description = listing.description.toLowerCase();
  const tags = listing.tags.map((tag) => tag.toLowerCase());
  const supplemental = supplementalTexts.map((text) => text.toLowerCase());

  return keywords.reduce((score, term) => {
    let termScore = 0;
    if (title.includes(term)) {
      termScore += 4;
    }
    if (description.includes(term)) {
      termScore += 2;
    }
    if (tags.some((tag) => tag.includes(term))) {
      termScore += 3;
    }
    if (supplemental.some((text) => text.includes(term))) {
      termScore += 2;
    }
    return score + termScore;
  }, 0);
}

export function scoreMarketplaceListing(input: {
  listing: Listing;
  keywords: string[];
  keywordSupplementalTexts?: string[];
  shopReviewAverage: number;
  newestListingTimestamp: number;
  searchContext: MarketplaceSearchContext;
}): number {
  const {
    listing,
    keywords,
    keywordSupplementalTexts = [],
    shopReviewAverage,
    newestListingTimestamp,
    searchContext
  } = input;

  const keywordRelevance = computeKeywordRelevance(listing, keywords, keywordSupplementalTexts);
  const quality = computeListingQuality(listing);
  const priceFit = listing.price <= PRICE_FIT_LOW_THRESHOLD ? 2 : listing.price <= PRICE_FIT_HIGH_THRESHOLD ? 1 : 0;
  const listingAgeDays = differenceInUtcDays(searchContext.current_day.date, listing.created_at);
  const recencyBonus = Math.max(0, 7 - listingAgeDays);
  const trendBonus = computeTrendBonus(listing, searchContext);
  const freshnessBonus = Math.max(
    0,
    2 - Math.floor((newestListingTimestamp - Date.parse(listing.created_at)) / MS_PER_DAY)
  );

  return Number(
    (keywordRelevance + quality + shopReviewAverage + priceFit + recencyBonus + trendBonus + freshnessBonus).toFixed(2)
  );
}
