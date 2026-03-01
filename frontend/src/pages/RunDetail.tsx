import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Brain,
  CaretDown,
  CurrencyDollar,
  Lightning,
  Spinner,
  Star,
  Storefront,
  Sun,
  WarningCircle,
  Wrench,
  XCircle,
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
import { RunActivityTimeline } from "../components/run/RunActivityTimeline";
import { ActivitySummary } from "../components/run/ActivitySummary";
import { AgentMemorySection } from "../components/run/AgentMemorySection";
import { TurnInspector } from "../components/run/TurnInspector";
import {
  useRunDayBriefing,
  useRunDaySnapshots,
  useRunDayTurns,
  useRunManifest,
  useRunMemoryNotes,
  useRunMemoryReminders,
  useRunProgress,
  useRunStatus,
  useRunSummary,
  useRunWorkspace,
  useRunWorkspaceRevisions,
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
  const [rawTurnsOpen, setRawTurnsOpen] = useState(false);

  const summaryQuery = useRunSummary(id);
  const manifestQuery = useRunManifest(id);
  const daySnapshotsQuery = useRunDaySnapshots(id);
  const notesQuery = useRunMemoryNotes(id);
  const remindersQuery = useRunMemoryReminders(id);
  const workspaceQuery = useRunWorkspace(id);
  const workspaceRevisionsQuery = useRunWorkspaceRevisions(id);
  const progressQuery = useRunProgress(id);
  const statusQuery = useRunStatus(id);

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

  const allNotes = notesQuery.data ?? [];
  const allReminders = remindersQuery.data ?? [];
  const workspace = workspaceQuery.data ?? null;
  const workspaceRevisions = workspaceRevisionsQuery.data ?? [];
  const scenario = getRunScenario({ summary, manifest });
  const identity = getRunIdentity({ summary, manifest });
  const identityTokens = buildRunIdentityTokens(identity);

  const handleSelectDay = useCallback(
    (day: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("day", String(day));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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
    const progress = progressQuery.data;
    const runStatus = statusQuery.data;

    // Failed run — show the error prominently
    if (runStatus && runStatus.status === "failed") {
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
            <h1 className="font-mono text-xl font-bold text-ink">{id}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="red">
                <span className="flex items-center gap-1">
                  <XCircle size={10} weight="fill" />
                  failed
                </span>
              </Badge>
            </div>
          </div>
          <div className="tech-card border-red/20 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-mono font-semibold text-red">
              <WarningCircle size={14} weight="fill" />
              Run failed
            </div>
            <p className="text-sm font-mono text-secondary leading-relaxed break-all">
              {runStatus.error ?? "No error details available."}
            </p>
          </div>
        </div>
      );
    }

    // Running — show live progress
    if (progress && progress.status === "running") {
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
            <h1 className="font-mono text-xl font-bold text-ink">{id}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="amber">
                <span className="flex items-center gap-1">
                  <Spinner size={10} className="animate-spin" />
                  running
                </span>
              </Badge>
              <Badge variant="orange" subtle>
                shop {progress.shop_id}
              </Badge>
            </div>
          </div>

          {/* Progress bar */}
          <div className="tech-card p-5 space-y-3">
            <div className="flex items-center justify-between text-sm font-mono">
              <span className="text-muted">Progress</span>
              <span className="text-ink font-semibold">
                {progress.completed_day_count} / {progress.total_days} days
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber transition-all duration-500"
                style={{
                  width: `${Math.round((progress.completed_day_count / progress.total_days) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Completed day stats */}
          {progress.days.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-mono font-semibold text-muted uppercase tracking-wider">
                Completed Days
              </h2>
              {progress.days.map((day) => (
                <div
                  key={day.day}
                  className="tech-card p-4 animate-card-in"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-ink">
                        Day {day.day}
                      </span>
                      {day.simulation_date ? (
                        <span className="ml-2 text-[10px] font-mono text-muted">
                          {day.simulation_date}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex-1" />
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-muted" title="Balance">
                        <CurrencyDollar size={12} weight="bold" className="text-orange" />
                        <span className="num">${day.available_balance.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted" title="Active listings">
                        <Storefront size={12} weight="duotone" className="text-teal" />
                        <span className="num">{day.active_listing_count} listings</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted" title="Total sales">
                        <Lightning size={12} weight="fill" className="text-emerald" />
                        <span className="num">{day.total_sales_count} sales</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted" title="Turns">
                        <Wrench size={12} weight="duotone" className="text-violet" />
                        <span className="num">{day.turn_count} turns</span>
                      </div>
                      {day.tool_calls.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-muted" title="Tool calls">
                          <span className="num">{day.tool_calls.length} calls</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    // Still loading status — show a brief waiting state before falling back
    if (statusQuery.isLoading || progressQuery.isLoading) {
      return (
        <div className="space-y-8">
          <Skeleton width="240px" height="28px" />
          <Skeleton width="100%" height="120px" />
        </div>
      );
    }

    // Running per status endpoint (no progress file yet)
    if (runStatus && runStatus.status === "running") {
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
            <h1 className="font-mono text-xl font-bold text-ink">{id}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="amber">
                <span className="flex items-center gap-1">
                  <Spinner size={10} className="animate-spin" />
                  starting&hellip;
                </span>
              </Badge>
            </div>
          </div>
          <div className="tech-card p-5">
            <p className="text-sm font-mono text-muted">
              Run is initializing. Progress will appear once the first day begins.
            </p>
          </div>
        </div>
      );
    }

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
    (selectedDay > 0 && turnsQuery.isError);

  const hasMemoryStats =
    summary.memory.note_count > 0 ||
    summary.memory.reminder_count > 0 ||
    summary.totals.notes_written > 0;

  const balanceDelta =
    summary.ending_state.available_balance -
    summary.starting_state.available_balance;

  return (
    <div className="space-y-6">
      {/* ── 1. Header ── */}
      <div>
        <Link
          to="/runs"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-mono text-muted transition-colors hover:text-orange"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          All Runs
        </Link>

        <div className="min-w-0">
          <h1 className="font-mono text-xl font-bold text-ink">
            {summary.shop_name || summary.run_id}
          </h1>
          {summary.shop_name && (
            <p className="text-xs font-mono text-muted mt-0.5">{summary.run_id}</p>
          )}
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
          {manifest?.invocation.command && (
            <p className="mt-1 text-xs font-mono text-muted">
              {manifest.invocation.command}
            </p>
          )}
        </div>
      </div>

      {/* ── 2. Activity Timeline (chart + swim lanes) ── */}
      {daySnapshotsQuery.isError ? (
        <BackendNotice
          title="Day snapshots could not be loaded"
          description="The day timeline depends on per-day run artifact snapshots. The request failed or the artifact bundle is incomplete."
          endpoints={["GET /control/runs/:runId/days"]}
        />
      ) : daySnapshots.length >= 3 ? (
        <RunActivityTimeline
          days={daySnapshots}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
        />
      ) : daySnapshots.length > 0 ? (
        <DayTimeline
          days={daySnapshots}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
        />
      ) : null}

      {/* ── 3. Consolidated stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Balance"
          value={`${formatCurrency(summary.ending_state.available_balance)}`}
          icon={<CurrencyDollar size={12} weight="bold" />}
          accent={
            balanceDelta > 0
              ? "emerald"
              : balanceDelta < 0
                ? "rose"
                : undefined
          }
          secondary={`${balanceDelta >= 0 ? "+" : ""}${formatCurrency(balanceDelta)} change`}
        />
        <Stat
          label="Turns / Tool Calls"
          value={`${summary.totals.turn_count} / ${summary.totals.tool_call_count}`}
          icon={<Lightning size={12} weight="fill" />}
          accent="violet"
        />
        <Stat
          label="Sales"
          value={summary.ending_state.total_sales_count}
          icon={<Storefront size={12} weight="duotone" />}
          accent="emerald"
          secondary={
            summary.ending_state.review_count > 0
              ? `${summary.ending_state.review_average.toFixed(1)} avg rating`
              : undefined
          }
        />
        <Stat
          label="Agent Memory"
          value={
            hasMemoryStats
              ? `${summary.memory.note_count} notes`
              : "none"
          }
          icon={<Brain size={12} weight="duotone" />}
          accent={hasMemoryStats ? "amber" : undefined}
          secondary={
            summary.memory.reminder_count > 0
              ? `${summary.memory.reminder_count} reminders`
              : undefined
          }
        />
      </div>

      {/* ── 4. Selected day detail ── */}
      {currentDay ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-ink">
              Day {currentDay.day}
            </h2>
            <span className="text-xs font-mono text-muted">
              {formatDateMedium(currentDay.simulation_date)}
            </span>
            <Badge variant="gray" subtle>
              balance{" "}
              {formatCurrency(
                currentDay.available_balance,
                currentDay.currency_code,
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat
              label="Balance"
              value={formatCurrency(
                currentDay.available_balance,
                currentDay.currency_code,
              )}
              icon={<CurrencyDollar size={12} weight="bold" />}
              accent="orange"
            />
            <Stat
              label="Active Listings"
              value={currentDay.active_listing_count}
              icon={<Storefront size={12} weight="duotone" />}
              accent="teal"
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
              icon={<Storefront size={12} weight="duotone" />}
              accent="emerald"
            />
            <Stat
              label="Reviews"
              value={`${currentDay.review_average.toFixed(1)} (${currentDay.review_count})`}
              icon={<Star size={12} weight="fill" />}
              accent="emerald"
            />
          </div>
        </div>
      ) : null}

      {/* ── 5. Activity summary for selected day ── */}
      {!dayDetailUnavailable &&
        turnsQuery.data &&
        turnsQuery.data.length > 0 && (
          <ActivitySummary turns={turnsQuery.data} />
        )}

      {/* ── 6. Briefing panel ── */}
      {dayDetailUnavailable ? (
        <BackendNotice
          title="Per-day trace detail could not be loaded"
          description="The selected run has summary metadata, but day briefing or turn playback requests failed."
          endpoints={[
            "GET /control/runs/:runId/days/:day/briefing",
            "GET /control/runs/:runId/days/:day/turns",
          ]}
        />
      ) : (
        <>
          {briefingQuery.data ? (
            <BriefingPanel briefing={briefingQuery.data} />
          ) : null}
        </>
      )}

      {/* ── 7. Turn inspector (collapsed by default) ── */}
      {!dayDetailUnavailable &&
        turnsQuery.data &&
        turnsQuery.data.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setRawTurnsOpen(!rawTurnsOpen)}
              className="flex items-center gap-2 w-full tech-card px-4 py-3 text-left cursor-pointer hover:bg-gray-1 transition-colors"
            >
              <Wrench size={12} weight="duotone" className="text-teal" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
                Raw Turn Inspector
              </span>
              <Badge variant="gray" subtle className="ml-1">
                {turnsQuery.data.length}
              </Badge>
              <CaretDown
                size={10}
                className={`text-muted ml-auto transition-transform duration-200 ${rawTurnsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {rawTurnsOpen && (
              <div className="animate-card-in">
                <TurnInspector turns={turnsQuery.data} />
              </div>
            )}
          </>
        )}

      {/* ── 8. Agent memory section ── */}
      <AgentMemorySection
        notes={allNotes}
        reminders={allReminders}
        workspace={workspace}
        workspaceRevisions={workspaceRevisions}
        selectedDay={selectedDay}
      />
    </div>
  );
}
