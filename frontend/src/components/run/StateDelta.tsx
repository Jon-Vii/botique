import { ArrowRight } from "@phosphor-icons/react";
import type { ShopStateSnapshot } from "../../types/runs";

type SnapshotLike = ShopStateSnapshot | { available_balance: number; active_listing_count: number; draft_listing_count: number; total_sales_count: number; review_average: number; review_count: number; [key: string]: unknown };

function DeltaCell({
  label,
  before,
  after,
  format = "number",
}: {
  label: string;
  before: number;
  after: number;
  format?: "number" | "currency";
}) {
  const delta = after - before;
  const changed = delta !== 0;

  const fmt = (v: number) =>
    format === "currency" ? `$${v.toFixed(2)}` : String(v);

  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="text-secondary num">{fmt(before)}</span>
        <ArrowRight size={8} className="text-muted" />
        <span className={`num font-semibold ${changed ? (delta > 0 ? "text-emerald" : "text-rose") : "text-ink"}`}>
          {fmt(after)}
        </span>
        {changed && (
          <span className={`text-[10px] ${delta > 0 ? "text-emerald" : "text-rose"}`}>
            ({delta > 0 ? "+" : ""}{format === "currency" ? `$${delta.toFixed(2)}` : delta})
          </span>
        )}
      </div>
    </div>
  );
}

export function StateDelta({
  before,
  after,
  nextDay,
}: {
  before: SnapshotLike;
  after: SnapshotLike;
  nextDay: SnapshotLike | null;
}) {
  return (
    <div className="tech-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-1 border-b border-rule">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
          Business Deltas
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-rule/30">
        <DeltaCell
          label="Cash"
          before={before.available_balance}
          after={nextDay ? nextDay.available_balance : after.available_balance}
          format="currency"
        />
        <DeltaCell
          label="Active Listings"
          before={before.active_listing_count}
          after={after.active_listing_count}
        />
        <DeltaCell
          label="Drafts"
          before={before.draft_listing_count}
          after={after.draft_listing_count}
        />
        <DeltaCell
          label="Total Sales"
          before={before.total_sales_count}
          after={nextDay ? nextDay.total_sales_count : after.total_sales_count}
        />
        <DeltaCell
          label="Reviews"
          before={before.review_count}
          after={after.review_count}
        />
      </div>
    </div>
  );
}
