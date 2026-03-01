import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createInMemoryMarketplaceRepository } from "../src/repositories/in-memory-marketplace-repository";
import { MarketplaceService } from "../src/services/marketplace-service";
import { createWorldSimulation } from "../src/simulation/world-simulation";
import { createSampleState } from "./fixtures/sample-state";

describe("System 2 simulation module", () => {
  test("exposes explicit current day, market snapshot, and trend state", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    const [currentDay, marketSnapshot, trendState] = await Promise.all([
      simulation.getCurrentDay(),
      simulation.getMarketSnapshot(),
      simulation.getTrendState()
    ]);

    assert.equal(currentDay.day, 3);
    assert.equal(currentDay.date, "2026-02-28T00:00:00.000Z");
    assert.equal(marketSnapshot.active_listing_count, 4);
    assert.equal(marketSnapshot.active_shop_count, 4);
    assert.equal(marketSnapshot.total_quantity_on_hand, 8);
    assert.equal(marketSnapshot.total_backlog_units, 2);
    assert.equal(trendState.active_trends[0]?.taxonomy_id, 9103);
    assert.equal(trendState.active_trends[1]?.taxonomy_id, 9104);
  });

  test("advanceDay persists the next day and refreshes deterministic trend state", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    const result = await simulation.advanceDay();
    const persisted = await repository.getSimulationState();

    assert.equal(result.previous_day.day, 3);
    assert.equal(result.current_day.day, 4);
    assert.equal(result.current_day.date, "2026-03-01T00:00:00.000Z");
    assert.deepEqual(
      result.steps.map((step) => step.name),
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
    assert.equal(persisted.current_day.day, 4);
    assert.equal(persisted.trend_state.active_trends[0]?.taxonomy_id, 9104);
    assert.equal(persisted.market_snapshot.generated_at, persisted.current_day.advanced_at);
  });

  test("stocked listings sell from finished inventory while production replenishes separately", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    await simulation.advanceDay();
    const afterDayFour = await simulation.getWorldState();
    const initialCeramicCup = afterDayFour.marketplace.listings.find((listing) => listing.listing_id === 2005);
    const dayFourShopSummary = afterDayFour.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1003);

    assert.ok(initialCeramicCup);
    assert.equal(initialCeramicCup.quantity_on_hand, 3);
    assert.equal(initialCeramicCup.backlog_units, 0);
    assert.equal(dayFourShopSummary?.units_released, 1);
    assert.equal(dayFourShopSummary?.production_units_started, 2);
    assert.equal(dayFourShopSummary?.material_costs_incurred, 27);

    await simulation.advanceDay();
    const afterDayFive = await simulation.getWorldState();
    const trayListing = afterDayFive.marketplace.listings.find((listing) => listing.listing_id === 2001);
    const ceramicCup = afterDayFive.marketplace.listings.find((listing) => listing.listing_id === 2005);
    const dayFiveLayercake = afterDayFive.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1001);
    const dayFiveKilnBloom = afterDayFive.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1003);

    assert.ok(trayListing);
    assert.ok(ceramicCup);
    assert.equal(trayListing.quantity_on_hand, 5);
    assert.equal(ceramicCup.quantity_on_hand, 2);
    assert.equal(dayFiveLayercake?.orders_created, 1);
    assert.equal(dayFiveLayercake?.stocked_units_sold, 1);
    assert.equal(dayFiveKilnBloom?.orders_created, 1);
    assert.equal(dayFiveKilnBloom?.stocked_units_sold, 1);

    const newStockedPayments = afterDayFive.marketplace.payments
      .filter((payment) => payment.receipt_id >= 5008)
      .map((payment) => ({
        receipt_id: payment.receipt_id,
        status: payment.status,
        available_at: payment.available_at
      }));
    assert.deepEqual(newStockedPayments, [
      {
        receipt_id: 5008,
        status: "pending",
        available_at: "2026-03-03T00:00:00.000Z"
      },
      {
        receipt_id: 5009,
        status: "pending",
        available_at: "2026-03-03T00:00:00.000Z"
      }
    ]);
    assert.equal(afterDayFive.simulation.pending_reviews.length, 2);
  });

  test("made-to-order listings keep sales in backlog until shared production finishes them", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    for (let index = 0; index < 5; index += 1) {
      await simulation.advanceDay();
    }

    const afterDayEight = await simulation.getWorldState();
    const familySign = afterDayEight.marketplace.listings.find((listing) => listing.listing_id === 2003);
    const originalCustomOrder = afterDayEight.marketplace.orders.find((order) => order.receipt_id === 5002);
    const originalCustomPayment = afterDayEight.marketplace.payments.find((payment) => payment.receipt_id === 5002);
    const dayEightSunline = afterDayEight.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1002);

    assert.ok(familySign);
    assert.ok(originalCustomOrder);
    assert.ok(originalCustomPayment);
    assert.equal(familySign.quantity_on_hand, 0);
    assert.equal(familySign.backlog_units, 0);
    assert.equal(originalCustomOrder.status, "fulfilled");
    assert.equal(originalCustomOrder.was_delivered, true);
    assert.equal(originalCustomPayment.status, "posted");
    assert.equal(dayEightSunline?.units_released, 1);
    assert.equal(afterDayEight.simulation.pending_reviews.length, 1);
    assert.equal(afterDayEight.simulation.pending_reviews[0]?.receipt_id, 5002);

    await simulation.advanceDay();
    const afterDayNine = await simulation.getWorldState();
    const nextSunlineSummary = afterDayNine.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1002);
    const repeatCustomOrder = afterDayNine.marketplace.orders.find((order) => order.receipt_id === 5010);

    assert.ok(repeatCustomOrder);
    assert.equal(nextSunlineSummary?.orders_created, 1);
    assert.equal(nextSunlineSummary?.made_to_order_units_sold, 1);
    assert.equal(repeatCustomOrder.status, "paid");
    assert.equal(
      afterDayNine.marketplace.listings.find((listing) => listing.listing_id === 2003)?.backlog_units,
      1
    );
  });

  test("controlled shops do not receive automatic stocked replenishment, while background shops still can", async () => {
    const defaultRepository = createInMemoryMarketplaceRepository(createSampleState());
    const controlledRepository = createInMemoryMarketplaceRepository(createSampleState());
    const defaultSimulation = createWorldSimulation(defaultRepository);
    const controlledSimulation = createWorldSimulation(controlledRepository);

    for (let index = 0; index < 30; index += 1) {
      await defaultSimulation.advanceDay();
      await controlledSimulation.advanceDay({ controlled_shop_ids: [1001] });
    }

    const defaultWorld = await defaultSimulation.getWorldState();
    const controlledWorld = await controlledSimulation.getWorldState();

    const defaultLayercake = defaultWorld.marketplace.shops.find((shop) => shop.shop_id === 1001);
    const controlledLayercake = controlledWorld.marketplace.shops.find((shop) => shop.shop_id === 1001);
    const defaultTray = defaultWorld.marketplace.listings.find((listing) => listing.listing_id === 2001);
    const controlledTray = controlledWorld.marketplace.listings.find((listing) => listing.listing_id === 2001);
    const defaultCeramic = defaultWorld.marketplace.listings.find((listing) => listing.listing_id === 2005);
    const controlledCeramic = controlledWorld.marketplace.listings.find((listing) => listing.listing_id === 2005);

    assert.ok(defaultLayercake);
    assert.ok(controlledLayercake);
    assert.ok(defaultTray);
    assert.ok(controlledTray);
    assert.ok(defaultCeramic);
    assert.ok(controlledCeramic);

    assert.equal(defaultTray.quantity_on_hand, 2);
    assert.equal(controlledTray.quantity_on_hand, 0);
    assert.ok(defaultLayercake.production_queue.some((job) => job.kind === "stock"));
    assert.equal(controlledLayercake.production_queue.some((job) => job.kind === "stock"), false);

    assert.equal(defaultCeramic.quantity_on_hand, controlledCeramic.quantity_on_hand);
  });

  test("delayed payments and reviews remain inspectable until their release day", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    await simulation.advanceDay();
    await simulation.advanceDay();
    let world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 5);
    assert.equal(world.simulation.pending_reviews.length, 2);
    assert.equal(
      world.marketplace.payments.filter((payment) => payment.receipt_id >= 5008 && payment.status === "pending").length,
      2
    );

    await simulation.advanceDay();
    world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 6);
    assert.equal(world.simulation.pending_reviews.length, 2);
    assert.equal(
      world.marketplace.payments.filter((payment) => payment.receipt_id >= 5008 && payment.status === "posted").length,
      2
    );

    await simulation.advanceDay();
    world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 7);
    assert.equal(world.simulation.pending_reviews.length, 0);
    assert.ok(world.marketplace.reviews.some((review) => review.listing_id === 2001 && review.created_at === "2026-03-04T00:00:00.000Z"));
    assert.ok(world.marketplace.reviews.some((review) => review.listing_id === 2005 && review.created_at === "2026-03-04T00:00:00.000Z"));
  });

  test("marketplace search scores respond to simulation day changes without route changes", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);
    const service = new MarketplaceService(repository, simulation);

    const before = await service.searchMarketplace({
      keywords: "espresso",
      limit: 10,
      offset: 0
    });
    const beforeScore = before.results.find((listing) => listing.listing_id === 2005)?.ranking_score;

    await simulation.advanceDay();

    const after = await service.searchMarketplace({
      keywords: "espresso",
      limit: 10,
      offset: 0
    });
    const afterScore = after.results.find((listing) => listing.listing_id === 2005)?.ranking_score;

    assert.ok(beforeScore !== undefined);
    assert.ok(afterScore !== undefined);
    assert.ok(afterScore < beforeScore);
  });

  test("seller mutations use the simulation day timestamp instead of wall clock time", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);
    const service = new MarketplaceService(repository, simulation);

    await simulation.advanceDay();
    await simulation.advanceDay();
    const currentDay = await simulation.getCurrentDay();

    const created = await service.createDraftListing(1001, {
      quantity: 2,
      title: "Day-aligned planter stand",
      description: "Created after the simulation advanced.",
      price: 36,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9101,
      type: "physical",
      material_cost_per_unit: 9,
      capacity_units_per_item: 2,
      lead_time_days: 3
    });
    const updated = await service.updateListing(1001, created.listing_id, {
      state: "active"
    });
    const shop = await service.updateShop(1001, {
      announcement: "Fresh listings for the current simulation day."
    });

    assert.equal(created.created_at, currentDay.date);
    assert.equal(created.updated_at, currentDay.date);
    assert.equal(updated.updated_at, currentDay.date);
    assert.equal(shop.updated_at, currentDay.date);
  });
});
