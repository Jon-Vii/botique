import { Lightning, CurrencyDollar } from "@phosphor-icons/react";
import type { DaySnapshot } from "../../types/api";
import { formatDateShort } from "../../lib/format";

type DayTimelineEntry = DaySnapshot & {
  turn_count?: number;
  yesterday_revenue?: number;
};

export function DayTimeline({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: DayTimelineEntry[];
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
          const turnCount = d.turn_count ?? null;
          const hasRevenue = (d.yesterday_revenue ?? 0) > 0;

          return (
            <button
              key={d.day}
              type="button"
              onClick={() => onSelectDay(d.day)}
              aria-pressed={active}
              className={`
                relative flex flex-col items-center gap-1 px-4 py-3 min-w-[72px]
                border font-mono text-xs transition-[background-color,border-color,color,box-shadow] duration-200
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
                {formatDateShort(d.simulation_date)}
              </span>

              {/* Quick indicators */}
              <div className="mt-0.5 flex items-center gap-1.5">
                {turnCount !== null ? (
                  <span className="flex items-center gap-0.5 text-[9px]" title={`${turnCount} turns`}>
                    <Lightning size={9} weight="fill" className={active ? "text-orange" : "text-amber"} />
                    {turnCount}
                  </span>
                ) : null}
                {hasRevenue && (
                  <span className="flex items-center gap-0.5 text-[9px] text-emerald" title={`$${d.yesterday_revenue?.toFixed(2)}`}>
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
