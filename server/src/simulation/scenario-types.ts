export const scenarioIds = ["operate", "bootstrap"] as const;

export type ScenarioId = (typeof scenarioIds)[number];

export type SimulationScenario = {
  scenario_id: ScenarioId;
  controlled_shop_ids: number[];
  seed_capital?: number;
};

export type ScenarioResetOptions = {
  scenario_id?: ScenarioId;
  controlled_shop_ids?: readonly number[];
  seed_capital?: number;
};

export const DEFAULT_SCENARIO_ID: ScenarioId = "operate";
export const DEFAULT_CONTROLLED_SHOP_IDS = [1001] as const;

function normalizeControlledShopIds(controlledShopIds: readonly number[]): number[] {
  return [...new Set(controlledShopIds.map((shopId) => Number(shopId)).filter((shopId) => Number.isInteger(shopId) && shopId > 0))]
    .sort((left, right) => left - right);
}

export function isScenarioId(value: string): value is ScenarioId {
  return (scenarioIds as readonly string[]).includes(value);
}

export function createSimulationScenario(
  scenarioId: ScenarioId = DEFAULT_SCENARIO_ID,
  controlledShopIds: readonly number[] = DEFAULT_CONTROLLED_SHOP_IDS,
  seedCapital?: number
): SimulationScenario {
  return {
    scenario_id: scenarioId,
    controlled_shop_ids: normalizeControlledShopIds(controlledShopIds),
    ...(seedCapital !== undefined ? { seed_capital: seedCapital } : {})
  };
}

export function normalizeSimulationScenario(
  input: ScenarioResetOptions | SimulationScenario | null | undefined,
  availableShopIds: readonly number[] = []
): SimulationScenario {
  const scenarioId =
    input?.scenario_id && isScenarioId(input.scenario_id) ? input.scenario_id : DEFAULT_SCENARIO_ID;
  const controlledShopIds =
    input?.controlled_shop_ids === undefined ? DEFAULT_CONTROLLED_SHOP_IDS : input.controlled_shop_ids;
  const normalizedShopIds = normalizeControlledShopIds(controlledShopIds ?? []);

  const seedCapital = input?.seed_capital;

  if (availableShopIds.length === 0) {
    return {
      scenario_id: scenarioId,
      controlled_shop_ids: normalizedShopIds,
      ...(seedCapital !== undefined ? { seed_capital: seedCapital } : {})
    };
  }

  const available = new Set(availableShopIds.map((shopId) => Number(shopId)));
  return {
    scenario_id: scenarioId,
    controlled_shop_ids: normalizedShopIds.filter((shopId) => available.has(shopId)),
    ...(seedCapital !== undefined ? { seed_capital: seedCapital } : {})
  };
}

export function hasScenarioResetOptions(options: ScenarioResetOptions | null | undefined): boolean {
  return options?.scenario_id !== undefined || options?.controlled_shop_ids !== undefined;
}
