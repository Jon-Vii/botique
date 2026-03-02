import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
    enabled: Number.isInteger(listingId) && listingId > 0,
  });
}

export function useShop(shopId: number) {
  return useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => api.getShop(shopId),
    enabled: Number.isInteger(shopId) && shopId > 0,
  });
}

export function useShopListings(shopId: number, params?: Parameters<typeof api.getShopListings>[1]) {
  return useQuery({
    queryKey: ["shop", shopId, "listings", params],
    queryFn: () => api.getShopListings(shopId, params),
    enabled: Number.isInteger(shopId) && shopId > 0,
  });
}

export function useShopReviews(shopId: number, params?: Parameters<typeof api.getShopReviews>[1]) {
  return useQuery({
    queryKey: ["shop", shopId, "reviews", params],
    queryFn: () => api.getShopReviews(shopId, params),
    enabled: Number.isInteger(shopId) && shopId > 0,
  });
}

export function useShopReceipts(shopId: number, params?: Parameters<typeof api.getShopReceipts>[1]) {
  return useQuery({
    queryKey: ["shop", shopId, "receipts", params],
    queryFn: () => api.getShopReceipts(shopId, params),
    enabled: Number.isInteger(shopId) && shopId > 0,
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
    refetchInterval: 30_000,
  });
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: ["simulation", "market-snapshot"],
    queryFn: () => api.getMarketSnapshot(),
    refetchInterval: 30_000,
  });
}

export function useTrendState() {
  return useQuery({
    queryKey: ["simulation", "trend-state"],
    queryFn: () => api.getTrendState(),
    refetchInterval: 30_000,
  });
}

export function useWorldState() {
  return useQuery({
    queryKey: ["world-state"],
    queryFn: () => api.getWorldState(),
    refetchInterval: 30_000,
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

/* ── Run Explorer ── */

export function useRunList() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: () => api.getRunList(),
    refetchInterval: 10_000,
  });
}

export function useRunProgress(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "progress"],
    queryFn: () => api.getRunProgress(runId),
    enabled: !!runId,
    refetchInterval: 2000,
    retry: false,
  });
}

export function useRunStatus(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "status"],
    queryFn: () => api.getRunStatus(runId),
    enabled: !!runId,
    refetchInterval: 5000,
    retry: false,
  });
}

export function useRunSummary(runId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["runs", runId, "summary"],
    queryFn: () => api.getRunSummary(runId),
    enabled: !!runId,
    retry: false,
    refetchInterval: options?.refetchInterval,
  });
}

export function useRunSummaries(runIds: string[]) {
  return useQueries({
    queries: runIds.map((runId) => ({
      queryKey: ["runs", runId, "summary"],
      queryFn: () => api.getRunSummary(runId),
      enabled: !!runId,
    })),
  });
}

export function useRunManifests(runIds: string[]) {
  return useQueries({
    queries: runIds.map((runId) => ({
      queryKey: ["runs", runId, "manifest"],
      queryFn: () => api.getRunManifest(runId),
      enabled: !!runId,
    })),
  });
}

export function useRunManifest(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "manifest"],
    queryFn: () => api.getRunManifest(runId),
    enabled: !!runId,
  });
}

export function useRunDaySnapshots(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "days"],
    queryFn: () => api.getRunDaySnapshots(runId),
    enabled: !!runId,
  });
}

export function useRunDaySnapshotsBatch(runIds: string[]) {
  return useQueries({
    queries: runIds.map((runId) => ({
      queryKey: ["runs", runId, "days"],
      queryFn: () => api.getRunDaySnapshots(runId),
      enabled: !!runId,
    })),
  });
}

export function useRunDayBriefing(runId: string, day: number) {
  return useQuery({
    queryKey: ["runs", runId, "day", day, "briefing"],
    queryFn: () => api.getRunDayBriefing(runId, day),
    enabled: !!runId && day > 0,
  });
}

export function useRunDayTurns(runId: string, day: number) {
  return useQuery({
    queryKey: ["runs", runId, "day", day, "turns"],
    queryFn: () => api.getRunDayTurns(runId, day),
    enabled: !!runId && day > 0,
  });
}

export function useRunMemoryNotes(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "memory", "notes"],
    queryFn: () => api.getRunMemoryNotes(runId),
    enabled: !!runId,
  });
}

export function useRunMemoryReminders(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "memory", "reminders"],
    queryFn: () => api.getRunMemoryReminders(runId),
    enabled: !!runId,
  });
}

export function useRunWorkspace(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "memory", "workspace"],
    queryFn: () => api.getRunWorkspace(runId),
    enabled: !!runId,
  });
}

export function useRunWorkspaceRevisions(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "memory", "workspace", "revisions"],
    queryFn: () => api.getRunWorkspaceRevisions(runId),
    enabled: !!runId,
  });
}

/* ── Tournaments ── */

export function useTournamentList() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: () => api.getTournamentList(),
  });
}

export function useTournamentResult(tournamentId: string) {
  return useQuery({
    queryKey: ["tournaments", tournamentId],
    queryFn: () => api.getTournamentResult(tournamentId),
    enabled: !!tournamentId,
  });
}

/* ── Operator Controls ── */

export function useResetWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetWorld(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation"] });
      qc.invalidateQueries({ queryKey: ["world-state"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["shop"] });
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useLaunchRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.launchRun>[0]) =>
      api.launchRun(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useSimulateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.simulateRun>[0]) =>
      api.simulateRun(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["simulation"] });
      qc.invalidateQueries({ queryKey: ["world-state"] });
    },
  });
}

export function useLaunchTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.launchTournament>[0]) =>
      api.launchTournament(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}
