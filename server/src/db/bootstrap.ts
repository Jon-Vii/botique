import { sql } from "drizzle-orm";

import { createDefaultMarketplaceState } from "../default-marketplace-state";
import type { StoredMarketplaceState } from "../simulation/state-types";
import type { BotiqueDatabase, DatabaseClient } from "./client";

async function shopsTableHasRows(client: DatabaseClient["client"]): Promise<boolean> {
  const rows = (await client`select count(*)::int as row_count from shops`) as Array<{
    row_count: number | string;
  }>;
  return Number(rows[0]?.row_count ?? 0) > 0;
}

export async function seedMarketplaceStateIfEmpty(
  client: DatabaseClient["client"],
  seedState: StoredMarketplaceState = createDefaultMarketplaceState()
): Promise<boolean> {
  if (await shopsTableHasRows(client)) {
    return false;
  }

  for (const taxonomyNode of seedState.taxonomyNodes) {
    await client`
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
    await client`
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
      on conflict (shop_id) do nothing
    `;
  }

  for (const listing of seedState.listings) {
    await client`
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
      on conflict (listing_id) do nothing
    `;
  }

  for (const order of seedState.orders) {
    await client`
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
    await client`
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
      on conflict (review_id) do nothing
    `;
  }

  for (const payment of seedState.payments) {
    await client`
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
      on conflict (payment_id) do nothing
    `;
  }

  return true;
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
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;

  await client`
    create table if not exists listings (
      listing_id integer primary key,
      shop_id integer not null references shops(shop_id) on delete cascade,
      title text not null,
      description text not null,
      state varchar(16) not null,
      type varchar(32) not null,
      quantity integer not null,
      price numeric(10, 2) not null,
      currency_code varchar(3) not null,
      who_made varchar(64) not null,
      when_made varchar(64) not null,
      taxonomy_id integer not null,
      tags jsonb not null,
      materials jsonb not null,
      image_ids jsonb not null,
      views integer not null,
      favorites integer not null,
      url text not null,
      inventory jsonb not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;

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
      rating integer not null,
      review text not null,
      buyer_name text not null,
      created_at timestamptz not null
    )
  `;

  await client`
    create table if not exists payments (
      payment_id integer primary key,
      shop_id integer not null references shops(shop_id) on delete cascade,
      receipt_id integer not null references orders(receipt_id) on delete cascade,
      amount numeric(10, 2) not null,
      currency_code varchar(3) not null,
      status varchar(16) not null,
      posted_at timestamptz not null
    )
  `;

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
      updated_at timestamptz not null
    )
  `;

  await db.execute(sql`create index if not exists listings_shop_id_idx on listings (shop_id)`);
  await db.execute(sql`create index if not exists listings_state_idx on listings (state)`);
  await db.execute(sql`create index if not exists orders_shop_id_idx on orders (shop_id)`);
  await db.execute(sql`create index if not exists reviews_shop_id_idx on reviews (shop_id)`);
  await db.execute(sql`create index if not exists taxonomy_nodes_parent_idx on taxonomy_nodes (parent_taxonomy_id)`);
  await seedMarketplaceStateIfEmpty(client, seedState);

  return db;
}
