import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { buildApp } from "../src/app";
import { createInMemoryMarketplaceRepository } from "../src/repositories/in-memory-marketplace-repository";
import { createSampleState } from "./fixtures/sample-state";

describe("Botique server control endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp({
      repository: createInMemoryMarketplaceRepository(createSampleState())
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test("reads simulation day, market snapshot, trend state, and debug world state from /control", async () => {
    const [dayResponse, snapshotResponse, trendResponse, worldStateResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/simulation/day" }),
      app.inject({ method: "GET", url: "/control/simulation/market-snapshot" }),
      app.inject({ method: "GET", url: "/control/simulation/trend-state" }),
      app.inject({ method: "GET", url: "/control/world-state" })
    ]);

    assert.equal(dayResponse.statusCode, 200);
    assert.deepEqual(dayResponse.json(), {
      day: 3,
      date: "2026-02-28T00:00:00.000Z",
      advanced_at: null
    });

    assert.equal(snapshotResponse.statusCode, 200);
    const snapshot = snapshotResponse.json();
    assert.equal(snapshot.active_listing_count, 4);
    assert.equal(snapshot.active_shop_count, 4);
    assert.ok(snapshot.average_active_price > 0);
    assert.equal(snapshot.total_quantity_on_hand, 8);
    assert.equal(snapshot.total_backlog_units, 2);
    assert.ok(snapshot.taxonomy.length >= 4);

    assert.equal(trendResponse.statusCode, 200);
    const trendState = trendResponse.json();
    assert.equal(trendState.active_trends[0]?.taxonomy_id, 9103);
    assert.equal(trendState.active_trends[1]?.taxonomy_id, 9104);

    assert.equal(worldStateResponse.statusCode, 200);
    const worldState = worldStateResponse.json();
    assert.equal(worldState.marketplace.shops[0].shop_id, 1001);
    assert.equal("listing_active_count" in worldState.marketplace.shops[0], false);
    assert.equal(worldState.simulation.current_day.day, 3);
  });

  test("advances the simulation day through /control and persists the updated state", async () => {
    const advanceResponse = await app.inject({
      method: "POST",
      url: "/control/simulation/advance-day"
    });

    assert.equal(advanceResponse.statusCode, 200);
    const advancePayload = advanceResponse.json();
    assert.equal(advancePayload.previous_day.day, 3);
    assert.equal(advancePayload.current_day.day, 4);
    assert.equal(advancePayload.current_day.date, "2026-03-01T00:00:00.000Z");
    assert.deepEqual(
      advancePayload.steps.map((step: { name: string }) => step.name),
      [
        "advance_clock",
        "refresh_trends",
        "release_completed_production",
        "settle_delayed_events",
        "resolve_market_sales",
        "allocate_production",
        "refresh_market_snapshot"
      ]
    );

    const [dayResponse, trendResponse, worldStateResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/simulation/day" }),
      app.inject({ method: "GET", url: "/control/simulation/trend-state" }),
      app.inject({ method: "GET", url: "/control/world-state" })
    ]);

    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.json().day, 4);

    assert.equal(trendResponse.statusCode, 200);
    assert.equal(trendResponse.json().active_trends[0]?.taxonomy_id, 9104);

    assert.equal(worldStateResponse.statusCode, 200);
    assert.equal(worldStateResponse.json().simulation.current_day.day, 4);
    assert.equal(
      worldStateResponse.json().simulation.market_snapshot.generated_at,
      advancePayload.current_day.advanced_at
    );
  });

  test("accepts controlled shop ids when advancing the simulation day", async () => {
    const advanceResponse = await app.inject({
      method: "POST",
      url: "/control/simulation/advance-day",
      payload: {
        controlled_shop_ids: [1001]
      }
    });

    assert.equal(advanceResponse.statusCode, 200);
    const payload = advanceResponse.json();
    assert.equal(payload.previous_day.day, 3);
    assert.equal(payload.current_day.day, 4);
  });

  test("resets the world state through /control back to the initial seeded snapshot", async () => {
    const advanceResponse = await app.inject({
      method: "POST",
      url: "/control/simulation/advance-day"
    });
    assert.equal(advanceResponse.statusCode, 200);

    const resetResponse = await app.inject({
      method: "POST",
      url: "/control/world/reset"
    });
    assert.equal(resetResponse.statusCode, 200);

    const resetPayload = resetResponse.json();
    assert.equal(resetPayload.simulation.current_day.day, 3);
    assert.equal(resetPayload.simulation.current_day.date, "2026-02-28T00:00:00.000Z");
    assert.equal(resetPayload.simulation.market_snapshot.active_listing_count, 4);
    assert.equal(resetPayload.marketplace.orders.length, 7);

    const dayResponse = await app.inject({ method: "GET", url: "/control/simulation/day" });
    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.json().day, 3);
  });

  test("replaces the world state through /control for repeatable runtime experiments", async () => {
    const originalWorldStateResponse = await app.inject({
      method: "GET",
      url: "/control/world-state"
    });

    assert.equal(originalWorldStateResponse.statusCode, 200);
    const replacementWorldState = originalWorldStateResponse.json();
    replacementWorldState.simulation.current_day = {
      day: 9,
      date: "2026-03-06T00:00:00.000Z",
      advanced_at: "2026-03-05T23:59:59.000Z"
    };
    replacementWorldState.marketplace.shops[0].announcement = "Tournament reset applied.";

    const replaceResponse = await app.inject({
      method: "POST",
      url: "/control/world-state",
      payload: replacementWorldState
    });

    assert.equal(replaceResponse.statusCode, 200);
    assert.equal(replaceResponse.json().simulation.current_day.day, 9);
    assert.equal(
      replaceResponse.json().marketplace.shops[0].announcement,
      "Tournament reset applied."
    );

    const [dayResponse, worldStateResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/simulation/day" }),
      app.inject({ method: "GET", url: "/control/world-state" })
    ]);

    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.json().day, 9);
    assert.equal(
      worldStateResponse.json().marketplace.shops[0].announcement,
      "Tournament reset applied."
    );
  });
});
