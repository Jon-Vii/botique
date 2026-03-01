import { Lightning, CurrencyDollar } from "@phosphor-icons/react";
import type { RunDaySummary } from "../../types/runs";

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DayTimeline({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: RunDaySummary[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
}) {
  return (
    <div className="tech-card p-4">
      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-3">
        Day Timeline
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const active = d.day === selectedDay;
          const hasRevenue = d.yesterday_revenue > 0;

          return (
            <button
              key={d.day}
              onClick={() => onSelectDay(d.day)}
              className={`
                relative flex flex-col items-center gap-1 px-4 py-3 min-w-[72px]
                border font-mono text-xs transition-all duration-200 cursor-pointer
                ${active
                  ? "border-orange/30 bg-orange-50 text-orange shadow-glow"
                  : "border-rule bg-white text-secondary hover:border-gray-5 hover:bg-gray-1"
                }
              `}
            >
              {/* Day number */}
              <span className={`text-base font-bold num ${active ? "text-orange" : "text-ink"}`}>
                {d.day}
              </span>

              {/* Date */}
              <span className="text-[9px] text-muted whitespace-nowrap">
                {fmtShortDate(d.simulation_date)}
              </span>

              {/* Quick indicators */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="flex items-center gap-0.5 text-[9px]" title={`${d.turn_count} turns`}>
                  <Lightning size={9} weight="fill" className={active ? "text-orange" : "text-amber"} />
                  {d.turn_count}
                </span>
                {hasRevenue && (
                  <span className="flex items-center gap-0.5 text-[9px] text-emerald" title={`$${d.yesterday_revenue}`}>
                    <CurrencyDollar size={9} weight="bold" />
                  </span>
                )}
              </div>

              {/* Active indicator bar */}
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
