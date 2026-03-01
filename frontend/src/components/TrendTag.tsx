import { TrendUp } from "@phosphor-icons/react";
import type { MarketTrend } from "../types/api";

export function TrendTag({ trend }: { trend: MarketTrend }) {
  const intensity =
    trend.demand_multiplier >= 1.5
      ? "high"
      : trend.demand_multiplier >= 1.0
        ? "medium"
        : "low";

  const styles = {
    high: "border-orange/25 bg-orange-50 text-orange",
    medium: "border-emerald/20 bg-emerald-dim text-emerald",
    low: "border-rule bg-warm-50 text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-mono font-semibold ${styles[intensity]}`}
    >
      <TrendUp size={12} weight="bold" />
      {trend.label}
      <span className="text-[10px] opacity-60">
        {trend.demand_multiplier.toFixed(1)}x
      </span>
    </span>
  );
}
