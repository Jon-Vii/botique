import type { Listing, ListingInventory } from "./schemas/domain";
import { isMadeToOrderListing } from "./simulation/production";

function hasEnabledInventory(inventory: ListingInventory): boolean {
  return inventory.products.some((product) =>
    product.offerings.some((offering) => offering.is_enabled && offering.quantity > 0)
  );
}

export function isMarketplaceActiveListing(listing: Listing): boolean {
  if (listing.state !== "active") {
    return false;
  }

  if (isMadeToOrderListing(listing)) {
    return hasEnabledInventory(listing.inventory) || listing.quantity > 0;
  }

  return listing.quantity_on_hand > 0 && hasEnabledInventory(listing.inventory);
}
