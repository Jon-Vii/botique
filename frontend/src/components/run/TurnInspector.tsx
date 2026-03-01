import { useState } from "react";
import {
  CaretDown,
  CaretRight,
  Wrench,
  Clock,
  Code,
} from "@phosphor-icons/react";
import { Badge } from "../Badge";
import type { TurnRecord } from "../../types/runs";

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  const json = JSON.stringify(data, null, 2);
  const lines = json.split("\n");
  const truncated = lines.length > 20;
  const [expanded, setExpanded] = useState(false);
  const displayLines = expanded ? lines : lines.slice(0, 20);

  return (
    <div className="relative">
      {label && (
        <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted block mb-1">
          {label}
        </span>
      )}
      <pre className="bg-snippet-bg border border-snippet-border text-snippet-text font-mono text-[11px] leading-relaxed p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
        {displayLines.join("\n")}
        {truncated && !expanded && (
          <span className="text-snippet-muted">
            {"\n"}... {lines.length - 20} more lines
          </span>
        )}
      </pre>
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="text-[10px] font-mono text-orange hover:text-orange-dark mt-1 cursor-pointer"
        >
          {expanded ? "Collapse" : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

function TurnRow({ turn }: { turn: TurnRecord }) {
  const [argsOpen, setArgsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const hasStateChanges = turn.state_changes != null;

  const duration = formatDuration(turn.started_at, turn.completed_at);

  return (
    <div className="border border-rule bg-white relative group">
      {/* Turn header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Slot number */}
        <div className="w-7 h-7 flex items-center justify-center bg-gray-1 border border-rule text-[10px] font-mono font-bold text-secondary shrink-0">
          {turn.turn_index}
        </div>

        {/* Tool name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Wrench size={12} weight="duotone" className="text-teal shrink-0" />
          <span className="font-mono text-sm font-semibold text-ink truncate">
            {turn.tool_call.name}
          </span>
        </div>

        {/* Decision summary */}
        {turn.decision_summary && (
          <span className="text-[11px] text-muted truncate hidden sm:block flex-1" title={turn.decision_summary}>
            {turn.decision_summary}
          </span>
        )}

        <div className="flex-1 sm:flex-none" />

        {/* Timing */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted shrink-0" title="Duration">
          <Clock size={10} />
          {duration}
        </div>

        {/* State change indicator */}
        {hasStateChanges && (
          <Badge variant="amber" subtle>
            state change
          </Badge>
        )}
      </div>

      {/* Expandable sections */}
      <div className="border-t border-rule/50">
        {/* Arguments */}
        <button
          type="button"
          onClick={() => setArgsOpen(!argsOpen)}
          aria-expanded={argsOpen}
          className="flex items-center gap-2 w-full px-4 py-2 text-left cursor-pointer hover:bg-gray-1 transition-colors"
        >
          {argsOpen ? (
            <CaretDown size={10} className="text-muted" />
          ) : (
            <CaretRight size={10} className="text-muted" />
          )}
          <Code size={10} className="text-teal" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
            Arguments
          </span>
          {!argsOpen && Object.keys(turn.tool_call.arguments).length > 0 && (
            <span className="text-[10px] font-mono text-secondary ml-2 truncate">
              {Object.entries(turn.tool_call.arguments)
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(", ")}
            </span>
          )}
        </button>
        {argsOpen && (
          <div className="px-4 pb-3">
            <JsonBlock data={turn.tool_call.arguments} />
          </div>
        )}

        {/* Result */}
        <button
          type="button"
          onClick={() => setResultOpen(!resultOpen)}
          aria-expanded={resultOpen}
          className="flex items-center gap-2 w-full px-4 py-2 text-left cursor-pointer hover:bg-gray-1 transition-colors border-t border-rule/30"
        >
          {resultOpen ? (
            <CaretDown size={10} className="text-muted" />
          ) : (
            <CaretRight size={10} className="text-muted" />
          )}
          <Code size={10} className="text-violet" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
            Result
          </span>
          {!resultOpen && turn.tool_result.output != null && (
            <span className="text-[10px] font-mono text-secondary ml-2 truncate">
              {typeof turn.tool_result.output === "object"
                ? JSON.stringify(turn.tool_result.output).slice(0, 80) + "..."
                : String(turn.tool_result.output).slice(0, 80)}
            </span>
          )}
        </button>
        {resultOpen && (
          <div className="px-4 pb-3">
            <JsonBlock data={turn.tool_result.output} />
          </div>
        )}

        {/* State changes */}
        {hasStateChanges && (
          <div className="px-4 py-2 border-t border-rule/30">
            <JsonBlock data={turn.state_changes} label="State Changes" />
          </div>
        )}
      </div>
    </div>
  );
}

export function TurnInspector({ turns }: { turns: TurnRecord[] }) {
  return (
    <div className="tech-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-3">
        <Wrench size={12} weight="duotone" className="text-teal" />
        Work Slots
        <Badge variant="gray" subtle className="ml-2">
          {turns.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {turns.map((turn) => (
          <TurnRow key={turn.turn_index} turn={turn} />
        ))}
      </div>
    </div>
  );
}
