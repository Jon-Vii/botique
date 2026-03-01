import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  icon,
  accent,
  secondary,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: "orange" | "amber" | "emerald" | "rose" | "sky" | "teal" | "violet";
  secondary?: string;
}) {
  const accentMap = {
    orange: "text-orange",
    amber: "text-amber",
    emerald: "text-emerald",
    rose: "text-rose",
    sky: "text-sky",
    teal: "text-teal",
    violet: "text-violet",
  };

  return (
    <div className="tech-card p-4">
      <div className="flex items-center gap-1.5 text-muted text-[10px] font-mono font-semibold uppercase tracking-wider mb-2">
        {icon}
        {label}
      </div>
      <div
        className={`num text-2xl font-bold ${accent ? accentMap[accent] : "text-ink"}`}
      >
        {value}
      </div>
      {secondary && (
        <div className="mt-1 text-[10px] font-mono text-muted">{secondary}</div>
      )}
    </div>
  );
}
