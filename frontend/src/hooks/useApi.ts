import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export function useActiveListings(params?: Parameters<typeof api.getActiveListings>[0]) {
  return useQuery({
    queryKey: ["listings", "active", params],
    queryFn: () => api.getActiveListings(params),
  });
}

export function useListing(listingId: number) {
  return useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => api.getListing(listingId),
  });
}

export function useShop(shopId: number) {
  return useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => api.getShop(shopId),
  });
}

export function useShopListings(shopId: number, params?: Parameters<typeof api.getShopListings>[1]) {
  return useQuery({
    queryKey: ["shop", shopId, "listings", params],
    queryFn: () => api.getShopListings(shopId, params),
  });
}

export function useShopReviews(shopId: number, params?: Parameters<typeof api.getShopReviews>[1]) {
  return useQuery({
    queryKey: ["shop", shopId, "reviews", params],
    queryFn: () => api.getShopReviews(shopId, params),
  });
}

export function useShopReceipts(shopId: number, params?: Parameters<typeof api.getShopReceipts>[1]) {
  return useQuery({
    queryKey: ["shop", shopId, "receipts", params],
    queryFn: () => api.getShopReceipts(shopId, params),
  });
}

export function useTaxonomyNodes(taxonomyId?: number) {
  return useQuery({
    queryKey: ["taxonomy", taxonomyId],
    queryFn: () => api.getTaxonomyNodes(taxonomyId),
  });
}

/* ── Control / Simulation ── */

export function useSimulationDay() {
  return useQuery({
    queryKey: ["simulation", "day"],
    queryFn: () => api.getSimulationDay(),
    refetchInterval: 5000,
  });
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: ["simulation", "market-snapshot"],
    queryFn: () => api.getMarketSnapshot(),
    refetchInterval: 5000,
  });
}

export function useTrendState() {
  return useQuery({
    queryKey: ["simulation", "trend-state"],
    queryFn: () => api.getTrendState(),
    refetchInterval: 5000,
  });
}

export function useWorldState() {
  return useQuery({
    queryKey: ["world-state"],
    queryFn: () => api.getWorldState(),
    refetchInterval: 5000,
  });
}

export function useAdvanceDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.advanceDay(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation"] });
      qc.invalidateQueries({ queryKey: ["world-state"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["shop"] });
    },
  });
}
