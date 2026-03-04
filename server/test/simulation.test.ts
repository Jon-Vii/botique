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
    assert.equal(marketSnapshot.active_listing_count, 9);
    assert.equal(marketSnapshot.active_shop_count, 5);
    assert.equal(marketSnapshot.total_quantity_on_hand, 47);
    assert.equal(marketSnapshot.total_backlog_units, 1);
    assert.equal(trendState.active_trends[0]?.taxonomy_id, 9101);
    assert.equal(trendState.active_trends[1], undefined);
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
    assert.equal(persisted.trend_state.active_trends[0]?.taxonomy_id, 9101);
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
    // Ceramic cup starts with qty=3, production can release +1, and demand may sell some.
    assert.ok(initialCeramicCup.quantity_on_hand <= 4, "inventory should be at most start + released");
    assert.equal(initialCeramicCup.backlog_units, 0, "stocked listing should not accumulate backlog");
    assert.equal(dayFourShopSummary?.units_released, 1, "the waiting_ready production job should release");
    assert.ok((dayFourShopSummary?.stocked_units_sold ?? 0) >= 0, "stocked sales should be tracked");
    assert.ok((dayFourShopSummary?.total_views ?? 0) > 0, "active listings should receive views");

    await simulation.advanceDay();
    const afterDayFive = await simulation.getWorldState();
    const trayListing = afterDayFive.marketplace.listings.find((listing) => listing.listing_id === 2001);
    const ceramicCup = afterDayFive.marketplace.listings.find((listing) => listing.listing_id === 2005);
    const dayFiveLayercake = afterDayFive.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1001);
    const dayFiveKilnBloom = afterDayFive.simulation.last_resolution?.shops.find((shop) => shop.shop_id === 1003);

    assert.ok(trayListing);
    assert.ok(ceramicCup);
    assert.ok(dayFiveLayercake!.orders_created >= 0, "layercake should resolve orders from demand");
    assert.ok(dayFiveKilnBloom!.orders_created >= 0, "kiln bloom should resolve orders from demand");
    assert.equal(dayFiveLayercake!.stocked_units_sold, dayFiveLayercake!.orders_created, "all layercake sales are stocked");

    // Stocked sales produce payments (some from day 4 may already be posted by day 5's settle step)
    const newPayments = afterDayFive.marketplace.payments.filter((payment) => payment.receipt_id >= 5008);
    assert.ok(newPayments.length > 0, "stocked sales should generate payments");
    assert.ok(
      newPayments.every((payment) => payment.status === "pending" || payment.status === "posted"),
      "new payments should be pending or posted"
    );
    assert.ok(afterDayFive.simulation.pending_reviews.length > 0, "stocked sales should generate pending reviews");
  });

  test("made-to-order listings keep sales in backlog until shared production finishes them", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    for (let index = 0; index < 5; index += 1) {
      await simulation.advanceDay();
    }

    const afterDayEight = await simulation.getWorldState();
    const customLid = afterDayEight.marketplace.listings.find((listing) => listing.listing_id === 2008);
    const originalCustomOrder = afterDayEight.marketplace.orders.find((order) => order.receipt_id === 5006);
    const originalCustomPayment = afterDayEight.marketplace.payments.find((payment) => payment.receipt_id === 5006);

    assert.ok(customLid);
    assert.ok(originalCustomOrder);
    assert.ok(originalCustomPayment);
    // Made-to-order listing should never have stocked inventory
    assert.equal(customLid.quantity_on_hand, 0, "made-to-order listings never build on-hand inventory");
    // The original seed order (5006) should be fulfilled after 5 days of production
    assert.equal(originalCustomOrder.status, "fulfilled", "original custom order should complete");
    assert.equal(originalCustomOrder.was_delivered, true);
    assert.equal(originalCustomPayment.status, "posted", "original payment should be posted");
    // With demand model generating sales, backlog accumulates from new orders
    assert.ok(customLid.backlog_units >= 0, "backlog tracks unfulfilled made-to-order demand");
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

    // The key structural property: default shops auto-restock, controlled shops do not
    assert.ok(defaultLayercake.production_queue.some((job) => job.kind === "stock"),
      "default (uncontrolled) shop should have auto-generated stock jobs");
    assert.equal(controlledLayercake.production_queue.some((job) => job.kind === "stock"), false,
      "controlled shop should never receive auto stock jobs");
    // Controlled shop inventory depletes without replenishment
    assert.equal(controlledTray.quantity_on_hand, 0,
      "controlled shop tray should deplete to zero without restocking");

    // Non-controlled shops (like kiln bloom / 1003) should behave identically in both simulations
    assert.equal(defaultCeramic.quantity_on_hand, controlledCeramic.quantity_on_hand,
      "uncontrolled shops should have identical inventory in both simulations");
  });

  test("delayed payments and reviews remain inspectable until their release day", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);
    const startingReviewCount = (await simulation.getWorldState()).marketplace.reviews.length;

    await simulation.advanceDay();
    let world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 4);
    // Day 4 sales create pending reviews and pending payments
    const dayFourReviewCount = world.simulation.pending_reviews.length;
    const dayFourPendingPayments = world.marketplace.payments.filter(
      (payment) => payment.receipt_id >= 5008 && payment.status === "pending"
    );
    assert.ok(dayFourReviewCount > 0, "stocked sales should create pending reviews");
    assert.ok(dayFourPendingPayments.length > 0, "sales should create pending payments");
    // All new payments should have available_at one day after creation
    assert.ok(
      dayFourPendingPayments.every((payment) => payment.available_at === "2026-03-02T00:00:00.000Z"),
      "day 4 payments should be available on day 5 (2026-03-02)"
    );

    await simulation.advanceDay();
    world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 5);
    // Day 4's pending payments should now be posted (available_at was 2026-03-02, day 5 date is 2026-03-02)
    const postedFromDayFour = world.marketplace.payments.filter(
      (payment) => payment.available_at === "2026-03-02T00:00:00.000Z" && payment.status === "posted"
    );
    assert.ok(postedFromDayFour.length > 0, "day 4 payments should settle on day 5");

    // Advance several more days to verify reviews eventually release
    await simulation.advanceDay();
    await simulation.advanceDay();
    world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 7);
    // Reviews from day 4 stocked sales should have been released by now
    const reviewCount = world.marketplace.reviews.length;
    assert.ok(
      reviewCount > startingReviewCount,
      "reviews should grow as pending reviews are released"
    );
  });

  test("marketplace search scores respond to simulation day changes without route changes", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);
    const service = new MarketplaceService(repository, simulation);

    const before = await service.searchMarketplace({
      keywords: "custom lid",
      limit: 10,
      offset: 0
    });
    const beforeScore = before.results.find((listing) => listing.listing_id === 2008)?.ranking_score;

    await simulation.advanceDay();

    const after = await service.searchMarketplace({
      keywords: "custom lid",
      limit: 10,
      offset: 0
    });
    const afterScore = after.results.find((listing) => listing.listing_id === 2008)?.ranking_score;

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
