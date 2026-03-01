import type {
  AdvanceDayResult,
  MarketSnapshot,
  SimulationDay,
  StoredWorldState,
  TrendState
} from "../simulation/state-types";
import type { AdvanceDayOptions, SimulationModule } from "../simulation/world-simulation";

export class RuntimeControlService {
  constructor(private readonly simulation: SimulationModule) {}

  async replaceWorldState(state: StoredWorldState): Promise<StoredWorldState> {
    return this.simulation.replaceWorldState(state);
  }

  async getCurrentDay(): Promise<SimulationDay> {
    return this.simulation.getCurrentDay();
  }

  async getMarketSnapshot(): Promise<MarketSnapshot> {
    return this.simulation.getMarketSnapshot();
  }

  async getTrendState(): Promise<TrendState> {
    return this.simulation.getTrendState();
  }

  async advanceDay(options: AdvanceDayOptions = {}): Promise<AdvanceDayResult> {
    return this.simulation.advanceDay(options);
  }

  async getWorldState(): Promise<StoredWorldState> {
    return this.simulation.getWorldState();
  }

  async resetWorld(): Promise<StoredWorldState> {
    return this.simulation.resetWorld();
  }
}
