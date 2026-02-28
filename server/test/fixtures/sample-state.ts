import { createDefaultMarketplaceState } from "../../src/default-marketplace-state";
import { createSimulationDay, createWorldState } from "../../src/simulation/state";

export function createSampleState() {
  return createWorldState(createDefaultMarketplaceState(), {
    currentDay: createSimulationDay(3, "2026-02-28T00:00:00.000Z")
  });
}
