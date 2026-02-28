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

export type StoredMarketplaceState = {
  shops: StoredShop[];
  listings: Listing[];
  orders: Order[];
  reviews: Review[];
  payments: Payment[];
  taxonomyNodes: TaxonomyNode[];
};

export type CreateListingData = Omit<Listing, "listing_id" | "created_at" | "updated_at" | "ranking_score">;

export type UpdateListingData = Partial<
  Omit<Listing, "listing_id" | "shop_id" | "shop_name" | "created_at" | "updated_at" | "inventory" | "ranking_score">
> & {
  inventory?: ListingInventory;
};

export type UpdateShopData = Partial<Pick<StoredShop, "title" | "announcement" | "sale_message">>;

export interface MarketplaceRepository {
  getShop(shopId: number): Promise<Shop | null>;
  listShops(): Promise<Shop[]>;
  updateShop(shopId: number, patch: UpdateShopData): Promise<Shop | null>;
  getListing(listingId: number): Promise<Listing | null>;
  listShopListings(shopId: number): Promise<Listing[]>;
  listActiveListings(): Promise<Listing[]>;
  createListing(data: CreateListingData): Promise<Listing>;
  updateListing(shopId: number, listingId: number, patch: UpdateListingData): Promise<Listing | null>;
  deleteListing(shopId: number, listingId: number): Promise<boolean>;
  replaceListingInventory(listingId: number, inventory: ListingInventory): Promise<ListingInventory | null>;
  listOrders(shopId: number): Promise<Order[]>;
  getOrder(shopId: number, receiptId: number): Promise<Order | null>;
  listReviews(shopId: number): Promise<Review[]>;
  listPayments(shopId: number): Promise<Payment[]>;
  listTaxonomyNodes(): Promise<TaxonomyNode[]>;
  snapshot?(): Promise<StoredMarketplaceState>;
}
