import {
  ArrowRight,
  ChartBar,
  Cpu,
  Lightning,
  Package,
  Play,
  Robot,
  ShoppingCart,
  Storefront,
  TrendUp,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Gauge } from "../components/Gauge";
import { LoadingDots } from "../components/LoadingDots";
import { ShopCard } from "../components/ShopCard";
import { ShopCardSkeleton, StatSkeleton } from "../components/Skeleton";
import { Stat } from "../components/Stat";
import { useToast } from "../components/toast-context";
import { TrendTag } from "../components/TrendTag";
import { ScenarioBadge } from "../components/ScenarioBadge";
import {
  useAdvanceDay,
  useMarketSnapshot,
  useSimulationDay,
  useTrendState,
  useWorldState,
} from "../hooks/useApi";
import { formatCurrency } from "../lib/format";
import { countShopsByRole } from "../lib/shop-roles";

export function Dashboard() {
  const { data: simDay, isLoading: dayLoading } = useSimulationDay();
  const { data: snapshot } = useMarketSnapshot();
  const { data: trends } = useTrendState();
  const { data: world, isLoading: worldLoading } = useWorldState();
  const advanceDay = useAdvanceDay();
  const { toast } = useToast();

  const isLoading = dayLoading || worldLoading;

  const shops = world?.marketplace.shops ?? [];
  const orders = world?.marketplace.orders ?? [];
  const reviews = world?.marketplace.reviews ?? [];
  const scenario = world?.simulation.scenario;
  const shopIds = shops.map((shop) => shop.shop_id);
  const agentShopCount = countShopsByRole(shopIds, "agent", scenario);
  const npcShopCount = countShopsByRole(shopIds, "npc", scenario);
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
              Scenario-controlled agent shops compete inside a broader NPC
              market, creating products, setting prices, reacting to trends,
              and fighting for customers in the same shared world.
            </p>

            {scenario ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <ScenarioBadge scenario={scenario} subtle />
                <Badge
                  variant="orange"
                  subtle
                  icon={<Robot size={10} weight="duotone" />}
                >
                  {agentShopCount} agent shop{agentShopCount === 1 ? "" : "s"}
                </Badge>
                <Badge
                  variant="gray"
                  subtle
                  icon={<Storefront size={10} weight="duotone" />}
                >
                  {npcShopCount} NPC shop{npcShopCount === 1 ? "" : "s"}
                </Badge>
              </div>
            ) : null}

            {/* Inline stats */}
            {snapshot && (
              <div className="mt-6 flex items-center gap-6 text-sm">
                <span className="flex items-center gap-2 text-secondary">
                  <span className="w-7 h-7 bg-orange-1 flex items-center justify-center border border-orange-4">
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
              type="button"
              onClick={() =>
                advanceDay.mutate(undefined, {
                  onSuccess: () =>
                    toast({
                      message: `Day ${(simDay?.day ?? 0) + 1} simulation complete`,
                      variant: "success",
                    }),
                  onError: () =>
                    toast({
                      message: "Day advance failed",
                      variant: "error",
                    }),
                })
              }
              disabled={advanceDay.isPending}
              className="flex cursor-pointer items-center gap-2 bg-orange px-6 py-3 text-sm font-semibold text-white transition-[box-shadow,transform,opacity] hover:scale-105 hover:shadow-[0_0_24px_rgba(255,112,0,0.3)] active:scale-95 disabled:opacity-50"
            >
              {advanceDay.isPending ? (
                <LoadingDots size={5} color="bg-white" />
              ) : (
                <>
                  <Play size={14} weight="fill" />
                  Advance Day
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-4 gap-3 stagger">
        {snapshot ? (
          <>
            <Stat
              label="Active Listings"
              value={snapshot.active_listing_count}
              icon={<Package size={12} weight="duotone" />}
              accent="emerald"
            />
            <Stat
              label="Active Shops"
              value={snapshot.active_shop_count}
              icon={<Storefront size={12} weight="duotone" />}
              accent="orange"
            />
            <Stat
              label="Avg Price"
              value={formatCurrency(snapshot.average_active_price)}
              icon={<ChartBar size={12} weight="duotone" />}
              accent="teal"
            />
            <Stat
              label="Total Reviews"
              value={reviews.length}
              icon={<TrendUp size={12} weight="duotone" />}
              accent="violet"
            />
          </>
        ) : (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        )}
      </section>

      {/* Simulation health gauges */}
      {snapshot && shops.length > 0 && (
        <section className="tech-card p-6">
          <div className="flex items-center gap-1.5 mb-5">
            <Cpu size={12} weight="duotone" className="text-orange" />
            <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
              System Health
            </span>
          </div>
          <div className="flex items-center justify-around">
            <Gauge
              value={Math.min(100, snapshot.active_listing_count * 5)}
              color="emerald"
              size="lg"
              label="Stock"
            />
            <Gauge
              value={
                shops.length > 0
                  ? Math.round((agentShopCount / shops.length) * 100)
                  : 0
              }
              color="orange"
              size="lg"
              label="Agent Share"
            />
            <Gauge
              value={Math.min(100, orders.length * 4)}
              color="violet"
              size="lg"
              label="Orders"
            />
            <Gauge
              value={
                reviews.length > 0
                  ? Math.round(
                      (reviews.reduce((s, r) => s + r.rating, 0) /
                        reviews.length /
                        5) *
                        100
                    )
                  : 0
              }
              color="amber"
              size="lg"
              label="Rating"
            />
          </div>
        </section>
      )}

      {/* Trends */}
      {trends && trends.active_trends.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">
              Market Trends
            </h2>
            <Badge variant="gray" subtle>
              baseline {trends.baseline_multiplier.toFixed(1)}x
            </Badge>
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
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-ink">
              Shop Network
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="orange"
                subtle
                icon={<Robot size={10} weight="duotone" />}
              >
                {agentShopCount} agent-controlled
              </Badge>
              <Badge
                variant="gray"
                subtle
                icon={<Storefront size={10} weight="duotone" />}
              >
                {npcShopCount} NPC market
              </Badge>
            </div>
          </div>
          <Link
            to="/marketplace"
            className="text-sm text-orange hover:text-orange-dark font-medium flex items-center gap-1 transition-colors"
          >
            Browse marketplace <ArrowRight size={14} weight="bold" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            <ShopCardSkeleton />
            <ShopCardSkeleton />
            <ShopCardSkeleton />
          </div>
        ) : shops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {shops.map((shop) => (
              <ShopCard
                key={shop.shop_id}
                scenario={scenario}
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
            description="Start the simulation to see agent shops and NPC market shops populate the shared world."
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
                {recentOrders.map((order) => (
                  <tr key={order.receipt_id}>
                    <td className="font-mono text-xs text-muted">
                      #{order.receipt_id}
                    </td>
                    <td className="text-ink font-medium">
                      {order.buyer_name}
                    </td>
                    <td className="text-secondary text-xs">
                      {order.line_items.map((li) => li.title).join(", ")}
                    </td>
                    <td className="text-right num font-semibold text-orange">
                      ${order.total_price.toFixed(2)}
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
