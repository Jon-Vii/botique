import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  ChartLineUp,
  CurrencyDollar,
  Lightning,
  ListChecks,
  Star,
  Terminal,
  Trophy,
  Wrench,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BackendNotice } from "../components/BackendNotice";
import { BalanceTimeline } from "../components/BalanceTimeline";
import { MODEL_COLORS } from "../components/balance-timeline-models";
import type { ModelCurve } from "../components/balance-timeline-models";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  useRunList,
  useRunManifests,
  useRunSummaries,
  useRunDaySnapshotsBatch,
} from "../hooks/useApi";
import { formatCurrency } from "../lib/format";
import { getRunIdentity } from "../lib/run-identity";
import type { DaySnapshot, RunManifest, RunSummary } from "../types/api";

/* ── Aggregation types ── */

type ModelAggregate = {
  model: string;
  provider: string | null;
  runs: RunSummary[];
  avgBalance: number;
  avgDelta: number;
  avgSales: number;
  avgReviewScore: number;
  avgToolCalls: number;
  avgTurns: number;
  totalToolCalls: number;
};

/* ── Aggregation helper ── */

function resolveModel(
  s: RunSummary,
  manifestsByRunId: Map<string, RunManifest>,
): { model: string; provider: string | null } {
  const identity = getRunIdentity({
    summary: s,
    manifest: manifestsByRunId.get(s.run_id),
  });
  return {
    model: identity?.model ?? "unknown",
    provider: identity?.provider ?? null,
  };
}

function aggregateByModel(
  summaries: RunSummary[],
  manifestsByRunId: Map<string, RunManifest>,
): ModelAggregate[] {
  const groups = new Map<
    string,
    { provider: string | null; runs: RunSummary[] }
  >();

  for (const s of summaries) {
    const { model, provider } = resolveModel(s, manifestsByRunId);
    const existing = groups.get(model);
    if (existing) {
      existing.runs.push(s);
    } else {
      groups.set(model, { provider, runs: [s] });
    }
  }

  const aggregates: ModelAggregate[] = [];

  for (const [model, { provider, runs }] of groups) {
    const n = runs.length;
    const avgBalance =
      runs.reduce((sum, r) => sum + r.ending_state.available_balance, 0) / n;
    const avgDelta =
      runs.reduce(
        (sum, r) =>
          sum +
          (r.ending_state.available_balance -
            r.starting_state.available_balance),
        0,
      ) / n;
    const avgSales =
      runs.reduce((sum, r) => sum + r.ending_state.total_sales_count, 0) / n;
    const avgReviewScore =
      runs.reduce((sum, r) => sum + r.ending_state.review_average, 0) / n;
    const totalToolCalls = runs.reduce(
      (sum, r) => sum + r.totals.tool_call_count,
      0,
    );
    const avgToolCalls = totalToolCalls / n;
    const avgTurns =
      runs.reduce((sum, r) => sum + r.totals.turn_count, 0) / n;

    aggregates.push({
      model,
      provider,
      runs,
      avgBalance,
      avgDelta,
      avgSales,
      avgReviewScore,
      avgToolCalls,
      avgTurns,
      totalToolCalls,
    });
  }

  aggregates.sort((a, b) => b.avgBalance - a.avgBalance);
  return aggregates;
}

/* ── Timeline chart builder ── */

