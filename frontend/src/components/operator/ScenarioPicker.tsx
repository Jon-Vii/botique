import { Badge } from "../Badge";
import { SCENARIO_OPTIONS } from "../../lib/scenarios";
import type { ScenarioId } from "../../types/api";

const toneStyles = {
  orange: {
    selected:
      "border-orange/35 bg-orange-1 shadow-[0_0_0_1px_rgba(255,112,0,0.08),0_14px_32px_rgba(255,112,0,0.08)]",
    hover: "hover:border-orange/20 hover:bg-orange-1/50",
    text: "text-orange",
  },
  violet: {
    selected:
      "border-violet/30 bg-violet-subtle shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_14px_32px_rgba(139,92,246,0.08)]",
    hover: "hover:border-violet/20 hover:bg-violet-subtle/70",
    text: "text-violet",
  },
} as const;

export function ScenarioPicker({
  value,
  onChange,
  tone,
  label = "Scenario",
  disabled = false,
}: {
  value: ScenarioId;
  onChange: (scenarioId: ScenarioId) => void;
  tone: keyof typeof toneStyles;
  label?: string;
  disabled?: boolean;
}) {
  const palette = toneStyles[tone];

  return (
    <div className="space-y-2.5">
      <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
        {label}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {SCENARIO_OPTIONS.map((option) => {
          const selected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              disabled={disabled}
              aria-pressed={selected}
              className={`group rounded-[3px] border px-3 py-3 text-left transition-[border-color,background-color,box-shadow,transform,opacity] ${
                selected ? palette.selected : `border-rule bg-white ${palette.hover}`
              } ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:-translate-y-[1px]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      selected ? palette.text : "text-ink"
                    }`}
                  >
                    {option.label}
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-muted">
                    {option.cue}
                  </div>
                </div>
                <Badge
                  variant={option.variant}
                  subtle={!selected}
                >
                  {option.id}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-secondary">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
