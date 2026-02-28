import { resolveMarketplaceDay } from "./day-resolution";
import { buildMarketSnapshot, buildTrendState, nextSimulationDay } from "./state";
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
  getSimulationState(): Promise<SimulationState>;
  setSimulationState(state: SimulationState): Promise<SimulationState>;
  setWorldState(state: StoredWorldState): Promise<StoredWorldState>;
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
    const advancedAt = new Date().toISOString();
    const nextDay = nextSimulationDay(world.simulation.current_day, advancedAt);
    const resolution = resolveMarketplaceDay({
      marketplace: world.marketplace,
      currentDay: world.simulation.current_day,
      nextDay,
      trendState: world.simulation.trend_state,
      pendingEvents: world.simulation.pending_events,
      advancedAt
    });
    const nextTrendState = buildTrendState(resolution.marketplace, nextDay, advancedAt);
    const nextMarketSnapshot = buildMarketSnapshot(resolution.marketplace, nextTrendState, advancedAt);
    const nextWorld = await this.store.setWorldState({
      marketplace: resolution.marketplace,
      simulation: {
        current_day: nextDay,
        trend_state: nextTrendState,
        market_snapshot: nextMarketSnapshot,
        pending_events: resolution.pendingEvents,
        last_day_resolution: resolution.summary
      }
    });

    return {
      world: nextWorld,
      previous_day: world.simulation.current_day,
      current_day: nextWorld.simulation.current_day,
      steps: [
        {
          name: "resolve_listing_activity",
          description:
            "Resolve formula-driven listing traffic for the day that just ended, updating views, favorites, orders, and inventory."
        },
        {
          name: "settle_pending_events",
          description:
            "Apply any delayed world-owned events now due on the new day, including payment posting and queued review creation."
        },
        {
          name: "advance_clock",
          description:
            "Increment the simulation day and roll the world clock forward by one UTC day after resolving the prior day."
        },
        {
          name: "refresh_trends",
          description: "Rotate the active taxonomy-led trends using a deterministic day-based schedule."
        },
        {
          name: "refresh_market_snapshot",
          description: "Recompute inspectable market totals and per-taxonomy demand multipliers from the updated trend state."
        }
      ]
    };
  }
}

export function createWorldSimulation(store: SimulationStateStore): SimulationModule {
  return new WorldSimulation(store);
}