function buildModelCurves(
  summaries: RunSummary[],
  manifestsByRunId: Map<string, RunManifest>,
  daysByRunId: Map<string, DaySnapshot[]>,
): ModelCurve[] {
  // Group runs by model
  const groups = new Map<
    string,
    { runIds: string[]; dayArrays: DaySnapshot[][] }
  >();

  for (const s of summaries) {
    const { model } = resolveModel(s, manifestsByRunId);
    const days = daysByRunId.get(s.run_id);
    if (!days || days.length === 0) continue;

    const existing = groups.get(model);
    if (existing) {
      existing.runIds.push(s.run_id);
      existing.dayArrays.push(days);
    } else {
      groups.set(model, { runIds: [s.run_id], dayArrays: [days] });
    }
  }

  const models = [...groups.keys()].sort();
  return models.map((model, i) => {
    const { runIds, dayArrays } = groups.get(model)!;
    const color = MODEL_COLORS[i % MODEL_COLORS.length];

    // Build individual run curves
    const runCurves = runIds.map((runId, ri) => ({
      runId,
      points: dayArrays[ri]
        .slice()
        .sort((a, b) => a.day - b.day)
        .map((d) => ({ day: d.day, balance: d.available_balance })),
    }));

    // Build averaged curve: for each day index, average across all runs that have it
    const maxDay = Math.max(...dayArrays.map((d) => d.length));
    const points: { day: number; balance: number }[] = [];

    for (let di = 0; di < maxDay; di++) {
      let sum = 0;
      let count = 0;
      for (const days of dayArrays) {
        const sorted = days.slice().sort((a, b) => a.day - b.day);
        if (di < sorted.length) {
          sum += sorted[di].available_balance;
          count++;
        }
      }
      if (count > 0) {
        // Use the actual day number from first run that has this index
        const refSorted = dayArrays[0].slice().sort((a, b) => a.day - b.day);
        const dayNum = di < refSorted.length ? refSorted[di].day : di + 1;
        points.push({ day: dayNum, balance: sum / count });
      }
    }

    return { model, color, points, runCurves };
  });
}

/* ── Stat cell ── */

