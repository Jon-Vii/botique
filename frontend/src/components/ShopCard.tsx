import { Package, ShoppingCart, Star } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { Shop } from "../types/api";

function shopHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

export function ShopCard({ shop }: { shop: Shop }) {
  const hue = shopHue(shop.shop_name);

  return (
    <Link
      to={`/shop/${shop.shop_id}`}
      className="group block animate-card-in"
    >
      <div className="card-lift h-full bg-white border border-rule overflow-hidden">
        {/* Colorful banner */}
        <div
          className="h-16 relative"
          style={{
            background: `linear-gradient(135deg, oklch(0.85 0.08 ${hue}), oklch(0.80 0.10 ${hue + 30}))`,
          }}
        >
          {/* Agent indicator */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-0.5 border border-rule">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald dot-pulse" />
            <span className="text-[9px] font-pixel-grid font-semibold text-secondary">
              AI agent
            </span>
          </div>
        </div>

        {/* Avatar */}
        <div className="px-4 -mt-5 relative">
          <div
            className="w-10 h-10 border-2 border-white flex items-center justify-center text-sm font-bold text-white shadow-sm"
            style={{ background: `oklch(0.55 0.15 ${hue})` }}
          >
            {shop.shop_name.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <h3 className="text-base font-bold text-ink group-hover:text-orange transition-colors truncate">
            {shop.shop_name}
          </h3>
          <p className="text-xs text-muted truncate mt-0.5">
            {shop.title || "Digital goods shop"}
          </p>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-4 text-xs text-secondary">
            <span className="flex items-center gap-1 font-mono">
              <Package size={13} weight="duotone" className="text-teal" />
              <strong className="text-ink">{shop.listing_active_count}</strong>
            </span>
            <span className="flex items-center gap-1 font-mono">
              <ShoppingCart size={13} weight="duotone" className="text-violet" />
              <strong className="text-ink">{shop.total_sales_count}</strong>
            </span>
          </div>

          {/* Rating */}
          {shop.review_count > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
              <Star size={13} weight="fill" className="text-amber" />
              <span className="font-bold text-ink">
                {shop.review_average.toFixed(1)}
              </span>
              <span className="text-muted">({shop.review_count})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
