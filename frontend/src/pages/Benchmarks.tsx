import {
  ArrowDown,
  ArrowUp,
  ChartLineUp,
  ClipboardText,
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
import { Badge } from "../components/Badge";
import { ScenarioBadge } from "../components/ScenarioBadge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { useRunList, useRunManifests, useRunSummaries } from "../hooks/useApi";
import { formatCurrency } from "../lib/format";
import { buildRunIdentityTokens, getRunIdentity, getRunScenario } from "../lib/run-identity";
import type { RunManifest, RunSummary } from "../types/api";

/* ── Sort logic ── */

type SortField =
  | "run_id"
  | "shop_id"
  | "mode"
  | "scenario"
  | "day_count"
  | "balance"
  | "delta"
  | "sales"
  | "review_avg"
  | "tool_calls"
  | "turns";

type SortDir = "asc" | "desc";

function getSortValue(s: RunSummary, field: SortField): number | string {
  switch (field) {
    case "run_id":
      return s.run_id;
    case "shop_id":
      return s.shop_id;
    case "mode":
      return s.mode;
    case "scenario":
      return s.scenario?.scenario_id ?? "";
    case "day_count":
      return s.day_count;
    case "balance":
      return s.ending_state.available_balance;
    case "delta":
      return (
        s.ending_state.available_balance - s.starting_state.available_balance
      );
    case "sales":
      return s.ending_state.total_sales_count;
    case "review_avg":
      return s.ending_state.review_average;
    case "tool_calls":
      return s.totals.tool_call_count;
    case "turns":
      return s.totals.turn_count;
  }
}

/* ── Column rank helpers ── */

function rankColumn(
  summaries: RunSummary[],
  field: SortField
): Map<string, "best" | "worst" | null> {
  if (summaries.length < 2) return new Map();
  const vals = summaries.map((s) => ({
    id: s.run_id,
    v: getSortValue(s, field),
  }));
  if (typeof vals[0].v === "string") return new Map();
  const numVals = vals as { id: string; v: number }[];
  const maxVal = Math.max(...numVals.map((x) => x.v));
  const minVal = Math.min(...numVals.map((x) => x.v));
  if (maxVal === minVal) return new Map();
  const m = new Map<string, "best" | "worst" | null>();
  for (const { id, v } of numVals) {
    if (v === maxVal) m.set(id, "best");
    else if (v === minVal) m.set(id, "worst");
    else m.set(id, null);
  }
  return m;
}

function rankClass(rank: "best" | "worst" | null): string {
  if (rank === "best") return "text-emerald font-bold";
  if (rank === "worst") return "text-rose";
  return "";
}

/* ── Tool distribution bar ── */

function ToolBar({ tools }: { tools: Record<string, number> }) {
  const entries = Object.entries(tools).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  if (total === 0) return <span className="text-muted text-xs">--</span>;

  const palette = [
    "bg-orange",
    "bg-teal",
    "bg-violet",
    "bg-emerald",
    "bg-amber",
    "bg-rose",
    "bg-sky",
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden bg-gray-3">
        {entries.map(([name, count], i) => (
          <div
            key={name}
            className={`${palette[i % palette.length]} transition-[width] duration-300`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${name}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.slice(0, 4).map(([name, count], i) => (
          <span
            key={name}
            className="text-[10px] font-mono text-muted flex items-center gap-1"
          >
            <span
              className={`inline-block w-1.5 h-1.5 ${palette[i % palette.length]}`}
            />
            {name}
            <span className="text-secondary num">{count}</span>
          </span>
        ))}
        {entries.length > 4 && (
          <span className="text-[10px] font-mono text-muted">
            +{entries.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Score card (expanded row detail) ── */

function ScoreCard({ summary }: { summary: RunSummary }) {
  const delta =
    summary.ending_state.available_balance -
    summary.starting_state.available_balance;
  const deltaPercent =
    summary.starting_state.available_balance > 0
      ? (delta / summary.starting_state.available_balance) * 100
      : 0;

  return (
    <tr>
      <td colSpan={99} className="!p-0">
        <div className="border-t-2 border-orange/20 bg-orange-1/30 px-6 py-5 animate-card-in">
          <div className="grid grid-cols-4 gap-6">
            {/* Balance progression */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
                <CurrencyDollar size={11} weight="duotone" />
                Balance Progression
              </div>
              <div className="flex items-baseline gap-3">
                <span className="num text-xs text-secondary">
                  {formatCurrency(summary.starting_state.available_balance)}
                </span>
                <span className="text-muted text-[10px]">&rarr;</span>
                <span className="num text-lg font-bold text-orange">
                  {formatCurrency(summary.ending_state.available_balance)}
                </span>
              </div>
              <div
                className={`text-xs font-mono font-semibold flex items-center gap-1 ${delta >= 0 ? "text-emerald" : "text-rose"}`}
              >
                {delta >= 0 ? (
                  <ArrowUp size={10} weight="bold" />
                ) : (
                  <ArrowDown size={10} weight="bold" />
                )}
                {delta >= 0 ? "+" : "-"}
                {Math.abs(delta).toFixed(2)} ({deltaPercent.toFixed(1)}%)
              </div>
            </div>

            {/* Workspace activity */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
                <ClipboardText size={11} weight="duotone" />
                Workspace Activity
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted">Notes</span>
                  <div className="num font-semibold text-ink">
                    {summary.totals.notes_written}
                  </div>
                </div>
                <div>
                  <span className="text-muted">Reminders</span>
                  <div className="num font-semibold text-ink">
                    {summary.totals.reminders_set}
                  </div>
                </div>
                <div>
                  <span className="text-muted">Completed</span>
                  <div className="num font-semibold text-ink">
                    {summary.totals.reminders_completed}
                  </div>
                </div>
                <div>
                  <span className="text-muted">Pending</span>
                  <div className="num font-semibold text-ink">
                    {summary.memory.pending_reminder_count}
                  </div>
                </div>
              </div>
            </div>

            {/* Tool call breakdown */}
            <div className="space-y-2 col-span-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
                <Wrench size={11} weight="duotone" />
                Tool Call Distribution
              </div>
              <ToolBar tools={summary.totals.tool_calls_by_name} />
            </div>
          </div>

          {/* Surface breakdown */}
          {Object.keys(summary.totals.tool_calls_by_surface).length > 0 && (
            <div className="mt-4 pt-4 border-t border-orange/10 flex items-center gap-4">
              <span className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
                Surfaces:
              </span>
              {Object.entries(summary.totals.tool_calls_by_surface).map(
                ([surface, count]) => (
                  <Badge key={surface} variant="gray" subtle>
                    {surface}: {count}
                  </Badge>
                )
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Sortable column header ── */

function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort === field;
  return (
    <th
      aria-sort={
        isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
      align={align === "right" ? "right" : undefined}
      className="select-none"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="group inline-flex items-center gap-1 transition-colors hover:text-ink"
      >
        {label}
        <span
          className={`transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
        >
          {isActive && currentDir === "asc" ? (
            <ArrowUp size={10} weight="bold" />
          ) : (
            <ArrowDown size={10} weight="bold" />
          )}
        </span>
      </button>
    </th>
  );
}

/* ── Main page ── */

export function Benchmarks() {
  const { data: runList, isLoading: listLoading, error: listError } = useRunList();
  const runIds = useMemo(() => (runList ?? []).map((r) => r.run_id), [runList]);
  const summaryResults = useRunSummaries(runIds);
  const manifestResults = useRunManifests(runIds);

  const [sortField, setSortField] = useState<SortField>("balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const sorted = useMemo(() => {
    const arr = [...summaries];
    arr.sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDir === "asc" ? diff : -diff;
    });
    return arr;
  }, [summaries, sortField, sortDir]);

  // Column rankings for color coding
  const balanceRanks = useMemo(
    () => rankColumn(summaries, "balance"),
    [summaries]
  );
  const deltaRanks = useMemo(
    () => rankColumn(summaries, "delta"),
    [summaries]
  );
  const salesRanks = useMemo(
    () => rankColumn(summaries, "sales"),
    [summaries]
  );
  const reviewRanks = useMemo(
    () => rankColumn(summaries, "review_avg"),
    [summaries]
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const isLoading = listLoading || summaryResults.some((r) => r.isLoading);

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
            Run{" "}
            <span className="font-pixel text-orange">Benchmarks</span>
          </h1>
          <p className="mt-3 text-secondary text-[14px] leading-relaxed max-w-2xl">
            Compare agent run performance across models, configurations, and
            scenarios. Each row is a completed simulation run scored on ending
            balance, sales efficiency, review quality, and tool usage patterns.
          </p>

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
                <span className="w-7 h-7 bg-emerald-dim flex items-center justify-center border border-emerald/15">
                  <Trophy
                    size={14}
                    weight="duotone"
                    className="text-emerald"
                  />
                </span>
                <strong className="num text-ink">
                  {summaries.length > 0
                    ? formatCurrency(
                        Math.max(
                          ...summaries.map(
                            (s) => s.ending_state.available_balance
                          )
                        )
                      )
                    : formatCurrency(0)}
                </strong>
                <span className="text-muted text-xs">best balance</span>
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
                  {summaries.length > 0
                    ? Math.max(
                        ...summaries.map((s) => s.totals.turn_count)
                      )
                    : 0}
                </strong>
                <span className="text-muted text-xs">max turns</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Leaderboard table */}
      {listError ? (
        <BackendNotice
          title="Benchmark data could not be loaded"
          description="This comparison view depends on run artifact endpoints. The request failed or the returned data was invalid."
          endpoints={[
            "GET /control/runs",
            "GET /control/runs/:runId/summary",
          ]}
        />
      ) : isLoading && summaries.length === 0 ? (
        <div className="tech-card overflow-hidden">
          <div className="p-6 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="tech-card p-8">
          <EmptyState
            icon={<Lightning size={48} weight="duotone" />}
            title="No runs yet"
            description="Complete a simulation run to see benchmark results. Run data from summary.json artifacts will populate this table."
          />
        </div>
      ) : (
        <section className="bg-white border border-rule overflow-hidden shadow-[var(--shadow-card)]">
          <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} weight="duotone" className="text-orange" />
              <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
                Leaderboard
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted">
              {sorted.length} run{sorted.length !== 1 ? "s" : ""} &middot;
              sorted by{" "}
              <span className="text-secondary">{sortField.replace("_", " ")}</span>{" "}
              {sortDir}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="geist-table">
              <thead>
                <tr>
                  <th className="w-8 text-center">#</th>
                  <SortHeader
                    label="Run ID"
                    field="run_id"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Shop"
                    field="shop_id"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Mode"
                    field="mode"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Scenario"
                    field="scenario"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Days"
                    field="day_count"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="End Balance"
                    field="balance"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Delta"
                    field="delta"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Sales"
                    field="sales"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Reviews"
                    field="review_avg"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Tools"
                    field="tool_calls"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Turns"
                    field="turns"
                    currentSort={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const delta =
                    s.ending_state.available_balance -
                    s.starting_state.available_balance;
                  const isExpanded = expandedId === s.run_id;
                  const rank = i + 1;

                  return (
                    <RunRow
                      key={s.run_id}
                      summary={s}
                      manifest={manifestsByRunId.get(s.run_id)}
                      rank={rank}
                      delta={delta}
                      isExpanded={isExpanded}
                      onToggle={() =>
                        setExpandedId(isExpanded ? null : s.run_id)
                      }
                      balanceRank={balanceRanks.get(s.run_id) ?? null}
                      deltaRank={deltaRanks.get(s.run_id) ?? null}
                      salesRank={salesRanks.get(s.run_id) ?? null}
                      reviewRank={reviewRanks.get(s.run_id) ?? null}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Backend contract note */}
      <BackendNotice
        title="Backend contract"
        description="Benchmarks aggregate run summaries from the control surface and remain read-only by design."
        endpoints={[
          "GET /control/runs",
          "GET /control/runs/:runId/summary",
          "GET /control/runs/:runId/manifest",
          "GET /control/runs/:runId/days",
        ]}
        compact
      />
    </div>
  );
}

/* ── Table row (extracted for readability) ── */

function RunRow({
  summary: s,
  manifest,
  rank,
  delta,
  isExpanded,
  onToggle,
  balanceRank,
  deltaRank,
  salesRank,
  reviewRank,
}: {
  summary: RunSummary;
  manifest?: RunManifest;
  rank: number;
  delta: number;
  isExpanded: boolean;
  onToggle: () => void;
  balanceRank: "best" | "worst" | null;
  deltaRank: "best" | "worst" | null;
  salesRank: "best" | "worst" | null;
  reviewRank: "best" | "worst" | null;
}) {
  const scenario = getRunScenario({ summary: s, manifest });
  const identity = getRunIdentity({ summary: s, manifest });
  const identityTokens = buildRunIdentityTokens(identity);

  return (
    <>
      <tr className={isExpanded ? "bg-orange-1/40" : ""}>
        {/* Rank */}
        <td className="text-center">
          {rank === 1 ? (
            <span className="inline-flex items-center justify-center w-6 h-6 bg-orange text-white text-[10px] font-mono font-bold">
              1
            </span>
          ) : rank === 2 ? (
            <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-3 text-secondary text-[10px] font-mono font-bold">
              2
            </span>
          ) : rank === 3 ? (
            <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-dim text-amber text-[10px] font-mono font-bold">
              3
            </span>
          ) : (
            <span className="text-[10px] font-mono text-muted">{rank}</span>
          )}
        </td>

        {/* Run ID */}
        <td>
          <Link
            to={`/runs/${encodeURIComponent(s.run_id)}`}
            className="font-mono text-xs font-medium text-ink transition-colors hover:text-orange"
          >
            {s.run_id}
          </Link>
          {identityTokens.length > 0 ? (
            <div className="mt-1 text-[10px] font-mono text-muted">
              {identityTokens.join(" · ")}
            </div>
          ) : null}
        </td>

        {/* Shop */}
        <td className="num text-xs text-secondary">{s.shop_id}</td>

        {/* Mode */}
        <td>
          <Badge variant={s.mode === "live" ? "emerald" : "gray"} subtle>
            {s.mode}
          </Badge>
        </td>

        {/* Scenario */}
        <td>
          {scenario ? (
            <ScenarioBadge scenario={scenario} subtle />
          ) : (
            <span className="text-[10px] font-mono text-muted">--</span>
          )}
        </td>

        {/* Days */}
        <td className="text-right num text-xs text-secondary">
          {s.day_count}
        </td>

        {/* End balance (headline score) */}
        <td className="text-right">
          <span
            className={`num text-sm font-bold ${rankClass(balanceRank) || "text-orange"}`}
          >
            {formatCurrency(s.ending_state.available_balance)}
          </span>
        </td>

        {/* Delta */}
        <td className="text-right">
          <span
            className={`num text-xs font-semibold flex items-center justify-end gap-0.5 ${
              rankClass(deltaRank) ||
              (delta >= 0 ? "text-emerald" : "text-rose")
            }`}
          >
            {delta >= 0 ? (
              <ArrowUp size={9} weight="bold" />
            ) : (
              <ArrowDown size={9} weight="bold" />
            )}
            {delta >= 0 ? "+" : "-"}
            {Math.abs(delta).toFixed(2)}
          </span>
        </td>

        {/* Sales */}
        <td className="text-right">
          <span className={`num text-xs ${rankClass(salesRank)}`}>
            {s.ending_state.total_sales_count}
          </span>
        </td>

        {/* Review avg */}
        <td className="text-right">
          <span
            className={`num text-xs flex items-center justify-end gap-1 ${rankClass(reviewRank)}`}
          >
            <Star size={10} weight="fill" className="text-amber" />
            {s.ending_state.review_average.toFixed(1)}
            <span className="text-muted text-[10px]">
              ({s.ending_state.review_count})
            </span>
          </span>
        </td>

        {/* Tool calls */}
        <td className="text-right num text-xs text-secondary">
          {s.totals.tool_call_count}
        </td>

        {/* Turns */}
        <td className="text-right num text-xs text-secondary">
          {s.totals.turn_count}
        </td>

        {/* Expand indicator */}
        <td className="text-center">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${s.run_id}` : `Expand ${s.run_id}`}
            className={`inline-block text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          >
            <ArrowDown size={12} weight="bold" />
          </button>
        </td>
      </tr>

      {isExpanded && <ScoreCard summary={s} />}
    </>
  );
}
