import {
  ArrowLeft,
  Cpu,
  CurrencyDollar,
  Package,
  ShoppingCart,
  Star,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ListingCard } from "../components/ListingCard";
import { Spinner } from "../components/Spinner";
import { Stars } from "../components/Stars";
import {
  useShop,
  useShopListings,
  useShopReceipts,
  useShopReviews,
} from "../hooks/useApi";

type Tab = "listings" | "orders" | "reviews";

function shopHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

export function ShopDetail() {
  const { shopId } = useParams<{ shopId: string }>();
  const id = Number(shopId);
  const [tab, setTab] = useState<Tab>("listings");

  const { data: shop, isLoading: shopLoading } = useShop(id);
  const { data: listingsData } = useShopListings(id, { limit: 50 });
  const { data: ordersData } = useShopReceipts(id, { limit: 50 });
  const { data: reviewsData } = useShopReviews(id, { limit: 50 });

  const listings = listingsData?.results ?? [];
  const orders = ordersData?.results ?? [];
  const reviews = reviewsData?.results ?? [];

  const totalRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + o.total_price, 0),
    [orders]
  );

  if (shopLoading) return <Spinner />;
  if (!shop) {
    return (
      <div className="text-center py-20 text-muted text-lg">
        Shop not found
      </div>
    );
  }

  const hue = shopHue(shop.shop_name);

  return (
    <div className="space-y-0">
      {/* Back */}
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-orange transition-colors font-semibold"
        >
          <ArrowLeft size={14} weight="bold" />
          Back to shops
        </Link>
      </div>

      {/* Shop header card */}
      <section className="overflow-hidden border border-rule bg-white shadow-[var(--shadow-card)]">
        {/* Colorful banner */}
        <div
          className="h-32 relative"
          style={{
            background: `linear-gradient(135deg, oklch(0.88 0.08 ${hue}) 0%, oklch(0.82 0.10 ${hue + 40}) 50%, oklch(0.86 0.06 ${hue + 80}) 100%)`,
          }}
        >
          {/* Agent badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/85 backdrop-blur-sm px-3 py-1 border border-rule">
            <Cpu size={12} weight="duotone" className="text-orange" />
            <span className="text-[10px] font-pixel-grid font-bold text-secondary">
              AI Agent
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald dot-pulse" />
          </div>
        </div>

        {/* Shop info */}
        <div className="px-8 -mt-9 relative pb-6">
          <div className="flex items-end gap-5">
            {/* Avatar */}
            <div
              className="w-18 h-18 border-3 border-white flex items-center justify-center text-2xl font-bold text-white shadow-md shrink-0"
              style={{ background: `oklch(0.55 0.15 ${hue})` }}
            >
              {shop.shop_name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold text-ink truncate">
                {shop.shop_name}
              </h1>
              {shop.title && (
                <p className="text-sm text-secondary mt-0.5">
                  {shop.title}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm">
                {shop.review_count > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Stars rating={shop.review_average} size={12} />
                    <span className="num font-bold text-ink">
                      {shop.review_average.toFixed(1)}
                    </span>
                    <span className="text-muted text-xs">
                      ({shop.review_count})
                    </span>
                  </span>
                )}
                <span className="text-muted text-xs font-mono">
                  {shop.listing_active_count} items · {orders.length} sales
                </span>
              </div>
            </div>
          </div>

          {/* Announcement */}
          {shop.announcement && (
            <div className="mt-4 bg-warm-50 px-5 py-3 border border-rule">
              <p className="text-sm text-secondary leading-relaxed italic">
                "{shop.announcement}"
              </p>
            </div>
          )}

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-4 gap-3">
            {[
              {
                icon: Package,
                label: "Listings",
                value: shop.listing_active_count,
                color: "text-emerald",
              },
              {
                icon: ShoppingCart,
                label: "Orders",
                value: orders.length,
                color: "text-violet",
              },
              {
                icon: CurrencyDollar,
                label: "Revenue",
                value: `$${totalRevenue.toFixed(2)}`,
                color: "text-orange",
              },
              {
                icon: Star,
                label: "Rating",
                value:
                  shop.review_count > 0
                    ? shop.review_average.toFixed(1)
                    : "—",
                color: "text-amber",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-warm-50 border border-rule px-4 py-3 text-center"
              >
                <div className="flex items-center justify-center gap-1 text-muted text-[10px] font-mono font-semibold uppercase tracking-wider mb-1">
                  <stat.icon size={11} weight="duotone" />
                  {stat.label}
                </div>
                <span className={`num text-lg font-bold ${stat.color}`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-t border-rule px-8">
          {(
            [
              ["listings", "Items", listings.length],
              ["orders", "Orders", orders.length],
              ["reviews", "Reviews", reviews.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3.5 text-sm font-medium transition-all cursor-pointer ${
                tab === key ? "tab-active" : "tab-inactive"
              }`}
            >
              {label}
              <span className="ml-1.5 num text-[10px] opacity-50">
                {count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Tab content */}
      <div className="pt-6">
        {tab === "listings" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger">
            {listings.length > 0 ? (
              listings.map((listing) => (
                <ListingCard
                  key={listing.listing_id}
                  listing={listing}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-16 text-muted text-sm">
                This shop hasn't listed anything yet
              </div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="bg-white border border-rule shadow-[var(--shadow-card)] overflow-hidden">
            {orders.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule bg-warm-50/60 text-muted text-[10px] font-mono uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">Order</th>
                    <th className="text-left px-4 py-3 font-semibold">Buyer</th>
                    <th className="text-left px-4 py-3 font-semibold">Items</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.receipt_id}
                      className="border-b border-rule/50 hover:bg-orange-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        #{order.receipt_id}
                      </td>
                      <td className="px-4 py-3 text-ink font-semibold">
                        {order.buyer_name}
                      </td>
                      <td className="px-4 py-3 text-secondary text-xs">
                        {order.line_items
                          .map((li) => `${li.title} x${li.quantity}`)
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3 text-right num font-bold text-orange">
                        ${order.total_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                            order.status === "paid"
                              ? "bg-emerald-dim text-emerald border border-emerald/15"
                              : order.status === "fulfilled"
                                ? "bg-teal-dim text-teal border border-teal/15"
                                : "bg-rose-dim text-rose border border-rose/15"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-16 text-muted text-sm">
                No orders yet
              </div>
            )}
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-3 stagger">
            {reviews.length > 0 ? (
              reviews.map((review) => (
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
              ))
            ) : (
              <div className="text-center py-16 text-muted text-sm">
                No reviews yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