function StatCell({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div
        className={`num text-sm font-bold ${highlight ? "text-orange" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Model card ── */

function ModelCard({
  aggregate,
  isBest,
}: {
  aggregate: ModelAggregate;
  isBest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { avgDelta } = aggregate;

  return (
    <div
      className={`tech-card overflow-hidden transition-shadow ${
        isBest ? "ring-1 ring-emerald/30" : ""
      }`}
    >
      {/* Card header */}
      <div className="px-5 py-4 border-b border-rule">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-mono text-base font-bold text-ink">
              {aggregate.model}
            </h3>
            {aggregate.provider && (
              <Badge variant="violet" subtle>
                {aggregate.provider}
              </Badge>
            )}
            {isBest && (
              <Badge
                variant="emerald"
                subtle
                icon={<Trophy size={9} weight="fill" />}
              >
                Best
              </Badge>
            )}
          </div>
          <Badge variant="gray" subtle>
            {aggregate.runs.length} run
            {aggregate.runs.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Stat grid */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
          <StatCell
            label="Avg Balance"
            value={formatCurrency(aggregate.avgBalance)}
            icon={<CurrencyDollar size={10} weight="duotone" />}
            highlight
          />
          <StatCell
            label="Avg Delta"
            value={`${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(2)}`}
            icon={
              avgDelta >= 0 ? (
                <ArrowUp size={10} weight="bold" className="text-emerald" />
              ) : (
                <ArrowDown size={10} weight="bold" className="text-rose" />
              )
            }
          />
          <StatCell
            label="Avg Sales"
            value={aggregate.avgSales.toFixed(1)}
            icon={<ListChecks size={10} weight="duotone" />}
          />
          <StatCell
            label="Avg Reviews"
            value={`${aggregate.avgReviewScore.toFixed(2)} ★`}
            icon={<Star size={10} weight="fill" className="text-amber" />}
          />
          <StatCell
            label="Avg Tool Calls"
            value={aggregate.avgToolCalls.toFixed(0)}
            icon={<Wrench size={10} weight="duotone" />}
          />
          <StatCell
            label="Avg Turns"
            value={aggregate.avgTurns.toFixed(1)}
            icon={<ChartLineUp size={10} weight="duotone" />}
          />
        </div>
      </div>

      {/* Expand / collapse individual runs */}
      <div className="border-t border-rule">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-mono text-muted hover:text-secondary transition-colors"
        >
          <span>{expanded ? "Hide" : "Show"} individual runs</span>
          <CaretDown
            size={12}
            weight="bold"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && (
          <div className="px-5 pb-4 animate-card-in">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  <th className="text-left pb-2 font-semibold">Run ID</th>
                  <th className="text-right pb-2 font-semibold">Days</th>
                  <th className="text-right pb-2 font-semibold">Balance</th>
                  <th className="text-right pb-2 font-semibold">Delta</th>
                  <th className="text-right pb-2 font-semibold">Sales</th>
                  <th className="text-right pb-2 font-semibold">Reviews</th>
                  <th className="text-right pb-2 font-semibold">Turns</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.runs.map((r) => {
                  const delta =
                    r.ending_state.available_balance -
                    r.starting_state.available_balance;
                  return (
                    <tr key={r.run_id} className="border-t border-rule/50">
                      <td className="py-1.5">
                        <Link
                          to={`/runs/${encodeURIComponent(r.run_id)}`}
                          className="font-mono font-medium text-ink hover:text-orange transition-colors"
                        >
                          {r.run_id}
                        </Link>
                      </td>
                      <td className="text-right num text-secondary py-1.5">
                        {r.day_count}
                      </td>
                      <td className="text-right num font-semibold text-orange py-1.5">
                        {formatCurrency(r.ending_state.available_balance)}
                      </td>
                      <td className="text-right py-1.5">
                        <span
                          className={`num font-semibold ${delta >= 0 ? "text-emerald" : "text-rose"}`}
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-right num text-secondary py-1.5">
                        {r.ending_state.total_sales_count}
                      </td>
                      <td className="text-right num text-secondary py-1.5">
                        {r.ending_state.review_average.toFixed(1)}
                      </td>
                      <td className="text-right num text-secondary py-1.5">
                        {r.totals.turn_count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */

export function Benchmarks() {
  const {
    data: runList,
    isLoading: listLoading,
    error: listError,
  } = useRunList();
  const runIds = useMemo(() => (runList ?? []).map((r) => r.run_id), [runList]);
  const summaryResults = useRunSummaries(runIds);
  const manifestResults = useRunManifests(runIds);
  const daySnapshotResults = useRunDaySnapshotsBatch(runIds);

  const summaries = useMemo(() => {
    const loaded: RunSummary[] = [];
    for (const result of summaryResults) {
      if (result.data) loaded.push(result.data);
    }
    return loaded;
  }, [summaryResults]);

  const manifestsByRunId = useMemo(() => {
    const loaded = new Map<string, RunManifest>();
    for (const result of manifestResults) {
      if (result.data) {
        loaded.set(result.data.run_id, result.data);
      }
    }
    return loaded;
  }, [manifestResults]);

  const daysByRunId = useMemo(() => {
    const loaded = new Map<string, DaySnapshot[]>();
    for (let i = 0; i < runIds.length; i++) {
      const result = daySnapshotResults[i];
      if (result?.data) {
        loaded.set(runIds[i], result.data);
      }
    }
    return loaded;
  }, [runIds, daySnapshotResults]);

  const modelAggregates = useMemo(
    () => aggregateByModel(summaries, manifestsByRunId),
    [summaries, manifestsByRunId],
  );

  const modelCurves = useMemo(
    () => buildModelCurves(summaries, manifestsByRunId, daysByRunId),
    [summaries, manifestsByRunId, daysByRunId],
  );

  const bestModel =
    modelAggregates.length > 0 ? modelAggregates[0].model : null;

  const isLoading = listLoading || summaryResults.some((r) => r.isLoading);
  const daysLoading = daySnapshotResults.some((r) => r.isLoading);
  const listErrorMessage =
    listError instanceof Error ? listError.message : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="tech-card relative overflow-hidden px-8 py-8">
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={14} weight="fill" className="text-orange" />
            <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
              Benchmark Console
            </span>
          </div>
          <h1 className="text-3xl font-bold text-ink leading-tight tracking-tight">
            Model{" "}
            <span className="font-pixel text-orange">Benchmarks</span>
          </h1>
          <p className="mt-3 text-secondary text-[14px] leading-relaxed max-w-2xl">
            Aggregated performance comparison across models. Metrics are
            averaged over all completed runs for each model to reveal which
            configuration performs best.
          </p>
          <div className="absolute top-0 right-0 opacity-[0.06]">
            <ChartLineUp size={120} weight="thin" className="text-orange" />
          </div>

          {/* Quick stats */}
          {summaries.length > 0 && (
            <div className="mt-5 flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2 text-secondary">
                <span className="w-7 h-7 bg-orange-1 flex items-center justify-center border border-orange-4">
                  <ListChecks
                    size={14}
                    weight="duotone"
                    className="text-orange"
                  />
                </span>
                <strong className="num text-ink">{summaries.length}</strong>
                <span className="text-muted text-xs">runs</span>
              </span>
              <span className="flex items-center gap-2 text-secondary">
                <span className="w-7 h-7 bg-violet-dim flex items-center justify-center border border-violet/15">
                  <ChartLineUp
                    size={14}
                    weight="duotone"
                    className="text-violet"
                  />
                </span>
                <strong className="num text-ink">
                  {modelAggregates.length}
                </strong>
                <span className="text-muted text-xs">models</span>
              </span>
              {bestModel && (
                <span className="flex items-center gap-2 text-secondary">
                  <span className="w-7 h-7 bg-emerald-dim flex items-center justify-center border border-emerald/15">
                    <Trophy
                      size={14}
                      weight="duotone"
                      className="text-emerald"
                    />
                  </span>
                  <strong className="font-mono text-xs text-ink">
                    {bestModel}
                  </strong>
                  <span className="text-muted text-xs">top model</span>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Balance timeline chart */}
      {!listError && modelCurves.length > 0 && (
        <section className="tech-card overflow-hidden">
          <div className="px-5 py-3 border-b border-rule flex items-center gap-2">
            <ChartLineUp size={14} weight="duotone" className="text-orange" />
            <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
              Balance Over Time
            </span>
            {daysLoading && (
              <span className="text-[10px] font-mono text-muted ml-auto">
                loading day data...
              </span>
            )}
          </div>
          <div className="px-5 py-4">
            <BalanceTimeline curves={modelCurves} />
          </div>
        </section>
      )}

      {/* Skeleton for chart while loading */}
      {!listError && isLoading && modelCurves.length === 0 && summaries.length > 0 && (
        <div className="tech-card p-6">
          <Skeleton className="h-[280px] w-full" />
        </div>
      )}

      {/* Model comparison cards */}
      {listError ? (
        <BackendNotice
          title="Benchmark data could not be loaded"
          description={
            listErrorMessage
              ? `The benchmark console could not read run artifacts from the control surface. ${listErrorMessage}`
              : "The benchmark console could not read run artifacts from the control surface. The request failed or the returned data was invalid."
          }
          endpoints={[
            "GET /control/runs",
            "GET /control/runs/:runId/summary",
          ]}
          badgeLabel="Load Failure"
        />
      ) : isLoading && summaries.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="tech-card p-6 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="tech-card p-6 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      ) : modelAggregates.length === 0 ? (
        <div className="tech-card p-8">
          <EmptyState
            icon={<Lightning size={48} weight="duotone" />}
            title="No runs yet"
            description="Complete a simulation run to see model benchmarks. Run data from summary.json artifacts will populate the comparison cards."
          />
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modelAggregates.map((agg) => (
            <ModelCard
              key={agg.model}
              aggregate={agg}
              isBest={agg.model === bestModel && modelAggregates.length > 1}
            />
          ))}
        </section>
      )}

      {/* Footer */}
      <section className="tech-card px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">
            Benchmark data sources
          </h2>
          <Badge variant="gray" subtle>
            Read Only
          </Badge>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-secondary">
          Benchmarks read persisted run artifacts from the control surface. The
          page does not mutate runs; it only aggregates summaries, manifests,
          and per-day snapshots for comparison.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "GET /control/runs",
            "GET /control/runs/:runId/summary",
            "GET /control/runs/:runId/manifest",
            "GET /control/runs/:runId/days",
          ].map((endpoint) => (
            <code
              key={endpoint}
              className="rounded-[var(--radius-sm)] bg-gray-2 px-2 py-1 font-mono text-[11px] text-secondary"
            >
              {endpoint}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
}
