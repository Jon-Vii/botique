import { createDefaultMarketplaceState } from "../default-marketplace-state";
import { clone, createWorldState } from "./state";
import {
  normalizeSimulationScenario,
  type ScenarioResetOptions,
  type SimulationScenario
} from "./scenario-types";
import type { StoredMarketplaceState, StoredWorldState } from "./state-types";

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
      const seedCapital = scenario.seed_capital ?? 500;
      return {
        ...marketplaceState,
        shops: marketplaceState.shops.map((shop) => ({
          ...shop,
          seed_capital: seedCapital,
          announcement: controlledShopIds.has(shop.shop_id)
            ? "This shop is brand new. Browse the marketplace, study trends, and create your first original listings."
            : shop.announcement,
          title: controlledShopIds.has(shop.shop_id) ? "New Shop" : shop.title,
          sale_message: "",
          digital_product_policy:
            "Capacity is limited. New stocked listings need queued production, and made-to-order launches should use realistic lead times from day one.",
          backlog_units: 0,
          material_costs_paid_total: 0,
          production_queue: []
        })),
        listings: [],
        orders: [],
        reviews: [],
        payments: []
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
      ? []
      : (normalizedBaseWorld.simulation.pending_reviews ?? []).map((review) => clone(review));

  return createWorldState(marketplace, {
    currentDay: normalizedBaseWorld.simulation.current_day,
    pendingReviews,
    scenario
  });
}
