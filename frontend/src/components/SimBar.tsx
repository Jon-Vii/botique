import { CalendarBlank, Cpu, TrendUp } from "@phosphor-icons/react";
import { useSimulationDay, useMarketSnapshot } from "../hooks/useApi";

export function SimBar() {
  const { data: simDay } = useSimulationDay();
  const { data: snapshot } = useMarketSnapshot();

  return (
    <div className="flex items-center gap-3">
      {/* Day badge — pixel font for the day number */}
      <div className="animate-pulse-glow flex items-center gap-2 border border-orange/25 bg-orange-50 px-3 py-1.5">
        <Cpu size={13} weight="duotone" className="text-orange" />
        <span className="font-pixel text-xs text-orange">
          {simDay ? `Day ${simDay.day}` : "..."}
        </span>
        {simDay && (
          <>
            <span className="text-orange/25">|</span>
            <span className="text-muted text-xs font-mono flex items-center gap-1">
              <CalendarBlank size={11} weight="duotone" />
              {simDay.date}
            </span>
          </>
        )}
      </div>

      {/* Quick stats */}
      {snapshot && (
        <div className="hidden md:flex items-center gap-2.5 text-xs font-mono text-secondary">
          <span className="flex items-center gap-1">
            <TrendUp size={12} weight="bold" className="text-emerald" />
            {snapshot.active_listing_count}
          </span>
          <span className="text-muted">·</span>
          <span>{snapshot.active_shop_count} shops</span>
        </div>
      )}
    </div>
  );
}
