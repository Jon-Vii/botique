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
    assert.equal(marketSnapshot.active_listing_count, 3);
    assert.equal(marketSnapshot.active_shop_count, 2);
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
      ["advance_clock", "refresh_trends", "refresh_market_snapshot"]
    );
    assert.equal(persisted.current_day.day, 4);
    assert.equal(persisted.trend_state.active_trends[0]?.taxonomy_id, 9104);
    assert.equal(persisted.market_snapshot.generated_at, persisted.current_day.advanced_at);
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
});
