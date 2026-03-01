export type {
  DayBriefing,
  DaySnapshot,
  MemoryNote,
  MemoryReminder,
  RunManifest,
  RunSummary,
  ShopStateSnapshot,
  TurnRecord,
} from "./api";

import type { DaySnapshot, ShopStateSnapshot } from "./api";

export type RunDaySummary = DaySnapshot & {
  turn_count?: number;
  end_reason?: string;
  tool_calls?: string[];
  state_before?: ShopStateSnapshot;
  state_after?: ShopStateSnapshot;
  state_next_day?: DaySnapshot | null;
  yesterday_order_count?: number;
  yesterday_revenue?: number;
  objective_status?: string;
  advanced_to_day?: number | null;
};
