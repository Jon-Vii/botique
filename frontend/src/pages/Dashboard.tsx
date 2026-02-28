import {
  ArrowRight,
  ChartBar,
  Cpu,
  Lightning,
  Package,
  Play,
  ShoppingCart,
  Storefront,
  TrendUp,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ShopCard } from "../components/ShopCard";
import { Spinner } from "../components/Spinner";
import { Stat } from "../components/Stat";
import { TrendTag } from "../components/TrendTag";
import {
  useAdvanceDay,
  useMarketSnapshot,
  useSimulationDay,
  useTrendState,
  useWorldState,
} from "../hooks/useApi";

export function Dashboard() {
  const { data: simDay, isLoading: dayLoading } = useSimulationDay();
  const { data: snapshot } = useMarketSnapshot();
  const { data: trends } = useTrendState();
  const { data: world, isLoading: worldLoading } = useWorldState();
  const advanceDay = useAdvanceDay();

  if (dayLoading || worldLoading) return <Spinner />;

  const shops = world?.marketplace.shops ?? [];
  const orders = world?.marketplace.orders ?? [];
  const reviews = world?.marketplace.reviews ?? [];
  const recentOrders = [...orders]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="tech-card relative overflow-hidden px-8 py-10">
        <div className="relative flex items-start justify-between gap-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <Lightning size={14} weight="fill" className="text-orange" />
              <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
                Autonomous Marketplace
              </span>
            </div>
            <h1 className="text-4xl font-bold text-ink leading-tight tracking-tight">
              Simulation{" "}
              <span className="font-pixel text-orange">Observatory</span>
            </h1>
            <p className="mt-4 text-secondary text-[15px] leading-relaxed max-w-lg">
              AI agents autonomously run competing shops — creating
              products, setting prices, reacting to trends, and competing for
              customers. Watch the marketplace evolve!
            </p>

            {/* Inline stats */}
            {snapshot && (
              <div className="mt-6 flex items-center gap-6 text-sm">
                <span className="flex items-center gap-2 text-secondary">
                  <span className="w-7 h-7 bg-orange-50 flex items-center justify-center border border-orange/15">
                    <Storefront size={14} weight="duotone" className="text-orange" />
                  </span>
                  <strong className="num text-ink">
                    {snapshot.active_shop_count}
                  </strong>
                  <span className="text-muted text-xs">shops</span>
                </span>
                <span className="flex items-center gap-2 text-secondary">
                  <span className="w-7 h-7 bg-emerald-dim flex items-center justify-center border border-emerald/15">
                    <Package size={14} weight="duotone" className="text-emerald" />
                  </span>
                  <strong className="num text-ink">
                    {snapshot.active_listing_count}
                  </strong>
                  <span className="text-muted text-xs">listings</span>
                </span>
                <span className="flex items-center gap-2 text-secondary">
                  <span className="w-7 h-7 bg-violet-dim flex items-center justify-center border border-violet/15">
                    <ShoppingCart size={14} weight="duotone" className="text-violet" />
                  </span>
                  <strong className="num text-ink">
                    {orders.length}
                  </strong>
                  <span className="text-muted text-xs">orders</span>
                </span>
              </div>
            )}
          </div>

          {/* Day display — pixel font big number */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            {simDay && (
              <div className="animate-pulse-glow text-center border-2 border-orange/20 bg-white shadow-[var(--shadow-elevated)] px-8 py-6">
                <div className="flex items-center justify-center gap-1.5 text-orange text-[10px] font-pixel-grid uppercase tracking-widest mb-3">
                  <Cpu size={11} weight="duotone" />
                  Sim Day
                </div>
                <div className="font-pixel text-6xl text-orange leading-none">
                  {simDay.day}
                </div>
                <div className="text-muted text-xs font-mono mt-2">
                  {simDay.date}
                </div>
              </div>
            )}
            <button
              onClick={() => advanceDay.mutate()}
              disabled={advanceDay.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-orange text-white text-sm font-semibold hover:shadow-[0_0_24px_rgba(255,112,0,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play size={14} weight="fill" />
              {advanceDay.isPending ? "Running..." : "Advance Day"}
            </button>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      {snapshot && (
        <section className="grid grid-cols-4 gap-3 stagger">
          <Stat
            label="Active Listings"
            value={snapshot.active_listing_count}
            icon={<Package size={12} weight="duotone" />}
            accent="emerald"
          />
          <Stat
            label="Shops Running"
            value={snapshot.active_shop_count}
            icon={<Storefront size={12} weight="duotone" />}
            accent="orange"
          />
          <Stat
            label="Avg Price"
            value={`$${snapshot.average_active_price.toFixed(2)}`}
            icon={<ChartBar size={12} weight="duotone" />}
            accent="teal"
          />
          <Stat
            label="Total Reviews"
            value={reviews.length}
            icon={<TrendUp size={12} weight="duotone" />}
            accent="violet"
          />
        </section>
      )}

      {/* Trends */}
      {trends && trends.active_trends.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">
              Market Trends
            </h2>
            <span className="text-[10px] font-mono text-muted border border-rule bg-warm-50 px-2 py-0.5">
              baseline {trends.baseline_multiplier.toFixed(1)}x
            </span>
          </div>
          <div className="flex flex-wrap gap-2 stagger">
            {trends.active_trends.map((trend) => (
              <TrendTag key={trend.trend_id} trend={trend} />
            ))}
          </div>
        </section>
      )}

      {/* Shops */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-ink">
            Agent Shops
          </h2>
          <Link
            to="/marketplace"
            className="text-sm text-orange hover:text-orange-dark font-medium flex items-center gap-1 transition-colors"
          >
            Browse marketplace <ArrowRight size={14} weight="bold" />
          </Link>
        </div>

        {shops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {shops.map((shop) => (
              <ShopCard
                key={shop.shop_id}
                shop={{
                  ...shop,
                  listing_active_count:
                    world?.marketplace.listings.filter(
                      (l) =>
                        l.shop_id === shop.shop_id && l.state === "active"
                    ).length ?? 0,
                  total_sales_count:
                    world?.marketplace.orders.filter(
                      (o) => o.shop_id === shop.shop_id
                    ).length ?? 0,
                  review_average: (() => {
                    const sr = reviews.filter(
                      (r) => r.shop_id === shop.shop_id
                    );
                    return sr.length > 0
                      ? sr.reduce((s, r) => s + r.rating, 0) / sr.length
                      : 0;
                  })(),
                  review_count: reviews.filter(
                    (r) => r.shop_id === shop.shop_id
                  ).length,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Storefront size={48} weight="duotone" />}
            title="No shops yet"
            description="Start the simulation to see AI agents open their shops and begin competing in the marketplace."
          />
        )}
      </section>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-ink mb-5">
            Recent Orders
          </h2>
          <div className="bg-white border border-rule overflow-hidden shadow-[var(--shadow-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-warm-50/60 text-muted text-[10px] font-mono uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Order</th>
                  <th className="text-left px-4 py-3 font-medium">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium">Items</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.receipt_id}
                    className="border-b border-rule/50 hover:bg-orange-50/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      #{order.receipt_id}
                    </td>
                    <td className="px-4 py-3 text-ink font-medium">
                      {order.buyer_name}
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs">
                      {order.line_items.map((li) => li.title).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right num font-semibold text-orange">
                      ${order.total_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${
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
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="text-center py-8 border-t border-rule">
        <p className="text-xs text-muted">
          <span className="font-pixel text-sm text-ink">
            botique
          </span>{" "}
          — autonomous marketplace sim — powered by{" "}
          <span className="font-semibold text-orange">Mistral AI</span>
        </p>
      </footer>
    </div>
  );
}
