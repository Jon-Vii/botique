import { sql } from "drizzle-orm";

import { createDefaultMarketplaceState } from "../default-marketplace-state";
import type { StoredMarketplaceState } from "../simulation/state-types";
import type { BotiqueDatabase, DatabaseClient } from "./client";

async function shouldSeedDefaultMarketplaceState(
  client: DatabaseClient["client"],
  seedState: StoredMarketplaceState
): Promise<boolean> {
  const rows = (await client`select shop_id from shops`) as Array<{
    shop_id: number | string;
  }>;

  if (rows.length === 0) {
    return true;
  }

  const seededShopIds = new Set(seedState.shops.map((shop) => shop.shop_id));
  return rows.some((row) => seededShopIds.has(Number(row.shop_id)));
}

export async function seedMarketplaceStateIfEmpty(
  client: DatabaseClient["client"],
  seedState: StoredMarketplaceState = createDefaultMarketplaceState()
): Promise<boolean> {
  const sql = await client.reserve();

  try {
    await sql`begin`;

    if (!(await shouldSeedDefaultMarketplaceState(sql, seedState))) {
      await sql`commit`;
      return false;
    }

    for (const taxonomyNode of seedState.taxonomyNodes) {
      await sql`
        insert into taxonomy_nodes (taxonomy_id, parent_taxonomy_id, name, full_path, level)
        values (
          ${taxonomyNode.taxonomy_id},
          ${taxonomyNode.parent_taxonomy_id},
          ${taxonomyNode.name},
          ${taxonomyNode.full_path},
          ${taxonomyNode.level}
        )
        on conflict (taxonomy_id) do nothing
      `;
    }

    for (const shop of seedState.shops) {
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
          ${JSON.stringify(shop.production_queue)}::jsonb,
          ${shop.created_at},
          ${shop.updated_at}
        )
        on conflict (shop_id) do nothing
      `;
    }

    for (const listing of seedState.listings) {
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
        on conflict (listing_id) do nothing
      `;
    }

    for (const order of seedState.orders) {
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
        on conflict (receipt_id) do nothing
      `;
    }

    for (const review of seedState.reviews) {
      await sql`
        insert into reviews (
          review_id,
          shop_id,
          listing_id,
          receipt_id,
          rating,
          review,
          buyer_name,
          created_at
        )
        values (
          ${review.review_id},
          ${review.shop_id},
          ${review.listing_id},
          ${review.receipt_id ?? null},
          ${review.rating},
          ${review.review},
          ${review.buyer_name},
          ${review.created_at}
        )
        on conflict (review_id) do nothing
      `;
    }

    for (const payment of seedState.payments) {
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
        on conflict (payment_id) do nothing
      `;
    }

    await sql`commit`;
    return true;
  } catch (error) {
    await sql`rollback`;
    throw error;
  } finally {
    sql.release();
  }
}

