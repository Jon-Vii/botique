import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CurrencyDollar,
  Lightning,
  Sun,
  Wrench,
} from "@phosphor-icons/react";
import { Badge } from "../components/Badge";
import { Stat } from "../components/Stat";
import { Skeleton } from "../components/Skeleton";
import { DayTimeline } from "../components/run/DayTimeline";
import { BriefingPanel } from "../components/run/BriefingPanel";
import { TurnInspector } from "../components/run/TurnInspector";
import { MemoryPanel } from "../components/run/MemoryPanel";
import { StateDelta } from "../components/run/StateDelta";
import { useRunSummary } from "../hooks/useApi";
import {
  MOCK_SUMMARIES,
  MOCK_DAY_SUMMARIES,
  MOCK_BRIEFINGS,
  MOCK_TURNS,
  MOCK_NOTES,
} from "../api/mockRunData";
import type { RunDaySummary, DayBriefing, TurnRecord, MemoryNote } from "../types/runs";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const id = runId ?? "";

  const { data: apiSummary } = useRunSummary(id);

  // Fall back to mock data
  const summary = apiSummary ?? MOCK_SUMMARIES[id];
  const daySummaries = MOCK_DAY_SUMMARIES[id] ?? [];
  const briefings = MOCK_BRIEFINGS[id] ?? {};
  const turnsMap = MOCK_TURNS[id] ?? {};
  const notes = MOCK_NOTES[id] ?? [];

  const [selectedDay, setSelectedDay] = useState<number>(
    daySummaries[0]?.day ?? 1,
  );

  const currentDaySummary = useMemo(
    () => daySummaries.find((d) => d.day === selectedDay),
    [daySummaries, selectedDay],
  );

  const currentBriefing = briefings[selectedDay] as DayBriefing | undefined;
  const currentTurns = (turnsMap[selectedDay] ?? []) as TurnRecord[];
  const currentNotes = notes.filter(
    (n: MemoryNote) => n.created_day === selectedDay,
  );

  if (!summary) {
    return (
      <div className="space-y-4">
        <Skeleton width="300px" height="24px" />
        <Skeleton lines={4} />
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <Link
          to="/runs"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-orange transition-colors mb-3"
        >
          <ArrowLeft size={12} />
          All Runs
        </Link>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink font-mono">
              {summary.run_id}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="orange" subtle>
                shop {summary.shop_id}
              </Badge>
              <Badge variant="gray">{summary.mode}</Badge>
              <Badge variant="teal">
                {summary.day_count} day{summary.day_count !== 1 ? "s" : ""}
              </Badge>
              {summary.totals.notes_written ? (
                <Badge variant="violet">
                  {summary.totals.notes_written} note
                  {summary.totals.notes_written !== 1 ? "s" : ""}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Top-level stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 stagger">
        <Stat
          label="Balance Change"
          value={`$${summary.starting_state.available_balance.toFixed(0)} -> $${summary.ending_state.available_balance.toFixed(0)}`}
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
          label="Revenue"
          value={`$${summary.totals.yesterday_revenue.toFixed(2)}`}
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

      {/* Tool call breakdown */}
      {Object.keys(summary.totals.tool_calls_by_name).length > 0 && (
        <div className="tech-card p-4 mb-6">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-3">
            Tool Call Distribution
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.totals.tool_calls_by_name)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-1 border border-rule font-mono text-xs"
                >
                  <span className="text-secondary">{name}</span>
                  <span className="num font-semibold text-ink">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Day selector timeline */}
      <DayTimeline
        days={daySummaries}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />

      {/* Day detail panel */}
      {currentDaySummary && (
        <div className="mt-4 space-y-4 animate-card-in" key={selectedDay}>
          {/* Day header */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-ink">
              Day {selectedDay}
            </h2>
            <span className="text-xs font-mono text-muted">
              {fmtDate(currentDaySummary.simulation_date)}
            </span>
            <Badge
              variant={
                currentDaySummary.end_reason === "agent_ended_day"
                  ? "emerald"
                  : "amber"
              }
            >
              {currentDaySummary.end_reason.replace(/_/g, " ")}
            </Badge>
            <span className="text-xs font-mono text-muted">
              {currentDaySummary.turn_count} turn
              {currentDaySummary.turn_count !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Objective status */}
          <div className="tech-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-2">
              <Sun size={12} weight="duotone" />
              Objective Status
            </div>
            <p className="text-sm text-ink leading-relaxed">
              {currentDaySummary.objective_status}
            </p>
          </div>

          {/* State delta */}
          <StateDelta
            before={currentDaySummary.state_before}
            after={currentDaySummary.state_after}
            nextDay={currentDaySummary.state_next_day}
          />

          {/* Briefing */}
          {currentBriefing && <BriefingPanel briefing={currentBriefing} />}

          {/* Turns */}
          {currentTurns.length > 0 && (
            <TurnInspector turns={currentTurns} />
          )}

          {/* Memory notes for this day */}
          {currentNotes.length > 0 && (
            <MemoryPanel notes={currentNotes} />
          )}
        </div>
      )}
    </div>
  );
}
