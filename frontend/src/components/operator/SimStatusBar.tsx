import { Cpu, Package, Storefront, ShoppingCart, Star } from "@phosphor-icons/react";
import { useSimulationDay, useMarketSnapshot, useWorldState } from "../../hooks/useApi";

export function SimStatusBar() {
  const { data: simDay } = useSimulationDay();
  const { data: snapshot } = useMarketSnapshot();
  const { data: world } = useWorldState();

  const orderCount = world?.marketplace.orders.length ?? 0;
  const reviewCount = world?.marketplace.reviews.length ?? 0;

  return (
    <div className="tech-card px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu size={12} weight="duotone" className="text-orange" />
        <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
          Current State
        </span>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        {/* Day */}
        <div className="flex items-center gap-2">
          <div className="animate-pulse-glow w-10 h-10 flex items-center justify-center border-2 border-orange/20 bg-orange-50">
            <span className="font-pixel text-lg text-orange leading-none">
              {simDay?.day ?? "?"}
            </span>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
              Sim Day
            </div>
            <div className="text-xs font-mono text-secondary">
              {simDay?.date ?? "--"}
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-rule" />

        {/* Shops */}
        <div className="flex items-center gap-1.5">
          <Storefront size={14} weight="duotone" className="text-orange" />
          <span className="num text-lg font-bold text-ink">
            {snapshot?.active_shop_count ?? 0}
          </span>
          <span className="text-xs text-muted">shops</span>
        </div>

        {/* Listings */}
        <div className="flex items-center gap-1.5">
          <Package size={14} weight="duotone" className="text-emerald" />
          <span className="num text-lg font-bold text-ink">
            {snapshot?.active_listing_count ?? 0}
          </span>
          <span className="text-xs text-muted">listings</span>
        </div>

        {/* Orders */}
        <div className="flex items-center gap-1.5">
          <ShoppingCart size={14} weight="duotone" className="text-violet" />
          <span className="num text-lg font-bold text-ink">
            {orderCount}
          </span>
          <span className="text-xs text-muted">orders</span>
        </div>

        {/* Reviews */}
        <div className="flex items-center gap-1.5">
          <Star size={14} weight="duotone" className="text-amber" />
          <span className="num text-lg font-bold text-ink">
            {reviewCount}
          </span>
          <span className="text-xs text-muted">reviews</span>
        </div>
      </div>
    </div>
  );
}
