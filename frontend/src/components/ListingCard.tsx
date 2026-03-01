import { Cpu, Heart } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Badge } from "./Badge";
import { StatusDot } from "./StatusDot";
import { getProductEmoji, getProductGradient } from "../lib/product-visual";
import type { Listing } from "../types/api";

export function ListingCard({ listing }: { listing: Listing }) {
  const gradient = getProductGradient(listing.tags, listing.type);
  const emoji = getProductEmoji(listing.tags, listing.type);

  return (
    <Link
      to={`/listing/${listing.listing_id}`}
      className="group block animate-card-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <div className="tech-card card-lift overflow-hidden">
        {/* Product visual */}
        <div
          className="product-visual aspect-square flex items-center justify-center relative"
          style={{ background: gradient }}
        >
          {/* Blueprint grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-orange) 1px, transparent 1px), linear-gradient(90deg, var(--color-orange) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              opacity: 0.07,
            }}
          />

          {/* Type badge — active listings only */}
          {listing.state === "active" && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[9px] font-pixel-grid font-bold uppercase tracking-wider px-2 py-0.5 bg-white/70 backdrop-blur-sm text-secondary border border-rule">
                {listing.type}
              </span>
            </div>
          )}

          {/* State badge — non-active listings */}
          {listing.state !== "active" && (
            <div className="absolute top-2.5 left-2.5">
              <Badge
                variant={
                  listing.state === "draft"
                    ? "teal"
                    : listing.state === "sold_out"
                      ? "rose"
                      : "gray"
                }
              >
                {listing.state.replace("_", " ")}
              </Badge>
            </div>
          )}

          {/* Emoji in frosted disc */}
          <span className="relative z-10 w-20 h-20 flex items-center justify-center bg-white/30 backdrop-blur-sm rounded-full group-hover:scale-115 transition-transform duration-300">
            <span className="text-5xl drop-shadow-sm">{emoji}</span>
          </span>

          {/* Favorite heart */}
          <div className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:scale-110 border border-rule">
            <Heart size={14} weight="duotone" className="text-rose" />
          </div>

          {/* Listing ID watermark */}
          <span className="absolute bottom-1.5 right-2 font-pixel text-[10px] text-orange/20">
            #{listing.listing_id}
          </span>
        </div>

        {/* Info */}
        <div className="p-3 border-t border-rule">
          {/* AI Product eyebrow */}
          <div className="flex items-center gap-1 mb-1">
            <Cpu size={10} weight="duotone" className="text-orange" />
            <span className="font-pixel-grid text-[9px] text-orange tracking-wider">
              AI Product
            </span>
          </div>

          <p className="text-[10px] font-mono text-muted mb-0.5 tracking-wide">
            {listing.shop_name}
          </p>
          <h3 className="font-body text-[13px] font-semibold text-ink leading-snug line-clamp-2 group-hover:text-orange transition-colors">
            {listing.title}
          </h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="num text-lg font-bold text-orange flex items-center gap-1.5">
              ${listing.price.toFixed(2)}
              {listing.state === "active" && <StatusDot state="active" />}
            </span>
            {listing.favorites > 0 && (
              <span className="text-[10px] text-muted flex items-center gap-0.5 font-mono">
                <Heart size={10} weight="fill" className="text-rose" />
                {listing.favorites}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
