import type {
  DaySnapshot,
  Listing,
  MarketSnapshot,
  Order,
  PaginatedResults,
  Review,
  RunListEntry,
  RunManifest,
  RunSummary,
  Shop,
  SimulationDay,
  TaxonomyNode,
  TournamentListItem,
  TournamentResult,
  TrendState,
  WorldState,
} from "../types/api";

const BASE = "/v3/application";
const CONTROL = "/control";

async function fetchJSON<T>(path: string, base = BASE): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.error?.message ?? `API error: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
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
    return fetchJSON(`/listings/active${qs ? `?${qs}` : ""}`);
  },

  getListing(listingId: number): Promise<Listing> {
    return fetchJSON(`/listings/${listingId}`);
  },

  getShop(shopId: number): Promise<Shop> {
    return fetchJSON(`/shops/${shopId}`);
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
    return fetchJSON(`/shops/${shopId}/listings${qs ? `?${qs}` : ""}`);
  },

  getShopReviews(
    shopId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<PaginatedResults<Review>> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return fetchJSON(`/shops/${shopId}/reviews${qs ? `?${qs}` : ""}`);
  },

  getShopReceipts(
    shopId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<PaginatedResults<Order>> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return fetchJSON(`/shops/${shopId}/receipts${qs ? `?${qs}` : ""}`);
  },

  getTaxonomyNodes(
    taxonomyId?: number
  ): Promise<PaginatedResults<TaxonomyNode>> {
    const search = new URLSearchParams();
    if (taxonomyId) search.set("taxonomy_id", String(taxonomyId));
    const qs = search.toString();
    return fetchJSON(`/seller-taxonomy/nodes${qs ? `?${qs}` : ""}`);
  },

  /* ── Control / Simulation ── */

  getSimulationDay(): Promise<SimulationDay> {
    return fetchJSON<SimulationDay>("/simulation/day", CONTROL);
  },

  getMarketSnapshot(): Promise<MarketSnapshot> {
    return fetchJSON<MarketSnapshot>("/simulation/market-snapshot", CONTROL);
  },

  getTrendState(): Promise<TrendState> {
    return fetchJSON<TrendState>("/simulation/trend-state", CONTROL);
  },

  getWorldState(): Promise<WorldState> {
    return fetchJSON<WorldState>("/world-state", CONTROL);
  },

  async advanceDay(): Promise<unknown> {
    const res = await fetch(`${CONTROL}/simulation/advance-day`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Advance day failed: ${res.status}`);
    return res.json();
  },

  /* ── Benchmark / Runs ──
   * NOTE: Backend endpoints under /control/runs/... do not exist yet.
   * These methods define the expected contract. The backend needs to:
   *   GET /control/runs              -> RunListEntry[]
   *   GET /control/runs/:runId/summary   -> RunSummary
   *   GET /control/runs/:runId/manifest  -> RunManifest
   *   GET /control/runs/:runId/days      -> DaySnapshot[]
   */

  getRunList(): Promise<RunListEntry[]> {
    return fetchJSON<RunListEntry[]>("/runs", CONTROL);
  },

  getRunSummary(runId: string): Promise<RunSummary> {
    return fetchJSON<RunSummary>(`/runs/${encodeURIComponent(runId)}/summary`, CONTROL);
  },

  getRunManifest(runId: string): Promise<RunManifest> {
    return fetchJSON<RunManifest>(`/runs/${encodeURIComponent(runId)}/manifest`, CONTROL);
  },

  getRunDaySnapshots(runId: string): Promise<DaySnapshot[]> {
    return fetchJSON<DaySnapshot[]>(`/runs/${encodeURIComponent(runId)}/days`, CONTROL);
  },

  /* ── Run Day Details ──
   * NOTE: Backend endpoints for per-day detail do not exist yet.
   * Expected contract:
   *   GET /control/runs/:runId/days/:day/briefing -> briefing JSON
   *   GET /control/runs/:runId/days/:day/turns    -> turn records array
   *   GET /control/runs/:runId/memory/notes       -> memory notes array
   *   GET /control/runs/:runId/memory/reminders   -> memory reminders array
   */

  getRunDayBriefing(runId: string, day: number): Promise<unknown> {
    return fetchJSON(`/runs/${encodeURIComponent(runId)}/days/${day}/briefing`, CONTROL);
  },

  getRunDayTurns(runId: string, day: number): Promise<unknown[]> {
    return fetchJSON(`/runs/${encodeURIComponent(runId)}/days/${day}/turns`, CONTROL);
  },

  getRunMemoryNotes(runId: string): Promise<unknown[]> {
    return fetchJSON(`/runs/${encodeURIComponent(runId)}/memory/notes`, CONTROL);
  },

  getRunMemoryReminders(runId: string): Promise<unknown[]> {
    return fetchJSON(`/runs/${encodeURIComponent(runId)}/memory/reminders`, CONTROL);
  },

  /* ── Tournaments ──
   * NOTE: Backend endpoints under /control/tournaments/... do not exist yet.
   * These methods define the expected contract. The backend needs to:
   *   GET /control/tournaments                    -> TournamentListItem[]
   *   GET /control/tournaments/:tournamentId      -> TournamentResult
   */

  getTournamentList(): Promise<TournamentListItem[]> {
    return fetchJSON<TournamentListItem[]>("/tournaments", CONTROL);
  },

  getTournamentResult(tournamentId: string): Promise<TournamentResult> {
    return fetchJSON<TournamentResult>(`/tournaments/${encodeURIComponent(tournamentId)}`, CONTROL);
  },

  /* ── Operator Controls ── */

  async resetWorld(): Promise<unknown> {
    const res = await fetch(`${CONTROL}/world/reset`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`World reset failed: ${res.status}`);
    return res.json();
  },

  /** NOTE: POST /control/runs/launch does NOT exist yet on the backend */
  async launchRun(payload: {
    shop_id: number;
    days: number;
    turns_per_day: number;
    run_id: string;
    model: string;
    provider: string;
  }): Promise<{ run_id: string }> {
    const res = await fetch(`${CONTROL}/runs/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Run launch failed: ${res.status}`);
    return res.json();
  },

  /** NOTE: POST /control/tournaments/launch does NOT exist yet on the backend */
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
  }): Promise<{ tournament_id: string }> {
    const res = await fetch(`${CONTROL}/tournaments/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Tournament launch failed: ${res.status}`);
    return res.json();
  },
};
