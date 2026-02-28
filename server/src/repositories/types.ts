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
import type { SimulationState, StoredMarketplaceState, StoredWorldState } from "../simulation/state-types";

export type CreateListingData = Omit<Listing, "listing_id" | "created_at" | "updated_at" | "ranking_score">;

export type UpdateListingData = Partial<
  Omit<Listing, "listing_id" | "shop_id" | "shop_name" | "created_at" | "updated_at" | "inventory" | "ranking_score">
> & {
  inventory?: ListingInventory;
};

export type UpdateShopData = Partial<Pick<StoredShop, "title" | "announcement" | "sale_message">>;

export type MutationMetadata = {
  timestamp?: string;
};

export interface MarketplaceRepository {
  getMarketplaceState(): Promise<StoredMarketplaceState>;
  getSimulationState(): Promise<SimulationState>;
  setSimulationState(state: SimulationState): Promise<SimulationState>;
  setWorldState(state: StoredWorldState): Promise<StoredWorldState>;
  getShop(shopId: number): Promise<Shop | null>;
  listShops(): Promise<Shop[]>;
  updateShop(shopId: number, patch: UpdateShopData, metadata?: MutationMetadata): Promise<Shop | null>;
  getListing(listingId: number): Promise<Listing | null>;
  listShopListings(shopId: number): Promise<Listing[]>;
  listActiveListings(): Promise<Listing[]>;
  createListing(data: CreateListingData, metadata?: MutationMetadata): Promise<Listing>;
  updateListing(
    shopId: number,
    listingId: number,
    patch: UpdateListingData,
    metadata?: MutationMetadata
  ): Promise<Listing | null>;
  deleteListing(shopId: number, listingId: number): Promise<boolean>;
  replaceListingInventory(
    listingId: number,
    inventory: ListingInventory,
    metadata?: MutationMetadata
  ): Promise<ListingInventory | null>;
  listOrders(shopId: number): Promise<Order[]>;
  getOrder(shopId: number, receiptId: number): Promise<Order | null>;
  listReviews(shopId: number): Promise<Review[]>;
  listPayments(shopId: number): Promise<Payment[]>;
  listTaxonomyNodes(): Promise<TaxonomyNode[]>;
  snapshot?(): Promise<StoredMarketplaceState>;
}
