import { and, desc, eq, sql } from "drizzle-orm";

import { createDatabaseClient } from "../db/client";
import { bootstrapDatabase } from "../db/bootstrap";
import {
  listingsTable,
  ordersTable,
  paymentsTable,
  reviewsTable,
  shopsTable,
  taxonomyNodesTable
} from "../db/schema";
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
  UpdateListingData,
  UpdateShopData
} from "./types";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function toBoolean(value: number): boolean {
  return value !== 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export class PostgresMarketplaceRepository implements MarketplaceRepository {
  private readonly dbClient;
  private readonly db;

  private constructor(private readonly connectionString: string) {
    this.dbClient = createDatabaseClient(connectionString);
    this.db = this.dbClient.db;
  }

  static async create(connectionString: string) {
    const repository = new PostgresMarketplaceRepository(connectionString);
    await repository.bootstrap();
    return repository;
  }

  async getShop(shopId: number): Promise<Shop | null> {
    const rows = await this.db
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.shopId, shopId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.hydrateShop(this.mapStoredShop(rows[0]));
  }

  async listShops(): Promise<Shop[]> {
    const rows = await this.db.select().from(shopsTable);
    return Promise.all(rows.map((row) => this.hydrateShop(this.mapStoredShop(row))));
  }

  async updateShop(shopId: number, patch: UpdateShopData): Promise<Shop | null> {
    const rows = await this.db
      .update(shopsTable)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.announcement !== undefined ? { announcement: patch.announcement } : {}),
        ...(patch.sale_message !== undefined ? { saleMessage: patch.sale_message } : {}),
        updatedAt: new Date()
      })
      .where(eq(shopsTable.shopId, shopId))
      .returning();

    if (rows.length === 0) {
      return null;
    }

    return this.hydrateShop(this.mapStoredShop(rows[0]));
  }

  async getListing(listingId: number): Promise<Listing | null> {
    const rows = await this.db
      .select({
        listing: listingsTable,
        shopName: shopsTable.shopName
      })
      .from(listingsTable)
      .innerJoin(shopsTable, eq(listingsTable.shopId, shopsTable.shopId))
      .where(eq(listingsTable.listingId, listingId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapListing(rows[0].listing, rows[0].shopName);
  }

  async listShopListings(shopId: number): Promise<Listing[]> {
    const rows = await this.db
      .select({
        listing: listingsTable,
        shopName: shopsTable.shopName
      })
      .from(listingsTable)
      .innerJoin(shopsTable, eq(listingsTable.shopId, shopsTable.shopId))
      .where(eq(listingsTable.shopId, shopId))
      .orderBy(desc(listingsTable.createdAt));

    return rows.map((row) => this.mapListing(row.listing, row.shopName));
  }

  async listActiveListings(): Promise<Listing[]> {
    const rows = await this.db
      .select({
        listing: listingsTable,
        shopName: shopsTable.shopName
      })
      .from(listingsTable)
      .innerJoin(shopsTable, eq(listingsTable.shopId, shopsTable.shopId))
      .where(eq(listingsTable.state, "active"));

    return rows.map((row) => this.mapListing(row.listing, row.shopName));
  }

  async createListing(data: CreateListingData): Promise<Listing> {
    const listingId = await this.nextId("listings", "listing_id");
    const timestamp = new Date();

    const rows = await this.db
      .insert(listingsTable)
      .values({
        listingId,
        shopId: data.shop_id,
        title: data.title,
        description: data.description,
        state: data.state,
        type: data.type,
        quantity: data.quantity,
        price: data.price.toFixed(2),
        currencyCode: data.currency_code,
        whoMade: data.who_made,
        whenMade: data.when_made,
        taxonomyId: data.taxonomy_id,
        tags: data.tags,
        materials: data.materials,
        imageIds: data.image_ids,
        views: data.views,
        favorites: data.favorites,
        url: data.url,
        inventory: data.inventory,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .returning();

    return this.mapListing(rows[0], data.shop_name);
  }

  async updateListing(shopId: number, listingId: number, patch: UpdateListingData): Promise<Listing | null> {
    const rows = await this.db
      .update(listingsTable)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.state !== undefined ? { state: patch.state } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
        ...(patch.price !== undefined ? { price: patch.price.toFixed(2) } : {}),
        ...(patch.currency_code !== undefined ? { currencyCode: patch.currency_code } : {}),
        ...(patch.who_made !== undefined ? { whoMade: patch.who_made } : {}),
        ...(patch.when_made !== undefined ? { whenMade: patch.when_made } : {}),
        ...(patch.taxonomy_id !== undefined ? { taxonomyId: patch.taxonomy_id } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.materials !== undefined ? { materials: patch.materials } : {}),
        ...(patch.image_ids !== undefined ? { imageIds: patch.image_ids } : {}),
        ...(patch.url !== undefined ? { url: patch.url } : {}),
        ...(patch.inventory !== undefined ? { inventory: patch.inventory } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(listingsTable.shopId, shopId), eq(listingsTable.listingId, listingId)))
      .returning();

    if (rows.length === 0) {
      return null;
    }

    const shop = await this.getShop(shopId);
    return this.mapListing(rows[0], shop?.shop_name ?? "unknown-shop");
  }

  async deleteListing(shopId: number, listingId: number): Promise<boolean> {
    const rows = await this.db
      .delete(listingsTable)
      .where(and(eq(listingsTable.shopId, shopId), eq(listingsTable.listingId, listingId)))
      .returning({ listingId: listingsTable.listingId });

    return rows.length > 0;
  }

  async replaceListingInventory(listingId: number, inventory: ListingInventory): Promise<ListingInventory | null> {
    const quantity = inventory.products.reduce(
      (sum, product) => sum + product.offerings.reduce((offeringSum, offering) => offeringSum + offering.quantity, 0),
      0
    );
    const price = inventory.products[0]?.offerings[0]?.price;

    const rows = await this.db
      .update(listingsTable)
      .set({
        inventory,
        ...(quantity > 0 ? { quantity } : {}),
        ...(price !== undefined ? { price: price.toFixed(2) } : {}),
        updatedAt: new Date()
      })
      .where(eq(listingsTable.listingId, listingId))
      .returning({ inventory: listingsTable.inventory });

    return rows[0]?.inventory ?? null;
  }

  async listOrders(shopId: number): Promise<Order[]> {
    const rows = await this.db.select().from(ordersTable).where(eq(ordersTable.shopId, shopId));
    return rows.map((row) => this.mapOrder(row));
  }

  async getOrder(shopId: number, receiptId: number): Promise<Order | null> {
    const rows = await this.db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.shopId, shopId), eq(ordersTable.receiptId, receiptId)))
      .limit(1);

    return rows[0] ? this.mapOrder(rows[0]) : null;
  }

  async listReviews(shopId: number): Promise<Review[]> {
    const rows = await this.db.select().from(reviewsTable).where(eq(reviewsTable.shopId, shopId));
    return rows.map((row) => this.mapReview(row));
  }

  async listPayments(shopId: number): Promise<Payment[]> {
    const rows = await this.db.select().from(paymentsTable).where(eq(paymentsTable.shopId, shopId));
    return rows.map((row) => this.mapPayment(row));
  }

  async listTaxonomyNodes(): Promise<TaxonomyNode[]> {
    const rows = await this.db.select().from(taxonomyNodesTable);
    return rows.map((row) => ({
      taxonomy_id: row.taxonomyId,
      parent_taxonomy_id: row.parentTaxonomyId,
      name: row.name,
      full_path: row.fullPath,
      level: row.level
    }));
  }

  private async bootstrap() {
    await bootstrapDatabase(this.dbClient);
  }

  private async hydrateShop(shop: StoredShop): Promise<Shop> {
    const [listings, orders, reviews] = await Promise.all([
      this.listShopListings(shop.shop_id),
      this.listOrders(shop.shop_id),
      this.listReviews(shop.shop_id)
    ]);

    return {
      ...shop,
      listing_active_count: listings.filter((listing) => listing.state === "active").length,
      total_sales_count: orders.reduce(
        (sum, order) => sum + order.line_items.reduce((lineSum, lineItem) => lineSum + lineItem.quantity, 0),
        0
      ),
      review_average: average(reviews.map((review) => review.rating)),
      review_count: reviews.length
    };
  }

  private mapStoredShop(row: typeof shopsTable.$inferSelect): StoredShop {
    return {
      shop_id: row.shopId,
      shop_name: row.shopName,
      title: row.title,
      announcement: row.announcement,
      sale_message: row.saleMessage,
      currency_code: row.currencyCode,
      digital_product_policy: row.digitalProductPolicy,
      created_at: toIsoString(row.createdAt),
      updated_at: toIsoString(row.updatedAt)
    };
  }

  private mapListing(row: typeof listingsTable.$inferSelect, shopName: string): Listing {
    return {
      listing_id: row.listingId,
      shop_id: row.shopId,
      shop_name: shopName,
      title: row.title,
      description: row.description,
      state: row.state as Listing["state"],
      type: row.type,
      quantity: row.quantity,
      price: toNumber(row.price),
      currency_code: row.currencyCode,
      who_made: row.whoMade,
      when_made: row.whenMade,
      taxonomy_id: row.taxonomyId,
      tags: row.tags,
      materials: row.materials,
      image_ids: row.imageIds,
      views: row.views,
      favorites: row.favorites,
      url: row.url,
      created_at: toIsoString(row.createdAt),
      updated_at: toIsoString(row.updatedAt),
      inventory: row.inventory
    };
  }

  private mapOrder(row: typeof ordersTable.$inferSelect): Order {
    return {
      receipt_id: row.receiptId,
      shop_id: row.shopId,
      buyer_name: row.buyerName,
      status: row.status as Order["status"],
      was_paid: toBoolean(row.wasPaid),
      was_shipped: toBoolean(row.wasShipped),
      was_delivered: toBoolean(row.wasDelivered),
      total_price: toNumber(row.totalPrice),
      currency_code: row.currencyCode,
      line_items: row.lineItems,
      created_at: toIsoString(row.createdAt),
      updated_at: toIsoString(row.updatedAt)
    };
  }

  private mapReview(row: typeof reviewsTable.$inferSelect): Review {
    return {
      review_id: row.reviewId,
      shop_id: row.shopId,
      listing_id: row.listingId,
      rating: row.rating,
      review: row.review,
      buyer_name: row.buyerName,
      created_at: toIsoString(row.createdAt)
    };
  }

  private mapPayment(row: typeof paymentsTable.$inferSelect): Payment {
    return {
      payment_id: row.paymentId,
      shop_id: row.shopId,
      receipt_id: row.receiptId,
      amount: toNumber(row.amount),
      currency_code: row.currencyCode,
      status: row.status as Payment["status"],
      posted_at: toIsoString(row.postedAt)
    };
  }

  private async nextId(tableName: string, columnName: string): Promise<number> {
    const result = await this.db.execute<{ next_id: string }>(
      sql.raw(`select coalesce(max(${columnName}), 0) + 1 as next_id from ${tableName}`)
    );

    return Number(result[0]?.next_id ?? 1);
  }
}
