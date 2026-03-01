import { useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CurrencyDollar,
  Lightning,
  Sun,
  Wrench,
} from "@phosphor-icons/react";
import { BackendNotice } from "../components/BackendNotice";
import { Badge } from "../components/Badge";
import {
  ControlledShopsBadge,
  ScenarioBadge,
} from "../components/ScenarioBadge";
import { EmptyState } from "../components/EmptyState";
import { Stat } from "../components/Stat";
import { Skeleton } from "../components/Skeleton";
import { BriefingPanel } from "../components/run/BriefingPanel";
import { DayTimeline } from "../components/run/DayTimeline";
import { MemoryPanel } from "../components/run/MemoryPanel";
import { TurnInspector } from "../components/run/TurnInspector";
import {
  useRunDayBriefing,
  useRunDaySnapshots,
  useRunDayTurns,
  useRunManifest,
  useRunMemoryNotes,
  useRunSummary,
} from "../hooks/useApi";
import { formatCurrency, formatDateMedium } from "../lib/format";
import {
  buildRunIdentityTokens,
  getRunIdentity,
  getRunScenario,
} from "../lib/run-identity";

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const id = runId ?? "";
  const [searchParams, setSearchParams] = useSearchParams();

  const summaryQuery = useRunSummary(id);
  const manifestQuery = useRunManifest(id);
  const daySnapshotsQuery = useRunDaySnapshots(id);
  const notesQuery = useRunMemoryNotes(id);

  const summary = summaryQuery.data;
  const manifest = manifestQuery.data;
  const daySnapshots = daySnapshotsQuery.data ?? [];
  const requestedDay = Number(searchParams.get("day"));
  const selectedDay = daySnapshots.some((day) => day.day === requestedDay)
    ? requestedDay
    : daySnapshots[0]?.day ?? summary?.start_day ?? 0;

  useEffect(() => {
    if (!selectedDay) return;
    if (searchParams.get("day") === String(selectedDay)) return;
    const next = new URLSearchParams(searchParams);
    next.set("day", String(selectedDay));
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedDay, setSearchParams]);

  const briefingQuery = useRunDayBriefing(id, selectedDay);
  const turnsQuery = useRunDayTurns(id, selectedDay);

  const currentDay =
    daySnapshots.find((day) => day.day === selectedDay) ?? null;

  const notesForSelectedDay = (notesQuery.data ?? []).filter(
    (note) => note.created_day === selectedDay,
  );
  const scenario = getRunScenario({ summary, manifest });
  const identity = getRunIdentity({ summary, manifest });
  const identityTokens = buildRunIdentityTokens(identity);

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton width="240px" height="28px" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton height="88px" />
          <Skeleton height="88px" />
          <Skeleton height="88px" />
          <Skeleton height="88px" />
        </div>
        <Skeleton width="100%" height="240px" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<Sun size={48} weight="duotone" />}
          title="Run not found"
          description="This run could not be loaded from the current control-plane API."
        />
        <BackendNotice
          title="Run summary could not be loaded"
          description="The run explorer depends on control-plane artifact endpoints. The request failed or the run id is unknown."
          endpoints={["GET /control/runs/:runId/summary"]}
        />
      </div>
    );
  }

  const dayDetailUnavailable =
    (selectedDay > 0 && briefingQuery.isError) ||
    (selectedDay > 0 && turnsQuery.isError) ||
    notesQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/runs"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-mono text-muted transition-colors hover:text-orange"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          All Runs
        </Link>

        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-mono text-xl font-bold text-ink">
              {summary.run_id}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="orange" subtle>
                shop {summary.shop_id}
              </Badge>
              <Badge variant={summary.mode === "live" ? "emerald" : "gray"}>
                {summary.mode}
              </Badge>
              {scenario ? <ScenarioBadge scenario={scenario} /> : null}
              {scenario ? (
                <ControlledShopsBadge shopIds={scenario.controlled_shop_ids} />
              ) : null}
              <Badge variant="teal">
                {summary.day_count} day{summary.day_count !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="gray" subtle>
                days {summary.start_day}-{summary.end_day}
              </Badge>
              {identityTokens.map((token) => (
                <Badge key={token} variant="gray" subtle>
                  {token}
                </Badge>
              ))}
            </div>
          </div>

          {manifest ? (
            <div className="tech-card min-w-[280px] p-4">
              <div className="mb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
                Run Identity
              </div>
              {identityTokens.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {identityTokens.map((token) => (
                    <Badge key={token} variant="gray" subtle>
                      {token}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {manifest.invocation.command ? (
                <p className="text-sm text-secondary">
                  {manifest.invocation.command}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Invocation metadata loaded without a command string.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Balance Change"
          value={`${formatCurrency(summary.starting_state.available_balance)} → ${formatCurrency(summary.ending_state.available_balance)}`}
          icon={<CurrencyDollar size={12} weight="bold" />}
          accent={
            summary.ending_state.available_balance >
            summary.starting_state.available_balance
              ? "emerald"
              : summary.ending_state.available_balance <
                  summary.starting_state.available_balance
                ? "rose"
                : undefined
          }
        />
        <Stat
          label="Total Tool Calls"
          value={summary.totals.tool_call_count}
          icon={<Wrench size={12} weight="duotone" />}
          accent="teal"
        />
        <Stat
          label="Yesterday Revenue"
          value={formatCurrency(summary.totals.yesterday_revenue)}
          icon={<CurrencyDollar size={12} weight="bold" />}
          accent="amber"
        />
        <Stat
          label="Turns"
          value={summary.totals.turn_count}
          icon={<Lightning size={12} weight="fill" />}
          accent="violet"
        />
      </div>

      {Object.keys(summary.totals.tool_calls_by_name).length > 0 ? (
        <div className="tech-card p-4">
          <div className="mb-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
            Tool Call Distribution
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.totals.tool_calls_by_name)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 border border-rule bg-gray-1 px-3 py-1.5 font-mono text-xs"
                >
                  <span className="text-secondary">{name}</span>
                  <span className="num font-semibold text-ink">{count}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {daySnapshotsQuery.isError ? (
        <BackendNotice
          title="Day snapshots could not be loaded"
          description="The day timeline depends on per-day run artifact snapshots. The request failed or the artifact bundle is incomplete."
          endpoints={["GET /control/runs/:runId/days"]}
        />
      ) : daySnapshots.length > 0 ? (
        <>
          <DayTimeline
            days={daySnapshots}
            selectedDay={selectedDay}
            onSelectDay={(day) => {
              const next = new URLSearchParams(searchParams);
              next.set("day", String(day));
              setSearchParams(next, { replace: true });
            }}
          />

          {currentDay ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-ink">Day {currentDay.day}</h2>
                <span className="text-xs font-mono text-muted">
                  {formatDateMedium(currentDay.simulation_date)}
                </span>
                <Badge variant="gray" subtle>
                  balance {formatCurrency(currentDay.available_balance, currentDay.currency_code)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat
                  label="Balance"
                  value={formatCurrency(currentDay.available_balance, currentDay.currency_code)}
                  icon={<CurrencyDollar size={12} weight="bold" />}
                  accent="orange"
                />
                <Stat
                  label="Active Listings"
                  value={currentDay.active_listing_count}
                  icon={<Lightning size={12} weight="duotone" />}
                  accent="emerald"
                />
                <Stat
                  label="Draft Listings"
                  value={currentDay.draft_listing_count}
                  icon={<Sun size={12} weight="duotone" />}
                  accent="teal"
                />
                <Stat
                  label="Total Sales"
                  value={currentDay.total_sales_count}
                  icon={<Wrench size={12} weight="duotone" />}
                  accent="violet"
                />
                <Stat
                  label="Reviews"
                  value={`${currentDay.review_average.toFixed(1)} (${currentDay.review_count})`}
                  icon={<Sun size={12} weight="duotone" />}
                  accent="amber"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {dayDetailUnavailable ? (
        <BackendNotice
          title="Per-day trace detail could not be loaded"
          description="The selected run has summary metadata, but day briefing, turn playback, or memory requests failed."
          endpoints={[
            "GET /control/runs/:runId/days/:day/briefing",
            "GET /control/runs/:runId/days/:day/turns",
            "GET /control/runs/:runId/memory/notes",
          ]}
        />
      ) : (
        <>
          {briefingQuery.data ? <BriefingPanel briefing={briefingQuery.data} /> : null}
          {turnsQuery.data && turnsQuery.data.length > 0 ? (
            <TurnInspector turns={turnsQuery.data} />
          ) : null}
          {notesForSelectedDay.length > 0 ? (
            <MemoryPanel notes={notesForSelectedDay} />
          ) : null}
        </>
      )}
    </div>
  );
}
