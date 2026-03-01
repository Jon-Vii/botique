import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildScenarioWorldState } from "../src/simulation/scenarios";
import { resolveAdvanceDay } from "../src/simulation/day-resolution";

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

  test("bootstrap strips ALL shops — empty listings, orders, reviews, payments", () => {
    const world = buildScenarioWorldState({
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });

    // All listings, orders, reviews, payments are cleared globally
    assert.equal(world.marketplace.listings.length, 0);
    assert.equal(world.marketplace.orders.length, 0);
    assert.equal(world.marketplace.reviews.length, 0);
    assert.equal(world.marketplace.payments.length, 0);
    assert.equal(world.simulation.pending_reviews?.length ?? 0, 0);

    // All shops have zero backlog, zero material costs, empty production queues
    for (const shop of world.marketplace.shops) {
      assert.equal(shop.backlog_units, 0, `shop ${shop.shop_id} backlog_units should be 0`);
      assert.equal(shop.material_costs_paid_total, 0, `shop ${shop.shop_id} material_costs should be 0`);
      assert.equal(shop.production_queue.length, 0, `shop ${shop.shop_id} queue should be empty`);
    }

    // Market snapshot should show zero active listings
    assert.equal(world.simulation.market_snapshot.active_listing_count, 0);
  });

  test("bootstrap sets seed_capital on every shop (default 500)", () => {
    const world = buildScenarioWorldState({
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });

    for (const shop of world.marketplace.shops) {
      assert.equal(shop.seed_capital, 500, `shop ${shop.shop_id} should have seed_capital=500`);
    }
  });

  test("bootstrap sets custom seed_capital when specified", () => {
    const world = buildScenarioWorldState({
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001],
      seed_capital: 250
    });

    for (const shop of world.marketplace.shops) {
      assert.equal(shop.seed_capital, 250, `shop ${shop.shop_id} should have seed_capital=250`);
    }
  });

  test("bootstrap agent shop gets placeholder name, NPCs keep their names", () => {
    const world = buildScenarioWorldState({
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });

    const agentShop = world.marketplace.shops.find((shop) => shop.shop_id === 1001);
    assert.ok(agentShop);
    assert.equal(agentShop.title, "New Shop");

    const npcShop = world.marketplace.shops.find((shop) => shop.shop_id === 1002);
    assert.ok(npcShop);
    assert.equal(npcShop.title, "Printform Studio");
  });

  test("NPC shops accumulate listings over multiple advance-day calls from bootstrap", () => {
    const world = buildScenarioWorldState({
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });

    // Verify starting from zero
    assert.equal(world.marketplace.listings.length, 0);

    // Advance day 1: each NPC should create at least 1 listing
    const after1 = resolveAdvanceDay(world, { controlled_shop_ids: [1001] });

    const npcListingsAfter1 = after1.world.marketplace.listings.filter(
      (listing) => listing.shop_id !== 1001
    );
    assert.ok(npcListingsAfter1.length >= 3, `Expected at least 3 NPC listings after day 1, got ${npcListingsAfter1.length}`);

    // Advance day 2: NPCs may add more
    const after2 = resolveAdvanceDay(after1.world, { controlled_shop_ids: [1001] });
    const npcListingsAfter2 = after2.world.marketplace.listings.filter(
      (listing) => listing.shop_id !== 1001
    );
    assert.ok(npcListingsAfter2.length >= npcListingsAfter1.length, "NPC listings should not decrease");

    // Advance day 3: by now most NPCs should have 2 listings
    const after3 = resolveAdvanceDay(after2.world, { controlled_shop_ids: [1001] });
    const npcListingsAfter3 = after3.world.marketplace.listings.filter(
      (listing) => listing.shop_id !== 1001
    );
    assert.ok(npcListingsAfter3.length >= 3 && npcListingsAfter3.length <= 6,
      `Expected 3-6 NPC listings after day 3, got ${npcListingsAfter3.length}`
    );
  });

  test("operate scenario keeps seed_capital at 0", () => {
    const world = buildScenarioWorldState({
      scenario_id: "operate",
      controlled_shop_ids: [1001]
    });

    for (const shop of world.marketplace.shops) {
      assert.equal(shop.seed_capital, 0, `operate shop ${shop.shop_id} should have seed_capital=0`);
    }
  });
});
