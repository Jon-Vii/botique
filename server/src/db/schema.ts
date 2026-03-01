import { integer, jsonb, numeric, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import type { ListingInventory, Order, Payment, Review, TaxonomyNode } from "../schemas/domain";
import type {
  DayResolutionSummary,
  MarketSnapshot,
  PendingEvent,
  TrendState
} from "../simulation/state-types";

export const shopsTable = pgTable("shops", {
  shopId: integer("shop_id").primaryKey(),
  shopName: varchar("shop_name", { length: 128 }).notNull(),
  title: text("title").notNull(),
  announcement: text("announcement").notNull(),
  saleMessage: text("sale_message").notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  digitalProductPolicy: text("digital_product_policy").notNull(),
  productionCapacityPerDay: integer("production_capacity_per_day").notNull(),
  backlogUnits: integer("backlog_units").notNull(),
  materialCostsPaidTotal: numeric("material_costs_paid_total", { precision: 10, scale: 2 }).notNull(),
  productionQueue: jsonb("production_queue").$type<ProductionQueueItem[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const listingsTable = pgTable("listings", {
  listingId: integer("listing_id").primaryKey(),
  shopId: integer("shop_id")
    .references(() => shopsTable.shopId, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  state: varchar("state", { length: 16 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  quantity: integer("quantity").notNull(),
  fulfillmentMode: varchar("fulfillment_mode", { length: 32 }).notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull(),
  backlogUnits: integer("backlog_units").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  whoMade: varchar("who_made", { length: 64 }).notNull(),
  whenMade: varchar("when_made", { length: 64 }).notNull(),
  taxonomyId: integer("taxonomy_id").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull(),
  materials: jsonb("materials").$type<string[]>().notNull(),
  materialCostPerUnit: numeric("material_cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  capacityUnitsPerItem: integer("capacity_units_per_item").notNull(),
  leadTimeDays: integer("lead_time_days").notNull(),
  imageIds: jsonb("image_ids").$type<number[]>().notNull(),
  views: integer("views").notNull(),
  favorites: integer("favorites").notNull(),
  url: text("url").notNull(),
  inventory: jsonb("inventory").$type<ListingInventory>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const ordersTable = pgTable("orders", {
  receiptId: integer("receipt_id").primaryKey(),
  shopId: integer("shop_id")
    .references(() => shopsTable.shopId, { onDelete: "cascade" })
    .notNull(),
  buyerName: text("buyer_name").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  wasPaid: integer("was_paid").notNull(),
  wasShipped: integer("was_shipped").notNull(),
  wasDelivered: integer("was_delivered").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  lineItems: jsonb("line_items").$type<Order["line_items"]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const reviewsTable = pgTable("reviews", {
  reviewId: integer("review_id").primaryKey(),
  shopId: integer("shop_id")
    .references(() => shopsTable.shopId, { onDelete: "cascade" })
    .notNull(),
  listingId: integer("listing_id")
    .references(() => listingsTable.listingId, { onDelete: "cascade" })
    .notNull(),
  receiptId: integer("receipt_id").references(() => ordersTable.receiptId, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  review: text("review").notNull(),
  buyerName: text("buyer_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const paymentsTable = pgTable("payments", {
  paymentId: integer("payment_id").primaryKey(),
  shopId: integer("shop_id")
    .references(() => shopsTable.shopId, { onDelete: "cascade" })
    .notNull(),
  receiptId: integer("receipt_id")
    .references(() => ordersTable.receiptId, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull()
});

export const taxonomyNodesTable = pgTable("taxonomy_nodes", {
  taxonomyId: integer("taxonomy_id").primaryKey(),
  parentTaxonomyId: integer("parent_taxonomy_id"),
  name: text("name").notNull(),
  fullPath: text("full_path").notNull(),
  level: integer("level").notNull()
});

export const simulationStateTable = pgTable("simulation_state", {
  stateKey: varchar("state_key", { length: 64 }).primaryKey(),
  currentDay: integer("current_day").notNull(),
  currentDayDate: timestamp("current_day_date", { withTimezone: true }).notNull(),
  advancedAt: timestamp("advanced_at", { withTimezone: true }),
  marketSnapshot: jsonb("market_snapshot").$type<MarketSnapshot>().notNull(),
  trendState: jsonb("trend_state").$type<TrendState>().notNull(),
  pendingEvents: jsonb("pending_events").$type<PendingEvent[]>().notNull(),
  lastDayResolution: jsonb("last_day_resolution").$type<DayResolutionSummary | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});
