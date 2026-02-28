import type {
  Listing,
  MarketSnapshot,
  Order,
  PaginatedResults,
  Review,
  Shop,
  SimulationDay,
  TaxonomyNode,
  TrendState,
  WorldState,
} from "../types/api";

const BASE = "/v3/application";
const CONTROL = "/control";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
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
    return fetchJSON<SimulationDay>(`${CONTROL}/simulation/day`);
  },

  getMarketSnapshot(): Promise<MarketSnapshot> {
    return fetchJSON<MarketSnapshot>(`${CONTROL}/simulation/market-snapshot`);
  },

  getTrendState(): Promise<TrendState> {
    return fetchJSON<TrendState>(`${CONTROL}/simulation/trend-state`);
  },

  getWorldState(): Promise<WorldState> {
    return fetchJSON<WorldState>(`${CONTROL}/world-state`);
  },

  async advanceDay(): Promise<unknown> {
    const res = await fetch(`${CONTROL}/simulation/advance-day`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Advance day failed: ${res.status}`);
    return res.json();
  },
};
