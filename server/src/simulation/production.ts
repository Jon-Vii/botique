import type {
  FulfillmentMode,
  Listing,
  ListingInventory,
  ProductionQueueItem,
  StoredShop
} from "../schemas/domain";

export const MADE_TO_ORDER_AVAILABLE_QUANTITY = 999;
export const DEFAULT_PRODUCTION_CAPACITY_PER_DAY = 6;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function setStockedInventoryQuantity(inventory: ListingInventory, quantityOnHand: number): ListingInventory {
  const nextInventory = clone(inventory);
  let remaining = quantityOnHand;

  for (const product of nextInventory.products) {
    for (const offering of product.offerings) {
      if (!offering.is_enabled) {
        offering.quantity = 0;
        continue;
      }

      const nextQuantity = Math.max(0, remaining);
      offering.quantity = nextQuantity;
      remaining = Math.max(0, remaining - nextQuantity);
      if (remaining === 0) {
        continue;
      }
    }
  }

  const firstEnabledOffering = nextInventory.products
    .flatMap((product) => product.offerings)
    .find((offering) => offering.is_enabled);

  if (firstEnabledOffering) {
    firstEnabledOffering.quantity += remaining;
  }

  return nextInventory;
}

export function syncListingInventoryState(listing: Listing): Listing {
  const nextListing = clone(listing);

  if (nextListing.fulfillment_mode === "stocked") {
    nextListing.quantity = nextListing.quantity_on_hand;
    nextListing.inventory = setStockedInventoryQuantity(nextListing.inventory, nextListing.quantity_on_hand);
    return nextListing;
  }

  nextListing.quantity = Math.max(nextListing.quantity, MADE_TO_ORDER_AVAILABLE_QUANTITY);
  return nextListing;
}

export function normalizeListingProduction(listing: Listing): Listing {
  const fulfillmentMode = (listing.fulfillment_mode ?? "stocked") as FulfillmentMode;
  const normalized: Listing = {
    ...clone(listing),
    fulfillment_mode: fulfillmentMode,
    quantity_on_hand:
      listing.quantity_on_hand ??
      (fulfillmentMode === "stocked" ? listing.quantity : 0),
    backlog_units: listing.backlog_units ?? 0,
    material_cost_per_unit: listing.material_cost_per_unit ?? 0,
    capacity_units_per_item: Math.max(1, listing.capacity_units_per_item ?? 1),
    lead_time_days: Math.max(1, listing.lead_time_days ?? 1)
  };

  return syncListingInventoryState(normalized);
}

export function normalizeShopProduction(shop: StoredShop): StoredShop {
  return {
    ...clone(shop),
    production_capacity_per_day: Math.max(0, shop.production_capacity_per_day ?? DEFAULT_PRODUCTION_CAPACITY_PER_DAY),
    backlog_units: Math.max(0, shop.backlog_units ?? 0),
    material_costs_paid_total: shop.material_costs_paid_total ?? 0,
    production_queue: clone(shop.production_queue ?? [])
  };
}

export function queueUnitsForListing(
  queue: ProductionQueueItem[],
  listingId: number,
  kind?: ProductionQueueItem["kind"]
): number {
  return queue.reduce((sum, job) => {
    if (job.listing_id !== listingId) {
      return sum;
    }

    if (kind && job.kind !== kind) {
      return sum;
    }

    return sum + 1;
  }, 0);
}

export function recalculateShopBacklog(shop: StoredShop, listings: Listing[]): StoredShop {
  return {
    ...clone(shop),
    backlog_units: listings
      .filter((listing) => listing.shop_id === shop.shop_id)
      .reduce((sum, listing) => sum + listing.backlog_units, 0)
  };
}

export function isStockedListing(listing: Listing): boolean {
  return listing.fulfillment_mode === "stocked";
}

export function isMadeToOrderListing(listing: Listing): boolean {
  return listing.fulfillment_mode === "made_to_order";
}

export function createProductionQueueJob(
  listing: Listing,
  currentDate: string,
  sequence: number,
  kind: ProductionQueueItem["kind"],
  orderId: number | null
): ProductionQueueItem {
  return {
    job_id: `${kind}-${listing.shop_id}-${listing.listing_id}-${Date.parse(currentDate)}-${sequence}`,
    listing_id: listing.listing_id,
    order_id: orderId,
    kind,
    status: "queued",
    created_at: currentDate,
    started_at: null,
    ready_at: null,
    capacity_units_required: listing.capacity_units_per_item,
    capacity_units_remaining: listing.capacity_units_per_item,
    material_cost: listing.material_cost_per_unit
  };
}
