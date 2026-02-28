import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createInMemoryMarketplaceRepository } from "../src/repositories/in-memory-marketplace-repository";
import { MarketplaceService } from "../src/services/marketplace-service";
import { createWorldSimulation } from "../src/simulation/world-simulation";
import { createSampleState } from "./fixtures/sample-state";

describe("System 2 simulation module", () => {
  test("exposes explicit current day, market snapshot, trend state, and pending event hooks", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    const [currentDay, marketSnapshot, trendState, worldState] = await Promise.all([
      simulation.getCurrentDay(),
      simulation.getMarketSnapshot(),
      simulation.getTrendState(),
      simulation.getWorldState()
    ]);

    assert.equal(currentDay.day, 3);
    assert.equal(currentDay.date, "2026-02-28T00:00:00.000Z");
    assert.equal(marketSnapshot.active_listing_count, 3);
    assert.equal(marketSnapshot.active_shop_count, 2);
    assert.equal(trendState.active_trends[0]?.taxonomy_id, 9103);
    assert.equal(trendState.active_trends[1]?.taxonomy_id, 9104);
    assert.equal(worldState.simulation.pending_events.length, 2);
    assert.equal(worldState.simulation.pending_events[0]?.type, "post_payment");
    assert.equal(worldState.simulation.pending_events[1]?.type, "create_review");
    assert.equal(worldState.simulation.last_day_resolution, null);
  });

  test("advanceDay resolves listing demand, posts due payments, and refreshes deterministic trend state", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);
    const service = new MarketplaceService(repository, simulation);

    const result = await simulation.advanceDay();
    const persisted = await repository.getSimulationState();
    const world = await simulation.getWorldState();
    const postedPayments = await service.getPayments(1002);
    const listing2003 = world.marketplace.listings.find((listing) => listing.listing_id === 2003);

    assert.equal(result.previous_day.day, 3);
    assert.equal(result.current_day.day, 4);
    assert.equal(result.current_day.date, "2026-03-01T00:00:00.000Z");
    assert.deepEqual(
      result.steps.map((step) => step.name),
      [
        "resolve_listing_activity",
        "settle_pending_events",
        "advance_clock",
        "refresh_trends",
        "refresh_market_snapshot"
      ]
    );
    assert.equal(persisted.current_day.day, 4);
    assert.equal(persisted.trend_state.active_trends[0]?.taxonomy_id, 9104);
    assert.equal(persisted.market_snapshot.generated_at, persisted.current_day.advanced_at);
    assert.ok(persisted.last_day_resolution);
    assert.equal(persisted.last_day_resolution?.totals.orders_created, 1);
    assert.equal(persisted.last_day_resolution?.processed_events.post_payment, 2);
    assert.equal(persisted.last_day_resolution?.pending_event_count, 1);
    assert.equal(world.marketplace.orders.length, 3);
    assert.equal(world.simulation.pending_events.length, 1);
    assert.equal(world.simulation.pending_events[0]?.type, "create_review");
    assert.equal(listing2003?.views, 204);
    assert.equal(listing2003?.favorites, 49);
    assert.equal(listing2003?.quantity, 998);
    assert.equal(postedPayments.count, 2);
    assert.deepEqual(
      postedPayments.results.map((payment) => payment.payment_id),
      [8002, 8003]
    );
  });

  test("subsequent advances turn scheduled review events into stored reviews", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);

    await simulation.advanceDay();
    await simulation.advanceDay();

    const world = await simulation.getWorldState();

    assert.equal(world.simulation.current_day.day, 5);
    assert.equal(world.marketplace.reviews.length, 3);
    assert.equal(world.marketplace.reviews.at(-1)?.review_id, 7003);
    assert.equal(world.marketplace.reviews.at(-1)?.listing_id, 2004);
    assert.equal(world.marketplace.reviews.at(-1)?.buyer_name, "Leo Ramirez");
    assert.equal(world.simulation.last_day_resolution?.processed_events.create_review, 1);
    assert.equal(world.simulation.last_day_resolution?.scheduled_events.create_review, 1);
    assert.equal(world.simulation.pending_events.length, 1);
    assert.equal(world.simulation.pending_events[0]?.event_id, "review-5006");
  });

  test("marketplace search scores respond to simulation day changes without route changes", async () => {
    const repository = createInMemoryMarketplaceRepository(createSampleState());
    const simulation = createWorldSimulation(repository);
    const service = new MarketplaceService(repository, simulation);

    const before = await service.searchMarketplace({
      keywords: "celestial",
      limit: 10,
      offset: 0
    });
    const beforeScore = before.results.find((listing) => listing.listing_id === 2003)?.ranking_score;

    await simulation.advanceDay();

    const after = await service.searchMarketplace({
      keywords: "celestial",
      limit: 10,
      offset: 0
    });
    const afterScore = after.results.find((listing) => listing.listing_id === 2003)?.ranking_score;

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
      title: "Day-aligned planner",
      description: "Created after the simulation advanced.",
      price: 12,
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9102,
      type: "download"
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
