import type {
  DayBriefing,
  DaySnapshot,
  Listing,
  MemoryNote,
  MemoryReminder,
  MarketSnapshot,
  Order,
  PaginatedResults,
  Review,
  RunListEntry,
  RunManifest,
  RunProgress,
  RunSummary,
  Shop,
  SimulationDay,
  TaxonomyNode,
  TournamentListItem,
  TournamentResult,
  TrendState,
  TurnRecord,
  Workspace,
  WorkspaceRevision,
  WorldState,
} from "../types/api";

const BASE = "/v3/application";
const CONTROL = "/control";

export class ApiError extends Error {
  status: number;
  base: string;
  path: string;
  body: unknown;

  constructor(message: string, options: {
    status: number;
    base: string;
    path: string;
    body: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.base = options.base;
    this.path = options.path;
    this.body = options.body;
  }
}

export function isApiErrorStatus(
  error: unknown,
  statuses: number | number[],
): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  const allowed = Array.isArray(statuses) ? statuses : [statuses];
  return allowed.includes(error.status);
}

async function requestJSON<T>(
  path: string,
  options?: {
    base?: string;
    init?: RequestInit;
  },
): Promise<T> {
  const base = options?.base ?? BASE;
  const res = await fetch(`${base}${path}`, options?.init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.error?.message ?? `API error: ${res.status} ${res.statusText}`,
      {
        status: res.status,
        base,
        path,
        body,
      },
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  getActiveListings(params?: {
    keywords?: string;
    sort_on?: string;
    sort_order?: string;
    limit?: number;
    offset?: number;
    taxonomy_id?: number;
  }): Promise<PaginatedResults<Listing>> {
    const search = new URLSearchParams();
    if (params?.keywords) search.set("keywords", params.keywords);
    if (params?.sort_on) search.set("sort_on", params.sort_on);
    if (params?.sort_order) search.set("sort_order", params.sort_order);
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    if (params?.taxonomy_id)
      search.set("taxonomy_id", String(params.taxonomy_id));
    const qs = search.toString();
    return requestJSON(`/listings/active${qs ? `?${qs}` : ""}`);
  },

  getListing(listingId: number): Promise<Listing> {
    return requestJSON(`/listings/${listingId}`);
  },

  getShop(shopId: number): Promise<Shop> {
    return requestJSON(`/shops/${shopId}`);
  },

  getShopListings(
    shopId: number,
    params?: { state?: string; limit?: number; offset?: number }
  ): Promise<PaginatedResults<Listing>> {
    const search = new URLSearchParams();
    if (params?.state) search.set("state", params.state);
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return requestJSON(`/shops/${shopId}/listings${qs ? `?${qs}` : ""}`);
  },

  getShopReviews(
    shopId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<PaginatedResults<Review>> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return requestJSON(`/shops/${shopId}/reviews${qs ? `?${qs}` : ""}`);
  },

  getShopReceipts(
    shopId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<PaginatedResults<Order>> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return requestJSON(`/shops/${shopId}/receipts${qs ? `?${qs}` : ""}`);
  },

  getTaxonomyNodes(
    taxonomyId?: number
  ): Promise<PaginatedResults<TaxonomyNode>> {
    const search = new URLSearchParams();
    if (taxonomyId) search.set("taxonomy_id", String(taxonomyId));
    const qs = search.toString();
    return requestJSON(`/seller-taxonomy/nodes${qs ? `?${qs}` : ""}`);
  },

  /* ── Control / Simulation ── */

  getSimulationDay(): Promise<SimulationDay> {
    return requestJSON<SimulationDay>("/simulation/day", { base: CONTROL });
  },

  getMarketSnapshot(): Promise<MarketSnapshot> {
    return requestJSON<MarketSnapshot>("/simulation/market-snapshot", {
      base: CONTROL,
    });
  },

  getTrendState(): Promise<TrendState> {
    return requestJSON<TrendState>("/simulation/trend-state", { base: CONTROL });
  },

  getWorldState(): Promise<WorldState> {
    return requestJSON<WorldState>("/world-state", { base: CONTROL });
  },

  async advanceDay(): Promise<unknown> {
    return requestJSON("/simulation/advance-day", {
      base: CONTROL,
      init: { method: "POST" },
    });
  },

  /* ── Benchmark / Runs ── */

  getRunList(): Promise<RunListEntry[]> {
    return requestJSON<RunListEntry[]>("/runs", { base: CONTROL });
  },

  getRunSummary(runId: string): Promise<RunSummary> {
    return requestJSON<RunSummary>(
      `/runs/${encodeURIComponent(runId)}/summary`,
      { base: CONTROL },
    );
  },

  getRunManifest(runId: string): Promise<RunManifest> {
    return requestJSON<RunManifest>(
      `/runs/${encodeURIComponent(runId)}/manifest`,
      { base: CONTROL },
    );
  },

  getRunDaySnapshots(runId: string): Promise<DaySnapshot[]> {
    return requestJSON<DaySnapshot[]>(
      `/runs/${encodeURIComponent(runId)}/days`,
      { base: CONTROL },
    );
  },

  /* ── Run Day Details ── */

  getRunDayBriefing(runId: string, day: number): Promise<DayBriefing> {
    return requestJSON<DayBriefing>(
      `/runs/${encodeURIComponent(runId)}/days/${day}/briefing`,
      { base: CONTROL },
    );
  },

  getRunDayTurns(runId: string, day: number): Promise<TurnRecord[]> {
    return requestJSON<TurnRecord[]>(
      `/runs/${encodeURIComponent(runId)}/days/${day}/turns`,
      { base: CONTROL },
    );
  },

  getRunMemoryNotes(runId: string): Promise<MemoryNote[]> {
    return requestJSON<MemoryNote[]>(
      `/runs/${encodeURIComponent(runId)}/memory/notes`,
      { base: CONTROL },
    );
  },

  getRunMemoryReminders(runId: string): Promise<MemoryReminder[]> {
    return requestJSON<MemoryReminder[]>(
      `/runs/${encodeURIComponent(runId)}/memory/reminders`,
      { base: CONTROL },
    );
  },

  getRunWorkspace(runId: string): Promise<Workspace> {
    return requestJSON<Workspace>(
      `/runs/${encodeURIComponent(runId)}/memory/workspace`,
      { base: CONTROL },
    );
  },

  getRunWorkspaceRevisions(runId: string): Promise<WorkspaceRevision[]> {
    return requestJSON<WorkspaceRevision[]>(
      `/runs/${encodeURIComponent(runId)}/memory/workspace/revisions`,
      { base: CONTROL },
    );
  },

  /* ── Tournaments ── */

  getTournamentList(): Promise<TournamentListItem[]> {
    return requestJSON<TournamentListItem[]>("/tournaments", { base: CONTROL });
  },

  getTournamentResult(tournamentId: string): Promise<TournamentResult> {
    return requestJSON<TournamentResult>(
      `/tournaments/${encodeURIComponent(tournamentId)}`,
      { base: CONTROL },
    );
  },

  /* ── Operator Controls ── */

  async resetWorld(): Promise<unknown> {
    return requestJSON("/world/reset", {
      base: CONTROL,
      init: { method: "POST" },
    });
  },

  async launchRun(payload: {
    shop_id: number;
    days: number;
    turns_per_day: number;
    run_id: string;
    model: string;
    provider: string;
    scenario_id: "operate" | "bootstrap";
    api_key?: string;
  }): Promise<{ run_id: string }> {
    return requestJSON<{ run_id: string }>("/runs/launch", {
      base: CONTROL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    });
  },

  async simulateRun(payload: {
    shop_id: number;
    days: number;
    scenario_id?: "operate" | "bootstrap";
  }): Promise<{ run_id: string }> {
    return requestJSON<{ run_id: string }>("/runs/simulate", {
      base: CONTROL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    });
  },

  getRunProgress(runId: string): Promise<RunProgress> {
    return requestJSON<RunProgress>(
      `/runs/${encodeURIComponent(runId)}/progress`,
      { base: CONTROL },
    );
  },

  getRunStatus(runId: string): Promise<{ run_id: string; status: string }> {
    return requestJSON<{ run_id: string; status: string }>(
      `/runs/${encodeURIComponent(runId)}/status`,
      { base: CONTROL },
    );
  },

  async launchTournament(payload: {
    entrants: {
      entrant_id: string;
      display_name: string;
      provider: string;
      model: string;
    }[];
    shop_ids: number[];
    days_per_round: number;
    rounds: number;
    turns_per_day: number;
    scenario_id?: "operate" | "bootstrap";
    run_id?: string;
    api_key?: string;
  }): Promise<{ tournament_id: string }> {
    return requestJSON<{ tournament_id: string }>("/tournaments/launch", {
      base: CONTROL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    });
  },
};
