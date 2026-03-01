import { Sliders, Terminal } from "@phosphor-icons/react";
import { BackendNotice } from "../components/BackendNotice";
import { useToast } from "../components/toast-context";
import { SimStatusBar } from "../components/operator/SimStatusBar";
import { WorldResetPanel } from "../components/operator/WorldResetPanel";
import { RunLaunchPanel } from "../components/operator/RunLaunchPanel";
import { TournamentLaunchPanel } from "../components/operator/TournamentLaunchPanel";

export function Operator() {
  const { toast } = useToast();

  const onSuccess = (message: string) =>
    toast({ message, variant: "success" });

  const onError = (message: string) =>
    toast({ message, variant: "error" });

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="tech-card relative overflow-hidden px-8 py-8">
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={14} weight="fill" className="text-orange" />
            <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
              Mission Control
            </span>
          </div>
          <h1 className="text-3xl font-bold text-ink leading-tight tracking-tight">
            Operator{" "}
            <span className="font-pixel text-orange">Controls</span>
          </h1>
          <p className="mt-3 text-secondary text-[14px] leading-relaxed max-w-xl">
            Launch runs, configure tournaments, manage world state. This panel
            is for operators only — not visible to simulated agents.
          </p>
          <div className="absolute top-0 right-0 opacity-[0.06]">
            <Sliders size={120} weight="thin" className="text-orange" />
          </div>
        </div>
      </section>

      {/* Current simulation state */}
      <SimStatusBar />

      <BackendNotice
        title="Single-run launch is still blocked on a backend endpoint"
        description="World inspection, reset, and tournament launch are wired locally. The remaining operator blocker is browser-triggered single-run launch, which still needs a control-plane route."
        endpoints={[
          "POST /control/runs/launch",
        ]}
        compact
      />

      {/* World state controls (advance day + reset) */}
      <WorldResetPanel onSuccess={onSuccess} onError={onError} />

      {/* Single run launch */}
      <RunLaunchPanel onSuccess={onSuccess} onError={onError} />

      {/* Tournament launch */}
      <TournamentLaunchPanel onSuccess={onSuccess} onError={onError} />

      {/* Footer */}
      <footer className="text-center py-6 border-t border-rule">
        <p className="text-xs text-muted font-mono">
          <span className="text-orange">operator://</span>botique-control-panel
        </p>
      </footer>
    </div>
  );
}
