import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildScenarioWorldState } from "../src/simulation/scenarios";

describe("Botique scenario seeding", () => {
  test("operate preserves the existing-business controlled shop seed", () => {
    const world = buildScenarioWorldState({
      scenario_id: "operate",
      controlled_shop_ids: [1001]
    });

    assert.deepEqual(world.simulation.scenario, {
      scenario_id: "operate",
      controlled_shop_ids: [1001]
    });
    assert.equal(world.marketplace.listings.filter((listing) => listing.shop_id === 1001).length, 2);
    assert.equal(world.marketplace.orders.filter((order) => order.shop_id === 1001).length, 1);
    assert.equal(world.marketplace.reviews.filter((review) => review.shop_id === 1001).length, 1);
    assert.equal(world.marketplace.payments.filter((payment) => payment.shop_id === 1001).length, 1);
  });

  test("bootstrap removes the controlled shop catalog but keeps limited business history", () => {
    const world = buildScenarioWorldState({
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });
    const controlledShop = world.marketplace.shops.find((shop) => shop.shop_id === 1001);

    assert.ok(controlledShop);
    assert.deepEqual(world.simulation.scenario, {
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });
    assert.equal(world.marketplace.listings.filter((listing) => listing.shop_id === 1001).length, 0);
    assert.equal(controlledShop?.production_queue.length, 0);
    assert.equal(controlledShop?.backlog_units, 0);
    assert.equal(world.marketplace.orders.filter((order) => order.shop_id === 1001).length, 1);
    assert.equal(world.marketplace.reviews.filter((review) => review.shop_id === 1001).length, 1);
    assert.equal(world.marketplace.payments.filter((payment) => payment.shop_id === 1001).length, 1);
    assert.equal(world.simulation.market_snapshot.active_listing_count, 3);
  });
});
