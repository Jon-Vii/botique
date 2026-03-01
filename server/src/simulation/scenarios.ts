import { createDefaultMarketplaceState } from "../default-marketplace-state";
import { createWorldState } from "./state";
import {
  normalizeSimulationScenario,
  type ScenarioResetOptions,
  type SimulationScenario
} from "./scenario-types";
import type { PendingReview, StoredMarketplaceState, StoredWorldState } from "./state-types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertControlledShopsExist(
  marketplaceState: StoredMarketplaceState,
  scenario: SimulationScenario
) {
  const availableShopIds = new Set(marketplaceState.shops.map((shop) => shop.shop_id));
  const missingShopId = scenario.controlled_shop_ids.find((shopId) => !availableShopIds.has(shopId));

  if (missingShopId !== undefined) {
    throw new Error(`Scenario ${scenario.scenario_id} cannot target unknown shop ${missingShopId}.`);
  }
}

function filterBootstrapPendingReviews(
  pendingReviews: readonly PendingReview[],
  controlledShopIds: readonly number[]
): PendingReview[] {
  if (controlledShopIds.length === 0) {
    return pendingReviews.map((review) => clone(review));
  }

  const controlledShopIdSet = new Set(controlledShopIds);
  return pendingReviews
    .filter((review) => !controlledShopIdSet.has(review.shop_id))
    .map((review) => clone(review));
}

export function buildScenarioMarketplaceState(
  baseMarketplaceState: StoredMarketplaceState,
  scenario: SimulationScenario
): StoredMarketplaceState {
  const marketplaceState = clone(baseMarketplaceState);
  assertControlledShopsExist(marketplaceState, scenario);

  switch (scenario.scenario_id) {
    case "operate":
      return marketplaceState;
    case "bootstrap": {
      const controlledShopIds = new Set(scenario.controlled_shop_ids);
      return {
        ...marketplaceState,
        shops: marketplaceState.shops.map((shop) =>
          controlledShopIds.has(shop.shop_id)
            ? {
                ...shop,
                announcement:
                  "The shop has completed a few pilot sales, but the main public catalog still needs to be launched.",
                sale_message:
                  "Pilot work is complete. The first public listings still need to be drafted and activated.",
                digital_product_policy:
                  "Capacity is limited. New stocked listings need queued production, and made-to-order launches should use realistic lead times from day one.",
                backlog_units: 0,
                production_queue: []
              }
            : shop
        ),
        listings: marketplaceState.listings.filter((listing) => !controlledShopIds.has(listing.shop_id))
      };
    }
    default: {
      const exhaustiveCheck: never = scenario.scenario_id;
      return exhaustiveCheck;
    }
  }
}

export function buildScenarioWorldState(
  options: ScenarioResetOptions = {},
  baseWorldState: StoredWorldState = createWorldState(createDefaultMarketplaceState())
): StoredWorldState {
  const normalizedBaseWorld = clone(baseWorldState);
  const scenario = normalizeSimulationScenario(
    options,
    normalizedBaseWorld.marketplace.shops.map((shop) => shop.shop_id)
  );
  const marketplace = buildScenarioMarketplaceState(normalizedBaseWorld.marketplace, scenario);
  const pendingReviews =
    scenario.scenario_id === "bootstrap"
      ? filterBootstrapPendingReviews(
          normalizedBaseWorld.simulation.pending_reviews ?? [],
          scenario.controlled_shop_ids
        )
      : (normalizedBaseWorld.simulation.pending_reviews ?? []).map((review) => clone(review));

  return createWorldState(marketplace, {
    currentDay: normalizedBaseWorld.simulation.current_day,
    pendingReviews,
    scenario
  });
}
