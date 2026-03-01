import { useState } from "react";
import {
  CaretDown,
  CaretRight,
  CurrencyDollar,
  Crosshair,
  Tag,
  TrendUp,
  ShoppingCart,
  Sun,
} from "@phosphor-icons/react";
import { Badge } from "../Badge";
import type { DayBriefing } from "../../types/runs";

function Section({
  title,
  icon,
  defaultOpen = false,
  children,
  count,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-rule/50 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full py-2.5 text-left cursor-pointer group"
      >
        {open ? (
          <CaretDown size={10} className="text-muted" />
        ) : (
          <CaretRight size={10} className="text-muted" />
        )}
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted group-hover:text-ink transition-colors">
          {icon} {title}
        </span>
        {count != null && count > 0 && (
          <Badge variant="gray" subtle className="ml-auto">
            {count}
          </Badge>
        )}
      </button>
      {open && <div className="pb-3 pl-5">{children}</div>}
    </div>
  );
}

export function BriefingPanel({ briefing }: { briefing: DayBriefing }) {
  return (
    <div className="tech-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-1">
        <Sun size={12} weight="duotone" className="text-amber" />
        Morning Briefing
        <span className="text-[9px] text-muted ml-2">
          {briefing.shop_name}
        </span>
      </div>

      {/* Balance */}
      <Section
        title="Balance"
        icon={<CurrencyDollar size={10} weight="bold" className="inline text-emerald" />}
        defaultOpen
      >
        <div className="flex items-center gap-4 text-sm font-mono">
          <span>
            Available:{" "}
            <span className="num font-semibold text-ink">
              ${briefing.balance_summary.available.toFixed(2)}
            </span>
          </span>
          {briefing.balance_summary.pending > 0 && (
            <span className="text-muted">
              Pending: ${briefing.balance_summary.pending.toFixed(2)}
            </span>
          )}
        </div>
      </Section>

      {/* Objective */}
      <Section
        title="Objective"
        icon={<Crosshair size={10} weight="bold" className="inline text-orange" />}
        defaultOpen
      >
        <p className="text-sm text-ink leading-relaxed mb-2">
          {briefing.objective_progress.status_summary}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {briefing.objective_progress.supporting_diagnostics.map((d, i) => (
            <span
              key={i}
              className="text-[10px] font-mono text-muted bg-gray-1 border border-rule px-2 py-0.5"
            >
              {d}
            </span>
          ))}
        </div>
      </Section>

      {/* Listing Changes */}
      <Section
        title="Listing Changes"
        icon={<Tag size={10} weight="bold" className="inline text-teal" />}
        count={briefing.listing_changes.length}
      >
        {briefing.listing_changes.length === 0 ? (
          <span className="text-xs text-muted">No changes</span>
        ) : (
          <div className="space-y-1.5">
            {briefing.listing_changes.map((lc) => (
              <div
                key={lc.listing_id}
                className="flex items-center gap-3 text-xs font-mono"
              >
                <Badge variant={lc.state === "active" ? "emerald" : "gray"} subtle>
                  {lc.state}
                </Badge>
                <span className="text-ink truncate" title={lc.title}>
                  {lc.title}
                </span>
                {lc.orders_delta > 0 && (
                  <span className="text-emerald">+{lc.orders_delta} order{lc.orders_delta > 1 ? "s" : ""}</span>
                )}
                {lc.revenue_delta > 0 && (
                  <span className="text-amber">${lc.revenue_delta.toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Market Movements */}
      <Section
        title="Market Movements"
        icon={<TrendUp size={10} weight="bold" className="inline text-violet" />}
        count={briefing.market_movements.length}
      >
        {briefing.market_movements.map((m, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs mb-2 last:mb-0"
          >
            <Badge
              variant={m.urgency === "high" ? "rose" : m.urgency === "watch" ? "amber" : "gray"}
              subtle
            >
              {m.urgency}
            </Badge>
            <div>
              <span className="font-semibold text-ink">{m.headline}</span>
              <p className="text-muted text-[11px] mt-0.5">{m.summary}</p>
            </div>
          </div>
        ))}
      </Section>

      {/* Yesterday's Orders */}
      <Section
        title="Yesterday's Orders"
        icon={<ShoppingCart size={10} weight="bold" className="inline text-amber" />}
      >
        <div className="flex items-center gap-4 text-xs font-mono">
          <span>
            Orders:{" "}
            <span className="num font-semibold text-ink">
              {briefing.yesterday_orders.order_count}
            </span>
          </span>
          <span>
            Revenue:{" "}
            <span className="num font-semibold text-emerald">
              ${briefing.yesterday_orders.revenue.toFixed(2)}
            </span>
          </span>
          {briefing.yesterday_orders.average_order_value > 0 && (
            <span className="text-muted">
              AOV: ${briefing.yesterday_orders.average_order_value.toFixed(2)}
            </span>
          )}
        </div>
      </Section>
    </div>
  );
}
