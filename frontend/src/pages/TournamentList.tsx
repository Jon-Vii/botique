import {
  Crown,
  Lightning,
  Robot,
  Sword,
  Trophy,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import type { TournamentListItem } from "../types/api";
import { useTournamentList } from "../hooks/useApi";

function TournamentCard({ item }: { item: TournamentListItem }) {
  const statusVariant =
    item.status === "completed"
      ? "emerald"
      : item.status === "running"
        ? "amber"
        : "rose";

  return (
    <Link
      to={`/tournaments/${item.run_id}`}
      className="tech-card card-lift block p-0 overflow-hidden animate-card-in"
    >
      {/* Header strip */}
      <div className="relative h-14 bg-gradient-to-r from-orange-1 via-white to-violet-subtle border-b border-rule overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 8px, var(--color-orange) 8px, var(--color-orange) 9px)",
          }}
        />
        <div className="absolute top-2 right-3">
          <Badge variant={statusVariant}>{item.status}</Badge>
        </div>
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <Sword size={13} weight="duotone" className="text-orange" />
          <span className="font-pixel text-[11px] text-orange tracking-wide">
            ARENA
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted truncate">
            {item.run_id}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider mb-0.5">
              Entrants
            </div>
            <div className="num text-lg font-bold text-ink">
              {item.entrant_count}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider mb-0.5">
              Rounds
            </div>
            <div className="num text-lg font-bold text-ink">
              {item.round_count}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider mb-0.5">
              Days/Rnd
            </div>
            <div className="num text-lg font-bold text-ink">
              {item.days_per_round}
            </div>
          </div>
        </div>

        {item.winner && (
          <div className="flex items-center gap-2 pt-1 border-t border-rule">
            <Crown size={14} weight="fill" className="text-amber" />
            <span className="text-sm font-semibold text-ink truncate">
              {item.winner.display_name}
            </span>
            <span className="text-[10px] font-mono text-muted ml-auto">
              {item.winner.model}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TournamentCardSkeleton() {
  return (
    <div className="tech-card overflow-hidden animate-card-in">
      <div className="h-14 bg-gray-2 skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <Skeleton width="60%" height="12px" />
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Skeleton width="48px" height="8px" />
            <Skeleton width="24px" height="20px" />
          </div>
          <div className="space-y-1">
            <Skeleton width="48px" height="8px" />
            <Skeleton width="24px" height="20px" />
          </div>
          <div className="space-y-1">
            <Skeleton width="48px" height="8px" />
            <Skeleton width="24px" height="20px" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TournamentList() {
  const { data: tournaments, isLoading, error } = useTournamentList();

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="tech-card relative overflow-hidden px-8 py-10">
        <div className="relative max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} weight="fill" className="text-orange" />
            <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
              Tournament Arena
            </span>
          </div>
          <h1 className="text-4xl font-bold text-ink leading-tight tracking-tight">
            Model{" "}
            <span className="font-pixel text-orange">Tournaments</span>
          </h1>
          <p className="mt-4 text-secondary text-[15px] leading-relaxed max-w-lg">
            Arena-style runs where multiple AI agent configurations
            compete head-to-head in the same shared marketplace.
            Rotating shops, rotating turns, fair fights.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <span className="flex items-center gap-2 text-secondary text-sm">
              <span className="w-7 h-7 bg-violet-dim flex items-center justify-center border border-violet/15">
                <Robot size={14} weight="duotone" className="text-violet" />
              </span>
              <span className="text-muted text-xs">Model vs Model</span>
            </span>
            <span className="flex items-center gap-2 text-secondary text-sm">
              <span className="w-7 h-7 bg-emerald-dim flex items-center justify-center border border-emerald/15">
                <Lightning size={14} weight="duotone" className="text-emerald" />
              </span>
              <span className="text-muted text-xs">Fair Rotation</span>
            </span>
          </div>
        </div>
      </section>

      {/* List */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-ink">
            All Tournaments
          </h2>
          {tournaments && (
            <Badge variant="gray" subtle>
              {tournaments.length} total
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            <TournamentCardSkeleton />
            <TournamentCardSkeleton />
            <TournamentCardSkeleton />
          </div>
        ) : error ? (
          <EmptyState
            icon={<Sword size={48} weight="duotone" />}
            title="Could not load tournaments"
            description="The tournament endpoint is not available yet. Run a tournament first using the CLI."
          />
        ) : tournaments && tournaments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {tournaments.map((t) => (
              <TournamentCard key={t.run_id} item={t} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy size={48} weight="duotone" />}
            title="No tournaments yet"
            description="Run a tournament using the CLI to see results here: botique-agent-runtime run-tournament --entrants-file entrants.json --shop-ids 1001,1002 --days 5 --rounds 2"
          />
        )}
      </section>
    </div>
  );
}
