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
          onClick={() =>
            advanceDay.mutate(undefined, {
              onSuccess: () => onSuccess(`Day ${(simDay?.day ?? 0) + 1} advanced`),
              onError: () => onError("Day advance failed"),
            })
          }
          disabled={advanceDay.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange text-white text-sm font-semibold hover:shadow-[0_0_20px_rgba(255,112,0,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
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
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-rose/20 bg-rose-dim text-rose text-sm font-semibold hover:bg-rose-subtle hover:border-rose/30 transition-all cursor-pointer"
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
              className="px-3 py-1 bg-rose text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {resetWorld.isPending ? (
                <LoadingDots size={3} color="bg-white" />
              ) : (
                "Confirm"
              )}
            </button>
            <button
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
