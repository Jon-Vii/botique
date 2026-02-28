import { and, desc, eq } from "drizzle-orm";

import { createDatabaseClient } from "../db/client";
import { bootstrapDatabase } from "../db/bootstrap";
import {
  listingsTable,
  ordersTable,
  paymentsTable,
  reviewsTable,
  shopsTable,
  simulationStateTable,
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
  MutationMetadata,
  UpdateListingData,
  UpdateShopData
} from "./types";
import { isMarketplaceActiveListing } from "../listing-availability";
import { createSimulationState } from "../simulation/state";
import type { SimulationState, StoredMarketplaceState, StoredWorldState } from "../simulation/state-types";

const SIMULATION_STATE_KEY = "default";

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

  async getMarketplaceState(): Promise<StoredMarketplaceState> {
    const [shopRows, listingRows, orderRows, reviewRows, paymentRows, taxonomyRows] = await Promise.all([
      this.db.select().from(shopsTable),
      this.db
        .select({
          listing: listingsTable,
          shopName: shopsTable.shopName
        })
        .from(listingsTable)
        .innerJoin(shopsTable, eq(listingsTable.shopId, shopsTable.shopId)),
      this.db.select().from(ordersTable),
      this.db.select().from(reviewsTable),
      this.db.select().from(paymentsTable),
      this.db.select().from(taxonomyNodesTable)
    ]);

    return {
      shops: shopRows.map((row) => this.mapStoredShop(row)),
      listings: listingRows.map((row) => this.mapListing(row.listing, row.shopName)),
      orders: orderRows.map((row) => this.mapOrder(row)),
      reviews: reviewRows.map((row) => this.mapReview(row)),
      payments: paymentRows.map((row) => this.mapPayment(row)),
      taxonomyNodes: taxonomyRows.map((row) => ({
        taxonomy_id: row.taxonomyId,
        parent_taxonomy_id: row.parentTaxonomyId,
        name: row.name,
        full_path: row.fullPath,
        level: row.level
      }))
    };
  }

  async getSimulationState(): Promise<SimulationState> {
    const rows = await this.db
      .select()
      .from(simulationStateTable)
      .where(eq(simulationStateTable.stateKey, SIMULATION_STATE_KEY))
      .limit(1);

    if (rows.length > 0) {
      return this.mapSimulationState(rows[0]);
    }

    const marketplaceState = await this.getMarketplaceState();
    return this.setSimulationState(createSimulationState(marketplaceState));
  }

  async setSimulationState(state: SimulationState): Promise<SimulationState> {
    const rows = await this.db
      .insert(simulationStateTable)
      .values({
        stateKey: SIMULATION_STATE_KEY,
        currentDay: state.current_day.day,
        currentDayDate: new Date(state.current_day.date),
        advancedAt: state.current_day.advanced_at ? new Date(state.current_day.advanced_at) : null,
        marketSnapshot: state.market_snapshot,
        trendState: state.trend_state,
        pendingEvents: state.pending_events,
        lastDayResolution: state.last_day_resolution,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: simulationStateTable.stateKey,
        set: {
          currentDay: state.current_day.day,
          currentDayDate: new Date(state.current_day.date),
          advancedAt: state.current_day.advanced_at ? new Date(state.current_day.advanced_at) : null,
          marketSnapshot: state.market_snapshot,
          trendState: state.trend_state,
          pendingEvents: state.pending_events,
          lastDayResolution: state.last_day_resolution,
          updatedAt: new Date()
        }
      })
      .returning();

    return this.mapSimulationState(rows[0]);
  }

  async setWorldState(state: StoredWorldState): Promise<StoredWorldState> {
    const sql = await this.dbClient.client.reserve();

    try {
      await sql`begin`;

      await sql`delete from payments`;
      await sql`delete from reviews`;
      await sql`delete from orders`;
      await sql`delete from listings`;
      await sql`delete from shops`;
      await sql`delete from taxonomy_nodes`;

      for (const taxonomyNode of state.marketplace.taxonomyNodes) {
        await sql`
          insert into taxonomy_nodes (taxonomy_id, parent_taxonomy_id, name, full_path, level)
          values (
            ${taxonomyNode.taxonomy_id},
            ${taxonomyNode.parent_taxonomy_id},
            ${taxonomyNode.name},
            ${taxonomyNode.full_path},
            ${taxonomyNode.level}
          )
        `;
      }

      for (const shop of state.marketplace.shops) {
        await sql`
          insert into shops (
            shop_id,
            shop_name,
            title,
            announcement,
            sale_message,
            currency_code,
            digital_product_policy,
            created_at,
            updated_at
          )
          values (
            ${shop.shop_id},
            ${shop.shop_name},
            ${shop.title},
            ${shop.announcement},
            ${shop.sale_message},
            ${shop.currency_code},
            ${shop.digital_product_policy},
            ${shop.created_at},
            ${shop.updated_at}
          )
        `;
      }

      for (const listing of state.marketplace.listings) {
        await sql`
          insert into listings (
            listing_id,
            shop_id,
            title,
            description,
            state,
            type,
            quantity,
            price,
            currency_code,
            who_made,
            when_made,
            taxonomy_id,
            tags,
            materials,
            image_ids,
            views,
            favorites,
            url,
            inventory,
            created_at,
            updated_at
          )
          values (
            ${listing.listing_id},
            ${listing.shop_id},
            ${listing.title},
            ${listing.description},
            ${listing.state},
            ${listing.type},
            ${listing.quantity},
            ${listing.price},
            ${listing.currency_code},
            ${listing.who_made},
            ${listing.when_made},
            ${listing.taxonomy_id},
            ${JSON.stringify(listing.tags)}::jsonb,
            ${JSON.stringify(listing.materials)}::jsonb,
            ${JSON.stringify(listing.image_ids)}::jsonb,
            ${listing.views},
            ${listing.favorites},
            ${listing.url},
            ${JSON.stringify(listing.inventory)}::jsonb,
            ${listing.created_at},
            ${listing.updated_at}
          )
        `;
      }

      for (const order of state.marketplace.orders) {
        await sql`
          insert into orders (
            receipt_id,
            shop_id,
            buyer_name,
            status,
            was_paid,
            was_shipped,
            was_delivered,
            total_price,
            currency_code,
            line_items,
            created_at,
            updated_at
          )
          values (
            ${order.receipt_id},
            ${order.shop_id},
            ${order.buyer_name},
            ${order.status},
            ${order.was_paid ? 1 : 0},
            ${order.was_shipped ? 1 : 0},
            ${order.was_delivered ? 1 : 0},
            ${order.total_price},
            ${order.currency_code},
            ${JSON.stringify(order.line_items)}::jsonb,
            ${order.created_at},
            ${order.updated_at}
          )
        `;
      }

      for (const review of state.marketplace.reviews) {
        await sql`
          insert into reviews (
            review_id,
            shop_id,
            listing_id,
            rating,
            review,
            buyer_name,
            created_at
          )
          values (
            ${review.review_id},
            ${review.shop_id},
            ${review.listing_id},
            ${review.rating},
            ${review.review},
            ${review.buyer_name},
            ${review.created_at}
          )
        `;
      }

      for (const payment of state.marketplace.payments) {
        await sql`
          insert into payments (
            payment_id,
            shop_id,
            receipt_id,
            amount,
            currency_code,
            status,
            posted_at
          )
          values (
            ${payment.payment_id},
            ${payment.shop_id},
            ${payment.receipt_id},
            ${payment.amount},
            ${payment.currency_code},
            ${payment.status},
            ${payment.posted_at}
          )
        `;
      }

      await sql`
        insert into simulation_state (
          state_key,
          current_day,
          current_day_date,
          advanced_at,
          market_snapshot,
          trend_state,
          pending_events,
          last_day_resolution,
          updated_at
        )
        values (
          ${SIMULATION_STATE_KEY},
          ${state.simulation.current_day.day},
          ${state.simulation.current_day.date},
          ${state.simulation.current_day.advanced_at},
          ${JSON.stringify(state.simulation.market_snapshot)}::jsonb,
          ${JSON.stringify(state.simulation.trend_state)}::jsonb,
          ${JSON.stringify(state.simulation.pending_events)}::jsonb,
          ${state.simulation.last_day_resolution
            ? JSON.stringify(state.simulation.last_day_resolution)
            : null}::jsonb,
          ${new Date().toISOString()}
        )
        on conflict (state_key) do update
        set
          current_day = excluded.current_day,
          current_day_date = excluded.current_day_date,
          advanced_at = excluded.advanced_at,
          market_snapshot = excluded.market_snapshot,
          trend_state = excluded.trend_state,
          pending_events = excluded.pending_events,
          last_day_resolution = excluded.last_day_resolution,
          updated_at = excluded.updated_at
      `;

      await sql`commit`;
      return state;
    } catch (error) {
      await sql`rollback`;
      throw error;
    } finally {
      sql.release();
    }
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

  async updateShop(shopId: number, patch: UpdateShopData, metadata?: MutationMetadata): Promise<Shop | null> {
    const rows = await this.db
      .update(shopsTable)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.announcement !== undefined ? { announcement: patch.announcement } : {}),
        ...(patch.sale_message !== undefined ? { saleMessage: patch.sale_message } : {}),
        updatedAt: this.resolveTimestamp(metadata)
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

    return rows
      .map((row) => this.mapListing(row.listing, row.shopName))
      .filter(isMarketplaceActiveListing);
  }

  async createListing(data: CreateListingData, metadata?: MutationMetadata): Promise<Listing> {
    const timestamp = this.resolveTimestamp(metadata);
    const sql = await this.dbClient.client.reserve();

    let listingId: number | null = null;
    try {
      await sql`begin`;
      await sql`lock table listings in exclusive mode`;
      const result = (await sql`
        select coalesce(max(listing_id), 0) + 1 as next_id from listings
      `) as Array<{ next_id: number | string }>;
      listingId = Number(result[0]?.next_id ?? 1);

      await sql`
        insert into listings (
          listing_id,
          shop_id,
          title,
          description,
          state,
          type,
          quantity,
          price,
          currency_code,
          who_made,
          when_made,
          taxonomy_id,
          tags,
          materials,
          image_ids,
          views,
          favorites,
          url,
          inventory,
          created_at,
          updated_at
        )
        values (
          ${listingId},
          ${data.shop_id},
          ${data.title},
          ${data.description},
          ${data.state},
          ${data.type},
          ${data.quantity},
          ${data.price},
          ${data.currency_code},
          ${data.who_made},
          ${data.when_made},
          ${data.taxonomy_id},
          ${JSON.stringify(data.tags)}::jsonb,
          ${JSON.stringify(data.materials)}::jsonb,
          ${JSON.stringify(data.image_ids)}::jsonb,
          ${data.views},
          ${data.favorites},
          ${data.url},
          ${JSON.stringify(data.inventory)}::jsonb,
          ${timestamp},
          ${timestamp}
        )
      `;
      await sql`commit`;
    } catch (error) {
      await sql`rollback`;
      throw error;
    } finally {
      sql.release();
    }

    const listing = await this.getListing(listingId ?? 0);
    if (!listing) {
      throw new Error(`Listing ${listingId} was not found after insert.`);
    }

    return listing;
  }

  async updateListing(
    shopId: number,
    listingId: number,
    patch: UpdateListingData,
    metadata?: MutationMetadata
  ): Promise<Listing | null> {
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
        updatedAt: this.resolveTimestamp(metadata)
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

  async replaceListingInventory(
    listingId: number,
    inventory: ListingInventory,
    metadata?: MutationMetadata
  ): Promise<ListingInventory | null> {
    const quantity = inventory.products.reduce(
      (sum, product) => sum + product.offerings.reduce((offeringSum, offering) => offeringSum + offering.quantity, 0),
      0
    );
    const price = inventory.products[0]?.offerings[0]?.price;

    const rows = await this.db
      .update(listingsTable)
      .set({
        inventory,
        quantity,
        ...(price !== undefined ? { price: price.toFixed(2) } : {}),
        updatedAt: this.resolveTimestamp(metadata)
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

  async snapshot(): Promise<StoredMarketplaceState> {
    return this.getMarketplaceState();
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
      listing_active_count: listings.filter(isMarketplaceActiveListing).length,
      total_sales_count: orders.filter((order) => order.was_paid).reduce(
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

  private mapSimulationState(row: typeof simulationStateTable.$inferSelect): SimulationState {
    return {
      current_day: {
        day: row.currentDay,
        date: toIsoString(row.currentDayDate),
        advanced_at: row.advancedAt ? toIsoString(row.advancedAt) : null
      },
      market_snapshot: row.marketSnapshot,
      trend_state: row.trendState,
      pending_events: row.pendingEvents ?? [],
      last_day_resolution: row.lastDayResolution ?? null
    };
  }

  private resolveTimestamp(metadata?: MutationMetadata): Date {
    return metadata?.timestamp ? new Date(metadata.timestamp) : new Date();
  }
}
