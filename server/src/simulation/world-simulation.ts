import { buildScenarioWorldState } from "./scenarios";
import { normalizeWorldState } from "./state";
import type { ScenarioResetOptions, SimulationScenario } from "./scenario-types";
import { resolveAdvanceDay } from "./day-resolution";
import type {
  AdvanceDayResult,
  MarketSnapshot,
  MarketplaceSearchContext,
  SimulationDay,
  SimulationState,
  StoredMarketplaceState,
  StoredWorldState,
  TrendState
} from "./state-types";

export interface AdvanceDayOptions {
  controlled_shop_ids?: readonly number[];
}

export interface ResetWorldOptions extends ScenarioResetOptions {}

export interface SimulationStateStore {
  getMarketplaceState(): Promise<StoredMarketplaceState>;
  replaceWorldState(state: StoredWorldState): Promise<StoredWorldState>;
  resetWorldState?(options?: ResetWorldOptions): Promise<StoredWorldState>;
  getSimulationState(): Promise<SimulationState>;
  setSimulationState(state: SimulationState): Promise<SimulationState>;
}

export interface SimulationModule {
  getWorldState(): Promise<StoredWorldState>;
  replaceWorldState(state: StoredWorldState): Promise<StoredWorldState>;
  getCurrentDay(): Promise<SimulationDay>;
  getScenario(): Promise<SimulationScenario>;
  getMarketSnapshot(): Promise<MarketSnapshot>;
  getTrendState(): Promise<TrendState>;
  getSearchContext(): Promise<MarketplaceSearchContext>;
  advanceDay(options?: AdvanceDayOptions): Promise<AdvanceDayResult>;
  resetWorld(options?: ResetWorldOptions): Promise<StoredWorldState>;
}

export class WorldSimulation implements SimulationModule {
  constructor(private readonly store: SimulationStateStore) {}

  async getWorldState(): Promise<StoredWorldState> {
    const [marketplace, simulation] = await Promise.all([
      this.store.getMarketplaceState(),
      this.store.getSimulationState()
    ]);

    return normalizeWorldState({
      marketplace,
      simulation
    });
  }

  async replaceWorldState(state: StoredWorldState): Promise<StoredWorldState> {
    return this.store.replaceWorldState(state);
  }

  async getCurrentDay(): Promise<SimulationDay> {
    return (await this.store.getSimulationState()).current_day;
  }

  async getScenario(): Promise<SimulationScenario> {
    return (await this.getWorldState()).simulation.scenario;
  }

  async getMarketSnapshot(): Promise<MarketSnapshot> {
    return (await this.store.getSimulationState()).market_snapshot;
  }

  async getTrendState(): Promise<TrendState> {
    return (await this.store.getSimulationState()).trend_state;
  }

  async getSearchContext(): Promise<MarketplaceSearchContext> {
    const simulation = await this.store.getSimulationState();
    return {
      current_day: simulation.current_day,
      market_snapshot: simulation.market_snapshot,
      trend_state: simulation.trend_state
    };
  }

  async advanceDay(options: AdvanceDayOptions = {}): Promise<AdvanceDayResult> {
    const world = await this.getWorldState();
    const result = resolveAdvanceDay(world, options);
    const persistedWorld = await this.store.replaceWorldState(result.world);

    return {
      ...result,
      world: persistedWorld
    };
  }

  async resetWorld(options: ResetWorldOptions = {}): Promise<StoredWorldState> {
    if (this.store.resetWorldState) {
      return this.store.resetWorldState(options);
    }
    return this.store.replaceWorldState(buildScenarioWorldState(options));
  }
}

export function createWorldSimulation(store: SimulationStateStore): SimulationModule {
  return new WorldSimulation(store);
}
