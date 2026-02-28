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
    assert.equal(snapshot.active_listing_count, 3);
    assert.equal(snapshot.active_shop_count, 2);
    assert.ok(snapshot.average_active_price > 0);
    assert.ok(snapshot.taxonomy.length >= 2);

    assert.equal(trendResponse.statusCode, 200);
    const trendState = trendResponse.json();
    assert.equal(trendState.active_trends[0]?.taxonomy_id, 9103);
    assert.equal(trendState.active_trends[1]?.taxonomy_id, 9104);

    assert.equal(worldStateResponse.statusCode, 200);
    const worldState = worldStateResponse.json();
    assert.equal(worldState.marketplace.shops[0].shop_id, 1001);
    assert.equal("listing_active_count" in worldState.marketplace.shops[0], false);
    assert.equal(worldState.simulation.current_day.day, 3);
    assert.equal(worldState.simulation.pending_events.length, 2);
    assert.equal(worldState.simulation.last_day_resolution, null);
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
        "resolve_listing_activity",
        "settle_pending_events",
        "advance_clock",
        "refresh_trends",
        "refresh_market_snapshot"
      ]
    );
    assert.equal(advancePayload.world.simulation.last_day_resolution.totals.orders_created, 1);
    assert.equal(advancePayload.world.simulation.last_day_resolution.processed_events.post_payment, 2);
    assert.equal(advancePayload.world.simulation.pending_events.length, 1);
    assert.equal(advancePayload.world.marketplace.orders.length, 3);

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
    assert.equal(
      worldStateResponse.json().simulation.last_day_resolution.listing_metrics[0].listing_id,
      2003
    );
  });
});
