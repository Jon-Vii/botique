import type { Listing, ListingInventory } from "./schemas/domain";

function hasEnabledInventory(inventory: ListingInventory): boolean {
  return inventory.products.some((product) =>
    product.offerings.some((offering) => offering.is_enabled && offering.quantity > 0)
  );
}

export function isMarketplaceActiveListing(listing: Listing): boolean {
  return listing.state === "active" && listing.quantity > 0 && hasEnabledInventory(listing.inventory);
}