export async function bootstrapDatabase(
  { client, db }: DatabaseClient,
  seedState: StoredMarketplaceState = createDefaultMarketplaceState()
): Promise<BotiqueDatabase> {
  await client`
    create table if not exists shops (
      shop_id integer primary key,
      shop_name varchar(128) not null,
      title text not null,
      announcement text not null,
      sale_message text not null,
      currency_code varchar(3) not null,
      digital_product_policy text not null,
      production_capacity_per_day integer not null,
      backlog_units integer not null,
      material_costs_paid_total numeric(10, 2) not null,
      production_queue jsonb not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await client`alter table shops add column if not exists production_capacity_per_day integer`;
  await client`alter table shops add column if not exists backlog_units integer`;
  await client`alter table shops add column if not exists material_costs_paid_total numeric(10, 2)`;
  await client`alter table shops add column if not exists production_queue jsonb`;
  await client`update shops set production_capacity_per_day = coalesce(production_capacity_per_day, 6)`;
  await client`update shops set backlog_units = coalesce(backlog_units, 0)`;
  await client`update shops set material_costs_paid_total = coalesce(material_costs_paid_total, 0)`;
  await client`update shops set production_queue = coalesce(production_queue, '[]'::jsonb)`;
  await client`alter table shops alter column production_capacity_per_day set not null`;
  await client`alter table shops alter column backlog_units set not null`;
  await client`alter table shops alter column material_costs_paid_total set not null`;
  await client`alter table shops alter column production_queue set not null`;

  await client`
    create table if not exists listings (
      listing_id integer primary key,
      shop_id integer not null references shops(shop_id) on delete cascade,
      title text not null,
      description text not null,
      state varchar(16) not null,
      type varchar(32) not null,
      quantity integer not null,
      fulfillment_mode varchar(32) not null,
      quantity_on_hand integer not null,
      backlog_units integer not null,
      price numeric(10, 2) not null,
      currency_code varchar(3) not null,
      who_made varchar(64) not null,
      when_made varchar(64) not null,
      taxonomy_id integer not null,
      tags jsonb not null,
      materials jsonb not null,
      material_cost_per_unit numeric(10, 2) not null,
      capacity_units_per_item integer not null,
      lead_time_days integer not null,
      image_ids jsonb not null,
      views integer not null,
      favorites integer not null,
      url text not null,
      inventory jsonb not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await client`alter table listings add column if not exists fulfillment_mode varchar(32)`;
  await client`alter table listings add column if not exists quantity_on_hand integer`;
  await client`alter table listings add column if not exists backlog_units integer`;
  await client`alter table listings add column if not exists material_cost_per_unit numeric(10, 2)`;
  await client`alter table listings add column if not exists capacity_units_per_item integer`;
  await client`alter table listings add column if not exists lead_time_days integer`;
  await client`update listings set fulfillment_mode = coalesce(fulfillment_mode, 'stocked')`;
  await client`update listings set quantity_on_hand = coalesce(quantity_on_hand, quantity)`;
  await client`update listings set backlog_units = coalesce(backlog_units, 0)`;
  await client`update listings set material_cost_per_unit = coalesce(material_cost_per_unit, 0)`;
  await client`update listings set capacity_units_per_item = coalesce(capacity_units_per_item, 1)`;
  await client`update listings set lead_time_days = coalesce(lead_time_days, 1)`;
  await client`alter table listings alter column fulfillment_mode set not null`;
  await client`alter table listings alter column quantity_on_hand set not null`;
  await client`alter table listings alter column backlog_units set not null`;
  await client`alter table listings alter column material_cost_per_unit set not null`;
  await client`alter table listings alter column capacity_units_per_item set not null`;
  await client`alter table listings alter column lead_time_days set not null`;

  await client`
    create table if not exists orders (
      receipt_id integer primary key,
      shop_id integer not null references shops(shop_id) on delete cascade,
      buyer_name text not null,
      status varchar(16) not null,
      was_paid integer not null,
      was_shipped integer not null,
      was_delivered integer not null,
      total_price numeric(10, 2) not null,
      currency_code varchar(3) not null,
      line_items jsonb not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;

  await client`
    create table if not exists reviews (
      review_id integer primary key,
      shop_id integer not null references shops(shop_id) on delete cascade,
      listing_id integer not null references listings(listing_id) on delete cascade,
      receipt_id integer references orders(receipt_id) on delete set null,
      rating integer not null,
      review text not null,
      buyer_name text not null,
      created_at timestamptz not null
    )
  `;

  await client`
    alter table reviews
    add column if not exists receipt_id integer references orders(receipt_id) on delete set null
  `;

  await client`
    create table if not exists payments (
      payment_id integer primary key,
      shop_id integer not null references shops(shop_id) on delete cascade,
      receipt_id integer not null references orders(receipt_id) on delete cascade,
      amount numeric(10, 2) not null,
      currency_code varchar(3) not null,
      status varchar(16) not null,
      available_at timestamptz not null,
      posted_at timestamptz not null
    )
  `;
  await client`alter table payments add column if not exists available_at timestamptz`;
  await client`update payments set available_at = coalesce(available_at, posted_at)`;
  await client`alter table payments alter column available_at set not null`;

  await client`
    create table if not exists taxonomy_nodes (
      taxonomy_id integer primary key,
      parent_taxonomy_id integer,
      name text not null,
      full_path text not null,
      level integer not null
    )
  `;

  await client`
    create table if not exists simulation_state (
      state_key varchar(64) primary key,
      current_day integer not null,
      current_day_date timestamptz not null,
      advanced_at timestamptz,
      market_snapshot jsonb not null,
      trend_state jsonb not null,
      pending_events jsonb not null default '[]'::jsonb,
      last_day_resolution jsonb,
      updated_at timestamptz not null
    )
  `;
  await client`alter table simulation_state add column if not exists pending_reviews jsonb`;
  await client`alter table simulation_state add column if not exists last_resolution jsonb`;
  await client`update simulation_state set pending_reviews = coalesce(pending_reviews, '[]'::jsonb)`;
  await client`alter table simulation_state alter column pending_reviews set not null`;

  await client`
    alter table simulation_state
    add column if not exists pending_events jsonb not null default '[]'::jsonb
  `;

  await client`
    alter table simulation_state
    add column if not exists last_day_resolution jsonb
  `;

  await client`
    update simulation_state
    set pending_events = '[]'::jsonb
    where pending_events is null
  `;

  await db.execute(sql`create index if not exists listings_shop_id_idx on listings (shop_id)`);
  await db.execute(sql`create index if not exists listings_state_idx on listings (state)`);
  await db.execute(sql`create index if not exists orders_shop_id_idx on orders (shop_id)`);
  await db.execute(sql`create index if not exists reviews_shop_id_idx on reviews (shop_id)`);
  await db.execute(sql`create index if not exists taxonomy_nodes_parent_idx on taxonomy_nodes (parent_taxonomy_id)`);
  await seedMarketplaceStateIfEmpty(client, seedState);

  return db;
}
