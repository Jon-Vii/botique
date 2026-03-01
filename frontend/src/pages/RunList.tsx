import { Link } from "react-router-dom";
import { ClockCounterClockwise, Lightning, CurrencyDollar, Wrench } from "@phosphor-icons/react";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { useRunList } from "../hooks/useApi";
import { MOCK_RUN_LIST, MOCK_SUMMARIES } from "../api/mockRunData";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RunList() {
  const { data: runs, isLoading, isError } = useRunList();

  // Fall back to mock data when backend is unavailable
  const items = runs ?? MOCK_RUN_LIST;
  const loading = isLoading && !MOCK_RUN_LIST.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-muted text-[10px] font-mono font-semibold uppercase tracking-wider mb-2">
          <ClockCounterClockwise size={12} weight="bold" />
          Run Archive
        </div>
        <h1 className="text-2xl font-bold text-ink">Run Explorer</h1>
        <p className="text-sm text-secondary mt-1">
          Inspect agent run artifacts day-by-day. Trace decisions, review tool calls, observe state transitions.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="tech-card p-5">
              <div className="flex items-center gap-4">
                <Skeleton width="200px" height="16px" />
                <Skeleton width="80px" height="12px" />
                <div className="flex-1" />
                <Skeleton width="60px" height="24px" />
              </div>
            </div>
          ))}
        </div>
      ) : isError && !items.length ? (
        <EmptyState
          icon={<ClockCounterClockwise size={48} />}
          title="No Runs Found"
          description="Run artifacts will appear here once the backend /control/runs endpoint is available, or when mock data is loaded."
        />
      ) : (
        <div className="space-y-2">
          {items.map((run, idx) => {
            const summary = MOCK_SUMMARIES[run.run_id];
            const balanceStart = summary?.starting_state?.available_balance;
            const balanceEnd = summary?.ending_state?.available_balance;
            const totalTools = summary?.totals?.tool_call_count ?? 0;
            const revenue = summary?.totals?.yesterday_revenue ?? 0;

            return (
              <Link
                key={run.run_id}
                to={`/runs/${run.run_id}`}
                className="tech-card block p-5 card-lift animate-card-in group"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Run ID */}
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-semibold text-ink group-hover:text-orange transition-colors">
                      {run.run_id}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="orange" subtle>
                        shop {run.shop_id}
                      </Badge>
                      <Badge variant="gray">
                        {run.mode}
                      </Badge>
                      {run.created_at && (
                        <span className="text-[10px] text-muted font-mono">
                          {fmtDate(run.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1" />

                  {/* Quick stats */}
                  <div className="flex items-center gap-5 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-muted" title="Days simulated">
                      <Lightning size={12} weight="fill" className="text-amber" />
                      <span className="num">{run.day_count}d</span>
                    </div>

                    {totalTools > 0 && (
                      <div className="flex items-center gap-1.5 text-muted" title="Total tool calls">
                        <Wrench size={12} weight="duotone" className="text-teal" />
                        <span className="num">{totalTools}</span>
                      </div>
                    )}

                    {revenue > 0 && (
                      <div className="flex items-center gap-1.5 text-muted" title="Total revenue">
                        <CurrencyDollar size={12} weight="bold" className="text-emerald" />
                        <span className="num">${revenue.toFixed(0)}</span>
                      </div>
                    )}

                    {balanceStart != null && balanceEnd != null && (
                      <div className="flex items-center gap-1 text-muted" title="Balance change">
                        <span className="text-[10px] text-secondary">${balanceStart.toFixed(0)}</span>
                        <span className="text-[10px] text-muted mx-0.5">{"->"}</span>
                        <span className={`text-[10px] font-semibold ${balanceEnd > balanceStart ? "text-emerald" : balanceEnd < balanceStart ? "text-rose" : "text-secondary"}`}>
                          ${balanceEnd.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
