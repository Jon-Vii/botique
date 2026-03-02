import { useState } from "react";
import { ArrowCounterClockwise, Warning, Play, Lightning } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { LoadingDots } from "../LoadingDots";
import {
  useResetWorld,
  useAdvanceDay,
  useSimulationDay,
  useSimulateRun,
} from "../../hooks/useApi";

export function WorldResetPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  apiKey?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ffDays, setFfDays] = useState(10);
  const [ffScenario, setFfScenario] = useState<"operate" | "bootstrap">("operate");
  const [launchedRunId, setLaunchedRunId] = useState<string | null>(null);
  const resetWorld = useResetWorld();
  const advanceDay = useAdvanceDay();
  const simulateRun = useSimulateRun();
  const { data: simDay } = useSimulationDay();

  const handleFastForward = () => {
    setLaunchedRunId(null);
    simulateRun.mutate(
      { shop_id: 1001, days: ffDays, scenario_id: ffScenario },
      {
        onSuccess: (data) => {
          onSuccess(`Simulation complete — ${ffDays} days → ${data.run_id}`);
          setLaunchedRunId(data.run_id);
        },
        onError: (err) =>
          onError(err instanceof Error ? err.message : "Simulation failed"),
      },
    );
  };

  return (
    <div className="tech-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <ArrowCounterClockwise size={14} weight="duotone" className="text-rose" />
        <span className="font-pixel-grid text-[10px] text-rose uppercase tracking-widest">
          World State
        </span>
      </div>

      <div className="flex items-center gap-3 mb-5">
        {/* Advance Day */}
        <button
          type="button"
          onClick={() =>
            advanceDay.mutate(undefined, {
              onSuccess: () => onSuccess(`Day ${(simDay?.day ?? 0) + 1} advanced`),
              onError: () => onError("Day advance failed"),
            })
          }
          disabled={advanceDay.isPending}
          className="flex cursor-pointer items-center gap-2 bg-orange px-4 py-2.5 text-sm font-semibold text-white transition-[box-shadow,transform,opacity] hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,112,0,0.3)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {advanceDay.isPending ? (
            <LoadingDots size={4} color="bg-white" />
          ) : (
            <>
              <Play size={13} weight="fill" />
              Advance Day
            </>
          )}
        </button>

        {/* Reset */}
        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex cursor-pointer items-center gap-2 border border-rose/20 bg-rose-dim px-4 py-2.5 text-sm font-semibold text-rose transition-[background-color,border-color,color] hover:bg-rose-subtle hover:border-rose/30"
          >
            <ArrowCounterClockwise size={13} weight="bold" />
            Reset World
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 border-2 border-rose/40 bg-rose-dim animate-card-in">
            <Warning size={14} weight="fill" className="text-rose shrink-0" />
            <span className="text-xs text-rose font-medium">
              This wipes all shops, listings, orders, and reviews.
            </span>
            <button
              type="button"
              onClick={() => {
                resetWorld.mutate(undefined, {
                  onSuccess: () => {
                    onSuccess("World reset to initial state");
                    setConfirmOpen(false);
                  },
                  onError: () => {
                    onError("World reset failed");
                    setConfirmOpen(false);
                  },
                });
              }}
              disabled={resetWorld.isPending}
              className="shrink-0 bg-rose px-3 py-1 text-xs font-bold text-white transition-[filter,transform,opacity] hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {resetWorld.isPending ? (
                <LoadingDots size={3} color="bg-white" />
              ) : (
                "Confirm"
              )}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="text-muted hover:text-ink text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Fast-forward */}
      <div className="border-t border-rule pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightning size={14} weight="duotone" className="text-orange" />
          <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
            Fast-forward
          </span>
        </div>
        <p className="text-xs text-muted mb-3">
          Run demand simulation only (no agent) for N days. Creates a baseline run.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-secondary uppercase tracking-wider">Days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={ffDays}
              onChange={(e) => setFfDays(Math.max(1, Number(e.target.value)))}
              className="bg-base border border-rule px-2 py-1.5 text-sm text-ink font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-secondary uppercase tracking-wider">Scenario</span>
            <select
              value={ffScenario}
              onChange={(e) => setFfScenario(e.target.value as "operate" | "bootstrap")}
              className="bg-base border border-rule px-2 py-1.5 text-sm text-ink font-mono"
            >
              <option value="operate">operate</option>
              <option value="bootstrap">bootstrap</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleFastForward}
            disabled={simulateRun.isPending}
            className="flex cursor-pointer items-center gap-2 bg-orange px-4 py-2 text-sm font-semibold text-white transition-[box-shadow,transform,opacity] hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,112,0,0.3)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simulateRun.isPending ? (
              <LoadingDots size={4} color="bg-white" />
            ) : (
              <>
                <Lightning size={14} weight="fill" />
                Simulate
              </>
            )}
          </button>

          {launchedRunId && (
            <Link
              to={`/runs/${encodeURIComponent(launchedRunId)}`}
              className="text-sm text-orange hover:text-orange-dark font-medium transition-colors"
            >
              View run &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
