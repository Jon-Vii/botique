import { BadRequestError, NotFoundError } from "../errors";
import type {
  Listing,
  ListingInventory,
  OperationStatus,
  Order,
  Payment,
  Review,
  Shop,
  TaxonomyNode
} from "../schemas/domain";
import type {
  CreateDraftListingBody,
  GetOrdersQuery,
  GetReviewsQuery,
  GetShopListingsQuery,
  InventoryBody,
  SearchMarketplaceQuery,
  UpdateListingBody,
  UpdateShopBody
} from "../schemas/requests";
import type { MarketplaceRepository } from "../repositories/types";
import type { SimulationModule } from "../simulation/world-simulation";
import { computeKeywordRelevance, scoreMarketplaceListing } from "../simulation/ranking";

type PaginatedResults<T> = {
  count: number;
  limit: number;
  offset: number;
  results: T[];
};

function paginate<T>(items: T[], limit: number, offset: number): PaginatedResults<T> {
  return {
    count: items.length,
    limit,
    offset,
    results: items.slice(offset, offset + limit)
  };
}

function parseTime(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function compareListings(
  left: Listing,
  right: Listing,
  sortOn: "score" | "created" | "updated" | "price" | "title",
  sortOrder: "asc" | "desc"
) {
  const direction = sortOrder === "asc" ? 1 : -1;
  const leftValue =
    sortOn === "created"
      ? Date.parse(left.created_at)
      : sortOn === "updated"
        ? Date.parse(left.updated_at)
      : sortOn === "price"
        ? left.price
        : sortOn === "title"
          ? left.title.toLowerCase()
          : left.ranking_score ?? 0;
  const rightValue =
    sortOn === "created"
      ? Date.parse(right.created_at)
      : sortOn === "updated"
        ? Date.parse(right.updated_at)
      : sortOn === "price"
        ? right.price
        : sortOn === "title"
          ? right.title.toLowerCase()
          : right.ranking_score ?? 0;

  if (leftValue < rightValue) {
    return -1 * direction;
  }
  if (leftValue > rightValue) {
    return 1 * direction;
  }
  return 0;
}

function compareOrders(
  left: Order,
  right: Order,
  sortOn: "created" | "updated" | "total_price",
  sortOrder: "asc" | "desc"
) {
  const direction = sortOrder === "asc" ? 1 : -1;
  const leftValue =
    sortOn === "updated"
      ? Date.parse(left.updated_at)
      : sortOn === "total_price"
        ? left.total_price
        : Date.parse(left.created_at);
  const rightValue =
    sortOn === "updated"
      ? Date.parse(right.updated_at)
      : sortOn === "total_price"
        ? right.total_price
        : Date.parse(right.created_at);

  if (leftValue < rightValue) {
    return -1 * direction;
  }
  if (leftValue > rightValue) {
    return 1 * direction;
  }
  return 0;
}

function compareSimpleDateDesc<T extends { created_at?: string; posted_at?: string }>(left: T, right: T) {
  const leftTime = Date.parse(left.created_at ?? left.posted_at ?? "");
  const rightTime = Date.parse(right.created_at ?? right.posted_at ?? "");
  return rightTime - leftTime;
}

export class MarketplaceService {
  constructor(
    private readonly repository: MarketplaceRepository,
    private readonly simulation: SimulationModule
  ) {}

  async createDraftListing(shopId: number, input: CreateDraftListingBody): Promise<Listing> {
    const mutation = await this.mutationMetadata();
    const shop = await this.repository.getShop(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop ${shopId} not found.`);
    }

    const listing = await this.repository.createListing({
      shop_id: shopId,
      shop_name: shop.shop_name,
      title: input.title,
      description: input.description,
      state: input.state ?? "draft",
      type: input.type ?? "download",
      quantity: input.quantity,
      price: input.price,
      currency_code: shop.currency_code,
      who_made: input.who_made,
      when_made: input.when_made,
      taxonomy_id: input.taxonomy_id,
      tags: input.tags ?? [],
      materials: input.materials ?? [],
      image_ids: input.image_ids ?? [],
      views: 0,
      favorites: 0,
      url: input.url ?? `https://botique.local/shops/${shop.shop_name}/listings/pending`,
      inventory: {
        listing_id: 0,
        products: [
          {
            sku: `${shop.shop_name.toUpperCase()}-${input.taxonomy_id}-001`,
            property_values: [],
            offerings: [
              {
                offering_id: 0,
                price: input.price,
                quantity: input.quantity,
                is_enabled: true
              }
            ]
          }
        ],
        price_on_property: [],
        quantity_on_property: [],
        sku_on_property: []
      }
    }, mutation);

    const inventory: ListingInventory = {
      ...listing.inventory,
      listing_id: listing.listing_id,
      products: listing.inventory.products.map((product, index) => ({
        ...product,
        offerings: product.offerings.map((offering, offeringIndex) => ({
          ...offering,
          offering_id:
            offering.offering_id > 0 ? offering.offering_id : listing.listing_id * 10 + index + offeringIndex
        }))
      }))
    };

    const updatedListing = await this.repository.updateListing(shopId, listing.listing_id, {
      inventory,
      url: input.url ?? `https://botique.local/shops/${shop.shop_name}/listings/${listing.listing_id}`
    }, mutation);

    if (!updatedListing) {
      throw new NotFoundError(`Listing ${listing.listing_id} not found after creation.`);
    }

    return updatedListing;
  }

  async updateListing(shopId: number, listingId: number, patch: UpdateListingBody): Promise<Listing> {
    await this.assertShopExists(shopId);
    const listing = await this.repository.updateListing(
      shopId,
      listingId,
      patch,
      await this.mutationMetadata()
    );
    if (!listing) {
      throw new NotFoundError(`Listing ${listingId} not found in shop ${shopId}.`);
    }
    return listing;
  }

  async deleteListing(shopId: number, listingId: number): Promise<OperationStatus> {
    await this.assertShopExists(shopId);
    const deleted = await this.repository.deleteListing(shopId, listingId);
    if (!deleted) {
      throw new NotFoundError(`Listing ${listingId} not found in shop ${shopId}.`);
    }
    return { ok: true, deleted, listing_id: listingId };
  }

  async getListing(listingId: number): Promise<Listing> {
    const listing = await this.repository.getListing(listingId);
    if (!listing) {
      throw new NotFoundError(`Listing ${listingId} not found.`);
    }
    return listing;
  }

  async getShopListings(shopId: number, query: GetShopListingsQuery): Promise<PaginatedResults<Listing>> {
    await this.assertShopExists(shopId);
    const sortOn = query.sort_on ?? "created";
    const sortOrder = query.sort_order ?? "desc";

    const listings = (await this.repository.listShopListings(shopId))
      .filter((listing) => (query.state ? listing.state === query.state : true))
      .sort((left, right) => compareListings(left, right, sortOn, sortOrder));

    return paginate(listings, query.limit, query.offset);
  }

  async searchMarketplace(query: SearchMarketplaceQuery): Promise<PaginatedResults<Listing>> {
    const shops = new Map((await this.repository.listShops()).map((shop) => [shop.shop_id, shop]));
    const keywords = tokenize(query.keywords ?? "");
    const requestedCategory = query.category?.toLowerCase();
    const searchContext = await this.simulation.getSearchContext();

    const activeListings = await this.repository.listActiveListings();
    const newestListingTimestamp = activeListings.reduce((max, listing) => {
      const createdAt = Date.parse(listing.created_at);
      return createdAt > max ? createdAt : max;
    }, 0);

    const scoredListings: Listing[] = [];
    for (const listing of activeListings) {
      if (query.taxonomy_id && listing.taxonomy_id !== query.taxonomy_id) {
        continue;
      }
      if (query.min_price !== undefined && listing.price < query.min_price) {
        continue;
      }
      if (query.max_price !== undefined && listing.price > query.max_price) {
        continue;
      }
      if (requestedCategory) {
        const haystack = [listing.title, listing.description, ...listing.tags].join(" ").toLowerCase();
        if (!haystack.includes(requestedCategory)) {
          continue;
        }
      }

      const terms = computeKeywordRelevance(listing, keywords);

      if (keywords.length > 0 && terms === 0) {
        continue;
      }

      const shop = shops.get(listing.shop_id);
      scoredListings.push({
        ...listing,
        ranking_score: scoreMarketplaceListing({
          listing,
          keywords,
          shopReviewAverage: shop?.review_average ?? 0,
          newestListingTimestamp,
          searchContext
        })
      });
    }

    const listings = scoredListings.sort((left, right) =>
      compareListings(left, right, query.sort_on ?? "score", query.sort_order ?? "desc")
    );

    return paginate(listings, query.limit, query.offset);
  }

  async getListingInventory(listingId: number): Promise<ListingInventory> {
    const listing = await this.getListing(listingId);
    return listing.inventory;
  }

  async updateListingInventory(listingId: number, body: InventoryBody): Promise<ListingInventory> {
    const listing = await this.getListing(listingId);
    const inventory: ListingInventory = {
      listing_id: listingId,
      products: body.products.map((product, productIndex) => ({
        sku: product.sku,
        property_values: product.property_values.map((propertyValue) => ({
          property_id: propertyValue.property_id,
          value: propertyValue.value
        })),
        offerings: product.offerings.map((offering, offeringIndex) => ({
          offering_id:
            offering.offering_id ??
            listingId * 100 + productIndex * 10 + offeringIndex,
          price: offering.price,
          quantity: offering.quantity,
          is_enabled: offering.is_enabled
        }))
      })),
      price_on_property: body.price_on_property,
      quantity_on_property: body.quantity_on_property,
      sku_on_property: body.sku_on_property
    };

    const updated = await this.repository.replaceListingInventory(
      listingId,
      inventory,
      await this.mutationMetadata()
    );
    if (!updated) {
      throw new NotFoundError(`Listing ${listingId} not found.`);
    }
    return updated;
  }

  async getShopInfo(shopId: number): Promise<Shop> {
    const shop = await this.repository.getShop(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop ${shopId} not found.`);
    }
    return shop;
  }

  async updateShop(shopId: number, patch: UpdateShopBody): Promise<Shop> {
    const shop = await this.repository.updateShop(shopId, patch, await this.mutationMetadata());
    if (!shop) {
      throw new NotFoundError(`Shop ${shopId} not found.`);
    }
    return shop;
  }

  async getOrders(shopId: number, query: GetOrdersQuery): Promise<PaginatedResults<Order>> {
    await this.assertShopExists(shopId);
    const minCreated = parseTime(query.min_created);
    const maxCreated = parseTime(query.max_created);
    const minUpdated = parseTime(query.min_last_modified);
    const maxUpdated = parseTime(query.max_last_modified);
    if ((query.min_created !== undefined && minCreated === null) || (query.max_created !== undefined && maxCreated === null)) {
      throw new BadRequestError("min_created and max_created must be unix timestamps or ISO dates.");
    }
    if (
      (query.min_last_modified !== undefined && minUpdated === null) ||
      (query.max_last_modified !== undefined && maxUpdated === null)
    ) {
      throw new BadRequestError("min_last_modified and max_last_modified must be unix timestamps or ISO dates.");
    }

    const orders = (await this.repository.listOrders(shopId))
      .filter((order) => (query.was_paid !== undefined ? order.was_paid === query.was_paid : true))
      .filter((order) => (query.was_shipped !== undefined ? order.was_shipped === query.was_shipped : true))
      .filter((order) => (query.was_delivered !== undefined ? order.was_delivered === query.was_delivered : true))
      .filter((order) => (minCreated !== null ? Date.parse(order.created_at) >= minCreated : true))
      .filter((order) => (maxCreated !== null ? Date.parse(order.created_at) <= maxCreated : true))
      .filter((order) => (minUpdated !== null ? Date.parse(order.updated_at) >= minUpdated : true))
      .filter((order) => (maxUpdated !== null ? Date.parse(order.updated_at) <= maxUpdated : true))
      .sort((left, right) => compareOrders(left, right, query.sort_on ?? "created", query.sort_order ?? "desc"));

    return paginate(orders, query.limit, query.offset);
  }

  async getOrderDetails(shopId: number, receiptId: number): Promise<Order> {
    await this.assertShopExists(shopId);
    const order = await this.repository.getOrder(shopId, receiptId);
    if (!order) {
      throw new NotFoundError(`Receipt ${receiptId} not found in shop ${shopId}.`);
    }
    return order;
  }

  async getPayments(shopId: number): Promise<PaginatedResults<Payment>> {
    await this.assertShopExists(shopId);
    const payments = (await this.repository.listPayments(shopId))
      .filter((payment) => payment.status === "posted")
      .sort(compareSimpleDateDesc);
    return {
      count: payments.length,
      limit: payments.length,
      offset: 0,
      results: payments
    };
  }

  async getReviews(shopId: number, query: GetReviewsQuery): Promise<PaginatedResults<Review>> {
    await this.assertShopExists(shopId);
    const reviews = (await this.repository.listReviews(shopId))
      .filter((review) => (query.listing_id ? review.listing_id === query.listing_id : true))
      .sort(compareSimpleDateDesc);

    return paginate(reviews, query.limit, query.offset);
  }

  async getTaxonomyNodes(taxonomyId?: number): Promise<PaginatedResults<TaxonomyNode>> {
    const nodes = await this.repository.listTaxonomyNodes();
    const results = (taxonomyId === undefined ? nodes : this.collectTaxonomyBranch(nodes, taxonomyId)).sort(
      (left, right) => left.level - right.level || left.taxonomy_id - right.taxonomy_id
    );
    return {
      count: results.length,
      limit: results.length,
      offset: 0,
      results
    };
  }

  private collectTaxonomyBranch(nodes: TaxonomyNode[], taxonomyId: number): TaxonomyNode[] {
    const byParent = new Map<number | null, TaxonomyNode[]>();
    for (const node of nodes) {
      const key = node.parent_taxonomy_id;
      const existing = byParent.get(key) ?? [];
      existing.push(node);
      byParent.set(key, existing);
    }

    const root = nodes.find((node) => node.taxonomy_id === taxonomyId);
    if (!root) {
      throw new NotFoundError(`Taxonomy node ${taxonomyId} not found.`);
    }

    const results: TaxonomyNode[] = [];
    const stack: TaxonomyNode[] = [root];
    while (stack.length > 0) {
      const node = stack.shift()!;
      results.push(node);
      const children = byParent.get(node.taxonomy_id) ?? [];
      stack.push(...children);
    }

    return results.sort((left, right) => left.level - right.level || left.taxonomy_id - right.taxonomy_id);
  }

  private async assertShopExists(shopId: number) {
    const shop = await this.repository.getShop(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop ${shopId} not found.`);
    }
  }

  private async mutationMetadata(): Promise<{ timestamp: string }> {
    return {
      timestamp: (await this.simulation.getCurrentDay()).date
    };
  }
}
