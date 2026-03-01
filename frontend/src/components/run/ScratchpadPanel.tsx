import { useState } from "react";
import { NotePencil, ClockCounterClockwise } from "@phosphor-icons/react";
import { Badge } from "../Badge";
import type { Workspace, WorkspaceRevision } from "../../types/runs";

export function ScratchpadPanel({
  workspace,
  revisions,
  selectedDay,
}: {
  workspace: Workspace;
  revisions: WorkspaceRevision[];
  selectedDay?: number;
}) {
  const [showHistory, setShowHistory] = useState(false);

  if (workspace === null && revisions.length === 0) {
    return (
      <span className="text-xs text-muted">
        The agent did not use the scratchpad during this run.
      </span>
    );
  }

  // Find the revision matching the selected day (end-of-day reflection for that day)
  const dayRevision =
    selectedDay != null
      ? revisions.find((r) => r.updated_day === selectedDay)
      : null;

  // Show the day-specific revision if available, otherwise latest
  const displayRevision = dayRevision ?? (workspace ? workspace : revisions[revisions.length - 1] ?? null);
  const displayContent = displayRevision?.content;
  const displayRevisionNumber = displayRevision?.revision;
  const displayDay = displayRevision?.updated_day;
  const isShowingDaySpecific = dayRevision !== null && dayRevision !== undefined;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        {displayRevisionNumber != null && (
          <Badge variant="violet" subtle>
            rev {displayRevisionNumber}
          </Badge>
        )}
        {displayDay != null && (
          <span className="text-[9px] font-mono text-muted">
            {isShowingDaySpecific
              ? `end-of-day ${displayDay} reflection`
              : `last updated day ${displayDay}`}
          </span>
        )}
        {!isShowingDaySpecific && selectedDay != null && (
          <span className="text-[9px] font-mono text-amber">
            no scratchpad update on day {selectedDay}
          </span>
        )}
        {revisions.length > 1 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="ml-auto flex items-center gap-1 text-[9px] font-mono text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ClockCounterClockwise size={10} />
            {showHistory ? "Hide" : "Show"} history ({revisions.length} revisions)
          </button>
        )}
      </div>

      {/* Revision timeline */}
      {showHistory && revisions.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {revisions.map((rev) => {
            const isActive = rev.revision === displayRevisionNumber;
            const isDayMatch = rev.updated_day === selectedDay;
            return (
              <span
                key={rev.revision}
                className={`px-2 py-0.5 text-[9px] font-mono border ${
                  isActive
                    ? "border-violet/60 bg-violet/10 text-violet"
                    : isDayMatch
                      ? "border-amber/40 bg-amber/5 text-amber"
                      : "border-rule bg-gray-1 text-muted"
                }`}
              >
                r{rev.revision}
                {rev.updated_day != null && (
                  <span className="ml-1 opacity-60">d{rev.updated_day}</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Content */}
      {displayContent ? (
        <div className="bg-gray-1 border border-rule p-3">
          {isShowingDaySpecific && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-rule/50">
              <NotePencil size={10} className="text-violet" />
              <span className="text-[9px] font-mono text-muted">
                End-of-day {displayDay} reflection &middot; revision {displayRevisionNumber}
              </span>
            </div>
          )}
          <pre className="text-xs text-secondary leading-relaxed whitespace-pre-wrap font-mono">
            {displayContent}
          </pre>
        </div>
      ) : (
        <span className="text-xs text-muted">Empty scratchpad.</span>
      )}
    </div>
  );
}
