import {
  ArrowLeft,
  CurrencyDollar,
  Package,
  ShoppingCart,
  Star,
} from "@phosphor-icons/react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "../components/Badge";
import { ListingCard } from "../components/ListingCard";
import { ShopRoleBadge } from "../components/ShopRoleBadge";
import { Skeleton } from "../components/Skeleton";
import { Stars } from "../components/Stars";
import { formatCurrency, formatDateShort } from "../lib/format";
import {
  useShop,
  useShopListings,
  useShopReceipts,
  useShopReviews,
  useWorldState,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "orders" || tabParam === "reviews" ? tabParam : "listings";

  const { data: shop, isLoading: shopLoading } = useShop(id);
  const { data: world } = useWorldState();
  const { data: listingsData } = useShopListings(id, { limit: 50 });
  const { data: ordersData } = useShopReceipts(id, { limit: 50 });
  const { data: reviewsData } = useShopReviews(id, { limit: 50 });

  const listings = listingsData?.results ?? [];
  const orders = ordersData?.results ?? [];
  const reviews = reviewsData?.results ?? [];
  const listingCount = listingsData?.count ?? listings.length;
  const orderCount = ordersData?.count ?? orders.length;
  const reviewCount = reviewsData?.count ?? reviews.length;

  const totalRevenue = orders.reduce((sum, order) => sum + order.total_price, 0);

  if (shopLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton width="100px" height="14px" />
        <div className="tech-card overflow-hidden">
          <div className="h-32 skeleton-shimmer" />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton circle height="56px" />
              <div className="space-y-2 flex-1">
                <Skeleton width="180px" height="20px" />
                <Skeleton width="120px" height="12px" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Skeleton height="48px" />
              <Skeleton height="48px" />
              <Skeleton height="48px" />
              <Skeleton height="48px" />
            </div>
          </div>
        </div>
      </div>
    );
  }
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
          <ShopRoleBadge
            shopId={shop.shop_id}
            scenario={world?.simulation.scenario}
            className="absolute top-3 right-3 border-white/60 bg-white/85 backdrop-blur-sm"
          />
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
                  {shop.listing_active_count} items · {shop.total_sales_count} sales
                </span>
              </div>
            </div>
          </div>

          {/* Announcement */}
          {shop.announcement && (
            <div className="mt-4 bg-gray-2 px-5 py-3 border border-rule">
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
                value: shop.total_sales_count,
                color: "text-violet",
              },
              {
                icon: CurrencyDollar,
                label: "Revenue",
                value: formatCurrency(totalRevenue, shop.currency_code),
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
                className="bg-white border border-rule px-4 py-3 text-center"
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
        <div className="flex gap-0 border-t border-rule px-8" role="tablist" aria-label="Shop detail sections">
          {(
            [
              ["listings", "Items", listingCount],
              ["orders", "Orders", orderCount],
              ["reviews", "Reviews", reviewCount],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (key === "listings") next.delete("tab");
                else next.set("tab", key);
                setSearchParams(next, { replace: true });
              }}
              className={`px-5 py-3.5 text-sm font-medium transition-[background-color,border-color,color] ${
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
              <table className="geist-table geist-table-striped">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Buyer</th>
                    <th>Items</th>
                    <th align="right">Total</th>
                    <th align="right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.receipt_id}>
                      <td className="font-mono text-xs text-muted">
                        #{order.receipt_id}
                      </td>
                      <td className="text-ink font-semibold">
                        {order.buyer_name}
                      </td>
                      <td className="text-secondary text-xs">
                        {order.line_items
                          .map((li) => `${li.title} x${li.quantity}`)
                          .join(", ")}
                      </td>
                      <td className="text-right num font-bold text-orange">
                        {formatCurrency(order.total_price, order.currency_code)}
                      </td>
                      <td className="text-right">
                        <Badge
                          variant={
                            order.status === "paid"
                              ? "emerald"
                              : order.status === "fulfilled"
                                ? "teal"
                                : "rose"
                          }
                        >
                          {order.status}
                        </Badge>
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
                      {formatDateShort(review.created_at)}
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
