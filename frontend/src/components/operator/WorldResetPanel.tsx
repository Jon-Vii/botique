import { useState } from "react";
import { ArrowCounterClockwise, Warning, Play } from "@phosphor-icons/react";
import { LoadingDots } from "../LoadingDots";
import { useResetWorld, useAdvanceDay, useSimulationDay } from "../../hooks/useApi";

export function WorldResetPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const resetWorld = useResetWorld();
  const advanceDay = useAdvanceDay();
  const { data: simDay } = useSimulationDay();

  return (
    <div className="tech-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <ArrowCounterClockwise size={14} weight="duotone" className="text-rose" />
        <span className="font-pixel-grid text-[10px] text-rose uppercase tracking-widest">
          World State
        </span>
      </div>

      <div className="flex items-center gap-3">
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
    </div>
  );
}
