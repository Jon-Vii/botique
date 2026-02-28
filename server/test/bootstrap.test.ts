import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createDefaultMarketplaceState } from "../src/default-marketplace-state";
import { seedMarketplaceStateIfEmpty } from "../src/db/bootstrap";
import type { DatabaseClient } from "../src/db/client";

type RecordedQuery = {
  text: string;
  values: unknown[];
};

type FakeSqlClient = DatabaseClient["client"] & {
  reserve(): Promise<FakeSqlClient & { release(): void }>;
  release(): void;
};

function createFakeClient(existingShopIds: number[]) {
  const queries: RecordedQuery[] = [];

  const client = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });

    if (text.includes("select shop_id from shops")) {
      return existingShopIds.map((shop_id) => ({ shop_id }));
    }

    return [];
  }) as unknown as FakeSqlClient;

  client.release = () => undefined;
  client.reserve = async () => client;

  return { client: client as unknown as DatabaseClient["client"], queries };
}

describe("Postgres marketplace bootstrap", () => {
  test("seeds the default marketplace state when the database is empty", async () => {
    const defaultState = createDefaultMarketplaceState();
    const { client, queries } = createFakeClient([]);

    const seeded = await seedMarketplaceStateIfEmpty(client, defaultState);

    assert.equal(seeded, true);
    assert.ok(queries.some((query) => query.text.includes("insert into taxonomy_nodes")));
    assert.ok(queries.some((query) => query.text.includes("insert into shops")));
    assert.ok(queries.some((query) => query.text.includes("insert into listings")));
    assert.ok(queries.some((query) => query.text.includes("insert into orders")));
    assert.ok(queries.some((query) => query.text.includes("insert into reviews")));
    assert.ok(queries.some((query) => query.text.includes("insert into payments")));

    const insertQueries = queries.filter((query) => query.text.startsWith("insert into "));
    const expectedInsertCount =
      defaultState.taxonomyNodes.length +
      defaultState.shops.length +
      defaultState.listings.length +
      defaultState.orders.length +
      defaultState.reviews.length +
      defaultState.payments.length;

    assert.equal(insertQueries.length, expectedInsertCount);
  });

  test("skips default seeding when the database already contains non-seed shops", async () => {
    const { client, queries } = createFakeClient([9999]);

    const seeded = await seedMarketplaceStateIfEmpty(client);

    assert.equal(seeded, false);
    assert.equal(queries.filter((query) => query.text.startsWith("insert into ")).length, 0);
  });

  test("repairs a partial default seed when one of the default shops already exists", async () => {
    const { client, queries } = createFakeClient([1001]);

    const seeded = await seedMarketplaceStateIfEmpty(client);

    assert.equal(seeded, true);
    assert.ok(queries.some((query) => query.text.includes("insert into listings")));
    assert.ok(queries.some((query) => query.text.includes("insert into payments")));
  });
});
