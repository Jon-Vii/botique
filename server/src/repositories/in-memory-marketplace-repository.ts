import type {
  Listing,
  ListingInventory,
  Order,
  Payment,
  Review,
  Shop,
  StoredShop,
  TaxonomyNode
} from "../schemas/domain";
import type {
  CreateListingData,
  MarketplaceRepository,
  MutationMetadata,
  UpdateListingData,
  UpdateShopData
} from "./types";
import { createDefaultMarketplaceState } from "../default-marketplace-state";
import { isMarketplaceActiveListing } from "../listing-availability";
import { normalizeWorldState } from "../simulation/state";
import type { SimulationState, StoredMarketplaceState, StoredWorldState } from "../simulation/state-types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function mutationTimestamp(metadata?: MutationMetadata): string {
  return metadata?.timestamp ?? new Date().toISOString();
}

export class InMemoryMarketplaceRepository implements MarketplaceRepository {
  private readonly state: StoredWorldState;

  constructor(seedState?: StoredMarketplaceState | StoredWorldState) {
    this.state = normalizeWorldState(seedState ?? createDefaultMarketplaceState());
  }

  async getMarketplaceState(): Promise<StoredMarketplaceState> {
    return clone(this.state.marketplace);
  }

  async getSimulationState(): Promise<SimulationState> {
    return clone(this.state.simulation);
  }

  async setSimulationState(state: SimulationState): Promise<SimulationState> {
    this.state.simulation = clone(state);
    return clone(this.state.simulation);
  }

  async setWorldState(state: StoredWorldState): Promise<StoredWorldState> {
    const normalized = normalizeWorldState(state);
    this.state.marketplace = normalized.marketplace;
    this.state.simulation = normalized.simulation;
    return clone(this.state);
  }

  async getShop(shopId: number): Promise<Shop | null> {
    const shop = this.state.marketplace.shops.find((item) => item.shop_id === shopId);
    return shop ? this.hydrateShop(shop) : null;
  }

  async listShops(): Promise<Shop[]> {
    return this.state.marketplace.shops.map((shop) => this.hydrateShop(shop));
  }

  async updateShop(shopId: number, patch: UpdateShopData, metadata?: MutationMetadata): Promise<Shop | null> {
    const index = this.state.marketplace.shops.findIndex((item) => item.shop_id === shopId);
    if (index === -1) {
      return null;
    }

    this.state.marketplace.shops[index] = {
      ...this.state.marketplace.shops[index],
      ...patch,
      updated_at: mutationTimestamp(metadata)
    };

    return this.hydrateShop(this.state.marketplace.shops[index]);
  }

  async getListing(listingId: number): Promise<Listing | null> {
    const listing = this.state.marketplace.listings.find((item) => item.listing_id === listingId);
    return listing ? clone(listing) : null;
  }

  async listShopListings(shopId: number): Promise<Listing[]> {
    return this.state.marketplace.listings
      .filter((listing) => listing.shop_id === shopId)
      .map((listing) => clone(listing));
  }

  async listActiveListings(): Promise<Listing[]> {
    return this.state.marketplace.listings
      .filter(isMarketplaceActiveListing)
      .map((listing) => clone(listing));
  }

  async createListing(data: CreateListingData, metadata?: MutationMetadata): Promise<Listing> {
    const listingId = this.nextId(this.state.marketplace.listings.map((item) => item.listing_id));
    const timestamp = mutationTimestamp(metadata);
    const listing: Listing = {
      ...clone(data),
      listing_id: listingId,
      created_at: timestamp,
      updated_at: timestamp
    };
    this.state.marketplace.listings.push(listing);
    return clone(listing);
  }

  async updateListing(
    shopId: number,
    listingId: number,
    patch: UpdateListingData,
    metadata?: MutationMetadata
  ): Promise<Listing | null> {
    const index = this.state.marketplace.listings.findIndex(
      (listing) => listing.shop_id === shopId && listing.listing_id === listingId
    );
    if (index === -1) {
      return null;
    }

    this.state.marketplace.listings[index] = {
      ...this.state.marketplace.listings[index],
      ...clone(patch),
      updated_at: mutationTimestamp(metadata)
    };

    return clone(this.state.marketplace.listings[index]);
  }

  async deleteListing(shopId: number, listingId: number): Promise<boolean> {
    const index = this.state.marketplace.listings.findIndex(
      (listing) => listing.shop_id === shopId && listing.listing_id === listingId
    );
    if (index === -1) {
      return false;
    }

    this.state.marketplace.listings.splice(index, 1);
    return true;
  }

  async replaceListingInventory(
    listingId: number,
    inventory: ListingInventory,
    metadata?: MutationMetadata
  ): Promise<ListingInventory | null> {
    const listing = this.state.marketplace.listings.find((item) => item.listing_id === listingId);
    if (!listing) {
      return null;
    }

    listing.inventory = clone(inventory);
    listing.quantity = inventory.products.reduce(
      (sum, product) =>
        sum + product.offerings.reduce((offeringSum, offering) => offeringSum + offering.quantity, 0),
      0
    );
    const firstOffering = inventory.products[0]?.offerings[0];
    if (firstOffering) {
      listing.price = firstOffering.price;
    }
    listing.updated_at = mutationTimestamp(metadata);
    return clone(listing.inventory);
  }

  async listOrders(shopId: number): Promise<Order[]> {
    return this.state.marketplace.orders
      .filter((order) => order.shop_id === shopId)
      .map((order) => clone(order));
  }

  async getOrder(shopId: number, receiptId: number): Promise<Order | null> {
    const order = this.state.marketplace.orders.find(
      (item) => item.shop_id === shopId && item.receipt_id === receiptId
    );
    return order ? clone(order) : null;
  }

  async listReviews(shopId: number): Promise<Review[]> {
    return this.state.marketplace.reviews
      .filter((review) => review.shop_id === shopId)
      .map((review) => clone(review));
  }

  async listPayments(shopId: number): Promise<Payment[]> {
    return this.state.marketplace.payments
      .filter((payment) => payment.shop_id === shopId)
      .map((payment) => clone(payment));
  }

  async listTaxonomyNodes(): Promise<TaxonomyNode[]> {
    return this.state.marketplace.taxonomyNodes.map((node) => clone(node));
  }

  async snapshot(): Promise<StoredMarketplaceState> {
    return clone(this.state.marketplace);
  }

  private nextId(ids: number[]): number {
    return ids.reduce((max, value) => (value > max ? value : max), 0) + 1;
  }

  private hydrateShop(shop: StoredShop): Shop {
    const listings = this.state.marketplace.listings.filter((item) => item.shop_id === shop.shop_id);
    const reviews = this.state.marketplace.reviews.filter((item) => item.shop_id === shop.shop_id);
    const orders = this.state.marketplace.orders.filter((item) => item.shop_id === shop.shop_id && item.was_paid);

    return {
      ...clone(shop),
      listing_active_count: listings.filter(isMarketplaceActiveListing).length,
      total_sales_count: orders.reduce(
        (sum, order) => sum + order.line_items.reduce((lineSum, lineItem) => lineSum + lineItem.quantity, 0),
        0
      ),
      review_average: average(reviews.map((review) => review.rating)),
      review_count: reviews.length
    };
  }
}

export function createInMemoryMarketplaceRepository(seedState?: StoredMarketplaceState | StoredWorldState) {
  return new InMemoryMarketplaceRepository(seedState);
}
