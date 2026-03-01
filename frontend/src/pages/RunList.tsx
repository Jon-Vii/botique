import {
  ClockCounterClockwise,
  FileText,
  Lightning,
  Package,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { BackendNotice } from "../components/BackendNotice";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { useRunList } from "../hooks/useApi";
import { formatDateTimeShort } from "../lib/format";

export function RunList() {
  const { data: runs, isLoading, error } = useRunList();

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted">
          <ClockCounterClockwise size={12} weight="bold" aria-hidden="true" />
          Run Archive
        </div>
        <h1 className="text-2xl font-bold text-ink">Run Explorer</h1>
        <p className="mt-1 text-sm text-secondary">
          Inspect persisted run artifacts without relying on terminal logs.
        </p>
      </div>

      {error ? (
        <BackendNotice
          title="Run archive could not be loaded"
          description="The run explorer uses control-plane artifact endpoints. The request failed or the server returned invalid data."
          endpoints={[
            "GET /control/runs",
            "GET /control/runs/:runId/summary",
            "GET /control/runs/:runId/manifest",
          ]}
        />
      ) : null}

      {error ? null : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="tech-card p-5">
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton width="200px" height="16px" />
                <Skeleton width="80px" height="12px" />
                <div className="flex-1" />
                <Skeleton width="60px" height="24px" />
              </div>
            </div>
          ))}
        </div>
      ) : runs && runs.length > 0 ? (
        <div className="space-y-2">
          {runs.map((run, index) => (
            <Link
              key={run.run_id}
              to={`/runs/${encodeURIComponent(run.run_id)}`}
              className="tech-card card-lift block p-5 animate-card-in group"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0">
                  <span className="font-mono text-sm font-semibold text-ink transition-colors group-hover:text-orange">
                    {run.run_id}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="orange" subtle>
                      shop {run.shop_id}
                    </Badge>
                    <Badge variant={run.mode === "live" ? "emerald" : "gray"}>
                      {run.mode}
                    </Badge>
                    {run.created_at ? (
                      <span className="text-[10px] font-mono text-muted">
                        {formatDateTimeShort(run.created_at)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1" />

                <div className="flex flex-wrap items-center gap-5 text-xs font-mono">
                  <div
                    className="flex items-center gap-1.5 text-muted"
                    title="Days simulated"
                  >
                    <Lightning
                      size={12}
                      weight="fill"
                      className="text-amber"
                      aria-hidden="true"
                    />
                    <span className="num">{run.day_count}d</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted">
                    <FileText
                      size={12}
                      weight="duotone"
                      className={run.has_summary ? "text-emerald" : "text-muted"}
                      aria-hidden="true"
                    />
                    <span>{run.has_summary ? "summary" : "summary pending"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted">
                    <Package
                      size={12}
                      weight="duotone"
                      className={run.has_manifest ? "text-teal" : "text-muted"}
                      aria-hidden="true"
                    />
                    <span>{run.has_manifest ? "manifest" : "manifest pending"}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ClockCounterClockwise size={48} weight="duotone" />}
          title="No runs found"
          description="Launch a run and it will appear here once its artifact bundle is persisted."
        />
      )}
    </div>
  );
}
