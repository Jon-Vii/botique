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
import { recalculateShopBacklog, syncListingInventoryState } from "../simulation/production";
import { createSimulationState, normalizeWorldState } from "../simulation/state";
import { normalizeSimulationScenario, type SimulationScenario } from "../simulation/scenario-types";
import { buildScenarioWorldState } from "../simulation/scenarios";
import type { ResetWorldOptions } from "../simulation/world-simulation";
import type { SimulationState, StoredMarketplaceState, StoredWorldState } from "../simulation/state-types";
import { isMarketplaceActiveListing } from "../listing-availability";
import type {
  CreateListingData,
  MarketplaceRepository,
  MutationMetadata,
  UpdateListingData,
  UpdateShopData
} from "./types";

const SIMULATION_STATE_KEY = "default";

function toIsoString(value: Date | string | null): string {
  return value instanceof Date ? value.toISOString() : new Date(value ?? 0).toISOString();
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

  async replaceWorldState(state: StoredWorldState): Promise<StoredWorldState> {
    const normalized = normalizeWorldState(state);
    const sql = await this.dbClient.client.reserve();

    try {
      await sql`begin`;
      await sql`delete from simulation_state where state_key = ${SIMULATION_STATE_KEY}`;
      await sql`delete from payments`;
      await sql`delete from reviews`;
      await sql`delete from orders`;
      await sql`delete from listings`;
      await sql`delete from shops`;
      await sql`delete from taxonomy_nodes`;

      for (const taxonomyNode of normalized.marketplace.taxonomyNodes) {
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

      for (const shop of normalized.marketplace.shops) {
        await sql`
          insert into shops (
            shop_id,
            shop_name,
            title,
            announcement,
            sale_message,
            currency_code,
            digital_product_policy,
            production_capacity_per_day,
            backlog_units,
            material_costs_paid_total,
            seed_capital,
            production_queue,
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
            ${shop.production_capacity_per_day},
            ${shop.backlog_units},
            ${shop.material_costs_paid_total},
            ${shop.seed_capital},
            ${JSON.stringify(shop.production_queue)}::jsonb,
            ${shop.created_at},
            ${shop.updated_at}
          )
        `;
      }

      for (const listing of normalized.marketplace.listings) {
        await sql`
          insert into listings (
            listing_id,
            shop_id,
            title,
            description,
            state,
            type,
            quantity,
            fulfillment_mode,
            quantity_on_hand,
            backlog_units,
            price,
            currency_code,
            who_made,
            when_made,
            taxonomy_id,
            tags,
            materials,
            material_cost_per_unit,
            capacity_units_per_item,
            lead_time_days,
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
            ${listing.fulfillment_mode},
            ${listing.quantity_on_hand},
            ${listing.backlog_units},
            ${listing.price},
            ${listing.currency_code},
            ${listing.who_made},
            ${listing.when_made},
            ${listing.taxonomy_id},
            ${JSON.stringify(listing.tags)}::jsonb,
            ${JSON.stringify(listing.materials)}::jsonb,
            ${listing.material_cost_per_unit},
            ${listing.capacity_units_per_item},
            ${listing.lead_time_days},
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

      for (const order of normalized.marketplace.orders) {
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

      for (const review of normalized.marketplace.reviews) {
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

      for (const payment of normalized.marketplace.payments) {
        await sql`
          insert into payments (
            payment_id,
            shop_id,
            receipt_id,
            amount,
            currency_code,
            status,
            available_at,
            posted_at
          )
          values (
            ${payment.payment_id},
            ${payment.shop_id},
            ${payment.receipt_id},
            ${payment.amount},
            ${payment.currency_code},
            ${payment.status},
            ${payment.available_at},
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
          scenario,
          market_snapshot,
          trend_state,
          pending_reviews,
          last_resolution,
          updated_at
        )
        values (
          ${SIMULATION_STATE_KEY},
          ${normalized.simulation.current_day.day},
          ${normalized.simulation.current_day.date},
          ${normalized.simulation.current_day.advanced_at},
          ${JSON.stringify(normalized.simulation.scenario)}::jsonb,
          ${JSON.stringify(normalized.simulation.market_snapshot)}::jsonb,
          ${JSON.stringify(normalized.simulation.trend_state)}::jsonb,
          ${JSON.stringify(normalized.simulation.pending_reviews)}::jsonb,
          ${JSON.stringify(normalized.simulation.last_resolution)}::jsonb,
          now()
        )
      `;

      await sql`commit`;
    } catch (error) {
      await sql`rollback`;
      throw error;
    } finally {
      sql.release();
    }

    return {
      marketplace: await this.getMarketplaceState(),
      simulation: await this.getSimulationState()
    };
  }

  async resetWorldState(options: ResetWorldOptions = {}): Promise<StoredWorldState> {
    return this.replaceWorldState(buildScenarioWorldState(options));
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
        scenario: state.scenario,
        marketSnapshot: state.market_snapshot,
        trendState: state.trend_state,
        pendingReviews: state.pending_reviews,
        lastResolution: state.last_resolution,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: simulationStateTable.stateKey,
        set: {
          currentDay: state.current_day.day,
          currentDayDate: new Date(state.current_day.date),
          advancedAt: state.current_day.advanced_at ? new Date(state.current_day.advanced_at) : null,
          scenario: state.scenario,
          marketSnapshot: state.market_snapshot,
          trendState: state.trend_state,
          pendingReviews: state.pending_reviews,
          lastResolution: state.last_resolution,
          updatedAt: new Date()
        }
      })
      .returning();

    return this.mapSimulationState(rows[0]);
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
          fulfillment_mode,
          quantity_on_hand,
          backlog_units,
          price,
          currency_code,
          who_made,
          when_made,
          taxonomy_id,
          tags,
          materials,
          material_cost_per_unit,
          capacity_units_per_item,
          lead_time_days,
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
          ${data.fulfillment_mode},
          ${data.quantity_on_hand},
          ${data.backlog_units},
          ${data.price},
          ${data.currency_code},
          ${data.who_made},
          ${data.when_made},
          ${data.taxonomy_id},
          ${JSON.stringify(data.tags)}::jsonb,
          ${JSON.stringify(data.materials)}::jsonb,
          ${data.material_cost_per_unit},
          ${data.capacity_units_per_item},
          ${data.lead_time_days},
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
        ...(patch.fulfillment_mode !== undefined ? { fulfillmentMode: patch.fulfillment_mode } : {}),
        ...(patch.quantity_on_hand !== undefined ? { quantityOnHand: patch.quantity_on_hand } : {}),
        ...(patch.backlog_units !== undefined ? { backlogUnits: patch.backlog_units } : {}),
        ...(patch.price !== undefined ? { price: patch.price.toFixed(2) } : {}),
        ...(patch.currency_code !== undefined ? { currencyCode: patch.currency_code } : {}),
        ...(patch.who_made !== undefined ? { whoMade: patch.who_made } : {}),
        ...(patch.when_made !== undefined ? { whenMade: patch.when_made } : {}),
        ...(patch.taxonomy_id !== undefined ? { taxonomyId: patch.taxonomy_id } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.materials !== undefined ? { materials: patch.materials } : {}),
        ...(patch.material_cost_per_unit !== undefined
          ? { materialCostPerUnit: patch.material_cost_per_unit.toFixed(2) }
          : {}),
        ...(patch.capacity_units_per_item !== undefined ? { capacityUnitsPerItem: patch.capacity_units_per_item } : {}),
        ...(patch.lead_time_days !== undefined ? { leadTimeDays: patch.lead_time_days } : {}),
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
    const listing = await this.getListing(listingId);
    if (!listing) {
      return null;
    }

    const quantity = inventory.products.reduce(
      (sum, product) => sum + product.offerings.reduce((offeringSum, offering) => offeringSum + offering.quantity, 0),
      0
    );
    const price = inventory.products[0]?.offerings[0]?.price;
    const quantityOnHand = listing.fulfillment_mode === "stocked" ? quantity : listing.quantity_on_hand;

    const rows = await this.db
      .update(listingsTable)
      .set({
        inventory,
        quantity,
        quantityOnHand,
        ...(price !== undefined ? { price: price.toFixed(2) } : {}),
        updatedAt: this.resolveTimestamp(metadata)
      })
      .where(eq(listingsTable.listingId, listingId))
      .returning();

    if (!rows[0]) {
      return null;
    }

    const synced = syncListingInventoryState(this.mapListing(rows[0], listing.shop_name));
    await this.db
      .update(listingsTable)
      .set({
        quantity: synced.quantity,
        inventory: synced.inventory
      })
      .where(eq(listingsTable.listingId, listingId));

    return synced.inventory;
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
      ...recalculateShopBacklog(shop, listings),
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
      production_capacity_per_day: row.productionCapacityPerDay,
      backlog_units: row.backlogUnits,
      material_costs_paid_total: toNumber(row.materialCostsPaidTotal),
      seed_capital: toNumber(row.seedCapital),
      production_queue: row.productionQueue,
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
      fulfillment_mode: row.fulfillmentMode as Listing["fulfillment_mode"],
      quantity_on_hand: row.quantityOnHand,
      backlog_units: row.backlogUnits,
      price: toNumber(row.price),
      currency_code: row.currencyCode,
      who_made: row.whoMade,
      when_made: row.whenMade,
      taxonomy_id: row.taxonomyId,
      tags: row.tags,
      materials: row.materials,
      material_cost_per_unit: toNumber(row.materialCostPerUnit),
      capacity_units_per_item: row.capacityUnitsPerItem,
      lead_time_days: row.leadTimeDays,
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
      available_at: toIsoString(row.availableAt),
      posted_at: toIsoString(row.postedAt)
    };
  }

  private mapSimulationState(row: typeof simulationStateTable.$inferSelect): SimulationState {
    const scenario = normalizeSimulationScenario(row.scenario as SimulationScenario | null | undefined);
    return {
      current_day: {
        day: row.currentDay,
        date: toIsoString(row.currentDayDate),
        advanced_at: row.advancedAt ? toIsoString(row.advancedAt) : null
      },
      scenario,
      market_snapshot: row.marketSnapshot,
      trend_state: row.trendState,
      pending_reviews: row.pendingReviews,
      last_resolution: row.lastResolution
    };
  }

  private resolveTimestamp(metadata?: MutationMetadata): Date {
    return metadata?.timestamp ? new Date(metadata.timestamp) : new Date();
  }
}
