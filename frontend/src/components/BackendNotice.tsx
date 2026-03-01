import { WarningCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge } from "./Badge";

export function BackendNotice({
  title,
  description,
  endpoints,
  children,
  compact = false,
  badgeLabel = "Backend Blocker",
}: {
  title: string;
  description: string;
  endpoints?: string[];
  children?: ReactNode;
  compact?: boolean;
  badgeLabel?: string;
}) {
  return (
    <section
      className={`tech-card border-l-2 border-l-amber px-5 ${compact ? "py-4" : "py-5"}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <WarningCircle
          size={18}
          weight="duotone"
          className="mt-0.5 shrink-0 text-amber"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <Badge variant="amber" subtle>
              {badgeLabel}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-secondary">
            {description}
          </p>
          {endpoints && endpoints.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {endpoints.map((endpoint) => (
                <code
                  key={endpoint}
                  className="rounded-[var(--radius-sm)] bg-orange-1 px-2 py-1 font-mono text-[11px] text-orange"
                >
                  {endpoint}
                </code>
              ))}
            </div>
          ) : null}
          {children ? <div className="pt-1">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
