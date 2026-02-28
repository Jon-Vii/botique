import { sql } from "drizzle-orm";

import type { BotiqueDatabase, DatabaseClient } from "./client";

export async function bootstrapDatabase({ client, db }: DatabaseClient): Promise<BotiqueDatabase> {
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

  await db.execute(sql`create index if not exists listings_shop_id_idx on listings (shop_id)`);
  await db.execute(sql`create index if not exists listings_state_idx on listings (state)`);
  await db.execute(sql`create index if not exists orders_shop_id_idx on orders (shop_id)`);
  await db.execute(sql`create index if not exists reviews_shop_id_idx on reviews (shop_id)`);
  await db.execute(sql`create index if not exists taxonomy_nodes_parent_idx on taxonomy_nodes (parent_taxonomy_id)`);

  return db;
}
