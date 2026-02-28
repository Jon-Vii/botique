import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createDefaultMarketplaceState } from "../src/default-marketplace-state";
import { seedMarketplaceStateIfEmpty } from "../src/db/bootstrap";
import type { DatabaseClient } from "../src/db/client";

type RecordedQuery = {
  text: string;
  values: unknown[];
};

function createFakeClient(shopRowCount: number) {
  const queries: RecordedQuery[] = [];

  const client = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });

    if (text.includes("select count(*)::int as row_count from shops")) {
      return [{ row_count: shopRowCount }];
    }

    return [];
  }) as unknown as DatabaseClient["client"];

  return { client, queries };
}

describe("Postgres marketplace bootstrap", () => {
  test("seeds the default marketplace state when the database is empty", async () => {
    const defaultState = createDefaultMarketplaceState();
    const { client, queries } = createFakeClient(0);

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

  test("skips default seeding when shops already exist", async () => {
    const { client, queries } = createFakeClient(2);

    const seeded = await seedMarketplaceStateIfEmpty(client);

    assert.equal(seeded, false);
    assert.equal(queries.filter((query) => query.text.startsWith("insert into ")).length, 0);
  });
});
