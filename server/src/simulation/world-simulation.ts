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

export interface SimulationStateStore {
  getMarketplaceState(): Promise<StoredMarketplaceState>;
  replaceWorldState(state: StoredWorldState): Promise<StoredWorldState>;
  getSimulationState(): Promise<SimulationState>;
  setSimulationState(state: SimulationState): Promise<SimulationState>;
}

export interface SimulationModule {
  getWorldState(): Promise<StoredWorldState>;
  getCurrentDay(): Promise<SimulationDay>;
  getMarketSnapshot(): Promise<MarketSnapshot>;
  getTrendState(): Promise<TrendState>;
  getSearchContext(): Promise<MarketplaceSearchContext>;
  advanceDay(): Promise<AdvanceDayResult>;
}

export class WorldSimulation implements SimulationModule {
  constructor(private readonly store: SimulationStateStore) {}

  async getWorldState(): Promise<StoredWorldState> {
    const [marketplace, simulation] = await Promise.all([
      this.store.getMarketplaceState(),
      this.store.getSimulationState()
    ]);

    return {
      marketplace,
      simulation
    };
  }

  async getCurrentDay(): Promise<SimulationDay> {
    return (await this.store.getSimulationState()).current_day;
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

  async advanceDay(): Promise<AdvanceDayResult> {
    const world = await this.getWorldState();
    const result = resolveAdvanceDay(world);
    const persistedWorld = await this.store.replaceWorldState(result.world);

    return {
      ...result,
      world: persistedWorld
    };
  }
}

export function createWorldSimulation(store: SimulationStateStore): SimulationModule {
  return new WorldSimulation(store);
}
