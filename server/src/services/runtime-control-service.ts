import type {
  AdvanceDayResult,
  MarketSnapshot,
  SimulationDay,
  StoredWorldState,
  TrendState
} from "../simulation/state-types";
import type { SimulationModule } from "../simulation/world-simulation";

export class RuntimeControlService {
  constructor(private readonly simulation: SimulationModule) {}

  async getCurrentDay(): Promise<SimulationDay> {
    return this.simulation.getCurrentDay();
  }

  async getMarketSnapshot(): Promise<MarketSnapshot> {
    return this.simulation.getMarketSnapshot();
  }

  async getTrendState(): Promise<TrendState> {
    return this.simulation.getTrendState();
  }

  async advanceDay(): Promise<AdvanceDayResult> {
    return this.simulation.advanceDay();
  }

  async getWorldState(): Promise<StoredWorldState> {
    return this.simulation.getWorldState();
  }

  async resetWorld(): Promise<StoredWorldState> {
    return this.simulation.resetWorld();
  }
}
