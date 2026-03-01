import {
  ArrowLeft,
  Calendar,
  Eye,
  Heart,
  Lightning,
  Storefront,
  Tag,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Snippet } from "../components/Snippet";
import { Stars } from "../components/Stars";
import { StatusDot } from "../components/StatusDot";
import {
  getProductEmoji,
  getProductGradient,
} from "../lib/product-visual";
import { useListing, useShop, useShopReviews } from "../hooks/useApi";

export function ListingDetail() {
  const { listingId } = useParams<{ listingId: string }>();
  const id = Number(listingId);

  const { data: listing, isLoading } = useListing(id);
  const { data: shop } = useShop(listing?.shop_id ?? 0);
  const { data: reviewsData } = useShopReviews(listing?.shop_id ?? 0, {
    limit: 50,
  });

  const listingReviews = useMemo(
    () =>
      reviewsData?.results.filter((r) => r.listing_id === id) ?? [],
    [reviewsData, id]
  );

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton width="100px" height="14px" />
        <div className="tech-card p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="aspect-square bg-gray-2 skeleton-shimmer" />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Skeleton height="52px" />
                <Skeleton height="52px" />
                <Skeleton height="52px" />
              </div>
            </div>
            <div className="space-y-5">
              <Skeleton width="140px" height="11px" />
              <Skeleton width="80%" height="24px" />
              <div className="flex items-center justify-between">
                <Skeleton width="64px" height="20px" />
                <Skeleton width="100px" height="32px" />
              </div>
              <Skeleton height="64px" />
              <Skeleton lines={4} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="text-center py-20 text-muted text-lg">
        Listing not found
      </div>
    );
  }

  const gradient = getProductGradient(listing.tags, listing.type);
  const emoji = getProductEmoji(listing.tags, listing.type);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-orange transition-colors font-semibold"
      >
        <ArrowLeft size={14} weight="bold" />
        Marketplace
      </Link>

      {/* Observation record wrapper */}
      <div className="tech-card p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product visual */}
        <div>
          <div
            className="product-visual aspect-square flex items-center justify-center relative border border-rule shadow-[var(--shadow-card)] overflow-hidden"
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

            {/* Scanline overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
              }}
            />

            {/* Emoji in frosted disc */}
            <span className="relative z-10 w-36 h-36 flex items-center justify-center bg-white/30 backdrop-blur-sm rounded-full">
              <span className="text-[100px] drop-shadow-md">{emoji}</span>
            </span>

            {/* Listing ID watermark */}
            <span className="absolute bottom-2 right-3 font-pixel text-sm text-orange/20">
              #{listing.listing_id}
            </span>
          </div>

          {/* Stats grid below visual */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white border border-rule px-3 py-2.5 text-center">
              <Eye size={14} weight="duotone" className="text-teal mx-auto mb-1" />
              <div className="num text-sm font-bold text-ink">{listing.views}</div>
              <div className="text-[9px] font-mono text-muted uppercase tracking-wider">Views</div>
            </div>
            <div className="bg-white border border-rule px-3 py-2.5 text-center">
              <Heart size={14} weight="duotone" className="text-rose mx-auto mb-1" />
              <div className="num text-sm font-bold text-ink">{listing.favorites}</div>
              <div className="text-[9px] font-mono text-muted uppercase tracking-wider">Favorites</div>
            </div>
            <div className="bg-white border border-rule px-3 py-2.5 text-center">
              <Calendar size={14} weight="duotone" className="text-muted mx-auto mb-1" />
              <div className="num text-sm font-bold text-ink">
                {new Date(listing.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <div className="text-[9px] font-mono text-muted uppercase tracking-wider">Created</div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5">
          {/* AI header */}
          <div className="flex items-center gap-2">
            <Lightning size={14} weight="fill" className="text-orange" />
            <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
              AI-Generated Listing
            </span>
            {listing.state === "active" && (
              <StatusDot state="active" />
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-ink leading-snug">
            {listing.title}
          </h1>

          {/* Status + Price row */}
          <div className="flex items-center justify-between">
            <Badge
              variant={
                listing.state === "active"
                  ? "emerald"
                  : listing.state === "draft"
                    ? "teal"
                    : listing.state === "sold_out"
                      ? "rose"
                      : "gray"
              }
            >
              {listing.state.replace("_", " ")}
            </Badge>
            <div className="flex items-baseline gap-2">
              <span className="num text-4xl font-bold text-orange">
                ${listing.price.toFixed(2)}
              </span>
              <span className="text-sm text-muted font-mono">
                {listing.currency_code}
              </span>
            </div>
          </div>

          {/* Shop link */}
          {shop && (
            <Link
              to={`/shop/${shop.shop_id}`}
              className="flex items-center gap-3 p-4 bg-white border border-rule hover:border-orange-5 hover:shadow-[var(--shadow-card-hover)] transition-all group"
            >
              <div className="w-10 h-10 bg-orange-1 flex items-center justify-center border border-orange-4">
                <Storefront
                  size={18}
                  weight="duotone"
                  className="text-orange group-hover:scale-110 transition-transform"
                />
              </div>
              <div>
                <span className="text-sm font-bold text-ink group-hover:text-orange transition-colors">
                  {shop.shop_name}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                  {shop.review_count > 0 && (
                    <>
                      <Stars rating={shop.review_average} size={10} />
                      <span>({shop.review_count})</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{shop.total_sales_count} sales</span>
                </div>
              </div>
            </Link>
          )}

          {/* Tags */}
          {listing.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono font-semibold uppercase tracking-wider mb-2">
                <Tag size={11} weight="duotone" />
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {listing.tags.map((tag) => (
                  <span key={tag} className="tag-pill !bg-white">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-[10px] text-muted font-mono font-semibold uppercase tracking-wider mb-2">
              Description
            </h3>
            <div className="tech-card !shadow-none hover:!border-rule hover:!shadow-none p-5">
              <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Materials */}
          {listing.materials.length > 0 && (
            <div>
              <h3 className="text-[10px] text-muted font-mono font-semibold uppercase tracking-wider mb-2">
                Materials
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {listing.materials.map((mat) => (
                  <span key={mat} className="tag-pill !bg-white">
                    {mat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details grid — renamed labels */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Stock", String(listing.quantity)],
              ["Category", `#${listing.taxonomy_id}`],
              ["Origin", listing.who_made],
              ["Era", listing.when_made],
            ].map(([label, value]) => (
              <div
                key={label}
                className="bg-white border border-rule px-3 py-2.5 flex justify-between items-center"
              >
                <span className="text-muted font-mono text-[10px] uppercase tracking-wider">
                  {label}
                </span>
                <span className="num font-semibold text-ink">{value}</span>
              </div>
            ))}
          </div>

          {/* Simulation Data panel */}
          <Snippet
            label="Simulation Data"
            text={[
              `listing_id  ${listing.listing_id}`,
              `shop_id     ${listing.shop_id}`,
              `created_at  ${new Date(listing.created_at).toISOString().slice(0, 10)}`,
              `rank_score  ${listing.views + listing.favorites * 3}`,
            ]}
            prompt={false}
          />
        </div>
        </div>
      </div>

      {/* Reviews */}
      {listingReviews.length > 0 && (
        <section className="pt-4">
          <h2 className="text-xl font-bold text-ink mb-4">
            Reviews for this listing
          </h2>
          <div className="space-y-3 stagger">
            {listingReviews.map((review) => (
              <div
                key={review.review_id}
                className="animate-card-in bg-white border border-rule shadow-[var(--shadow-card)] p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Stars rating={review.rating} size={13} />
                    <span className="text-sm font-bold text-ink">
                      {review.buyer_name}
                    </span>
                  </div>
                  <span className="text-xs text-muted font-mono">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-secondary leading-relaxed">
                  {review.review}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
