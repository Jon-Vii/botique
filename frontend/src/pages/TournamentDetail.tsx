import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CaretRight,
  Crown,
  CurrencyDollar,
  Lightning,
  ListNumbers,
  Package,
  Robot,
  ShoppingCart,
  Star,
  Sword,
  Trophy,
} from "@phosphor-icons/react";
import { BackendNotice } from "../components/BackendNotice";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { Stat } from "../components/Stat";
import { StatSkeleton } from "../components/Skeleton";
import { useTournamentResult } from "../hooks/useApi";
import { formatCurrency } from "../lib/format";
import type {
  TournamentAggregateStanding,
  TournamentResult,
  TournamentRoundResult,
  TournamentStanding,
} from "../types/api";

/* ── Rank badge — gold / silver / bronze ── */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 bg-amber-dim border border-amber/20 font-mono font-bold text-sm text-amber">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-2 border border-gray-4 font-mono font-bold text-sm text-gray-7">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 bg-orange-1 border border-orange-4 font-mono font-bold text-sm text-orange-8">
        3
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-1 border border-rule font-mono font-bold text-sm text-muted">
      {rank}
    </span>
  );
}

/* ── Entrant model badge ── */

function ModelTag({ provider, model }: { provider: string; model: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted">
      <Robot size={10} weight="duotone" />
      {provider}/{model}
    </span>
  );
}

/* ── Aggregate standings table ── */

function AggregateStandingsTable({
  standings,
}: {
  standings: TournamentAggregateStanding[];
}) {
  return (
    <div className="bg-white border border-rule overflow-hidden shadow-[var(--shadow-card)]">
      <table className="geist-table">
        <thead>
          <tr>
            <th style={{ width: 48 }}>Rank</th>
            <th>Entrant</th>
            <th>Model</th>
            <th align="right">Avg Score</th>
            <th align="right">Wins</th>
            <th align="right">Rounds</th>
            <th align="right">Avg Sales</th>
            <th align="right">Avg Rating</th>
            <th>Round Scores</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.entrant.entrant_id}>
              <td>
                <RankBadge rank={s.rank} />
              </td>
              <td>
                <span className="font-semibold text-ink">
                  {s.entrant.display_name}
                </span>
              </td>
              <td>
                <ModelTag
                  provider={s.entrant.provider}
                  model={s.entrant.model}
                />
              </td>
              <td className="text-right">
                <span className="num font-bold text-orange">
                  {formatCurrency(s.average_primary_score)}
                </span>
              </td>
              <td className="text-right">
                <Badge
                  variant={s.round_wins > 0 ? "amber" : "gray"}
                  subtle={s.round_wins === 0}
                >
                  {s.round_wins}
                </Badge>
              </td>
              <td className="text-right num text-secondary">
                {s.rounds_played}
              </td>
              <td className="text-right num text-secondary">
                {s.average_total_sales_count.toFixed(1)}
              </td>
              <td className="text-right num text-secondary">
                {s.average_review_average !== null
                  ? s.average_review_average.toFixed(2)
                  : "\u2014"}
              </td>
              <td>
                <div className="flex items-center gap-1">
                  {s.round_scores.map((score, i) => (
                    <span
                      key={i}
                      className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-gray-1 border border-rule text-secondary"
                      title={`Round ${i + 1}: ${formatCurrency(score)}`}
                    >
                      {formatCurrency(score, "USD", { maximumFractionDigits: 0 })}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Round standings table ── */

function RoundStandingsTable({
  standings,
}: {
  standings: TournamentStanding[];
}) {
  return (
    <div className="bg-white border border-rule overflow-hidden">
      <table className="geist-table geist-table-striped">
        <thead>
          <tr>
            <th style={{ width: 48 }}>Rank</th>
            <th>Entrant</th>
            <th>Shop</th>
            <th align="right">Cash</th>
            <th align="right">Pending</th>
            <th align="right">Sales</th>
            <th align="right">Reviews</th>
            <th align="right">Listings</th>
            <th align="right">Notes</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.entrant.entrant_id}>
              <td>
                <RankBadge rank={s.rank} />
              </td>
              <td>
                <div>
                  <span className="font-semibold text-ink block">
                    {s.entrant.display_name}
                  </span>
                  <ModelTag
                    provider={s.entrant.provider}
                    model={s.entrant.model}
                  />
                </div>
              </td>
              <td>
                <Link
                  to={`/shop/${s.shop_id}`}
                  className="text-orange hover:text-orange-dark text-sm font-medium transition-colors"
                >
                  {s.shop_name}
                </Link>
                <span className="text-[10px] font-mono text-muted block">
                  #{s.shop_id}
                </span>
              </td>
              <td className="text-right">
                <span className="num font-bold text-orange">
                  {formatCurrency(s.scorecard.available_cash)}
                </span>
              </td>
              <td className="text-right num text-muted">
                {formatCurrency(s.scorecard.pending_cash)}
              </td>
              <td className="text-right num text-secondary">
                {s.scorecard.total_sales_count}
              </td>
              <td className="text-right">
                {s.scorecard.review_average !== null ? (
                  <span className="inline-flex items-center gap-1 num text-secondary">
                    {s.scorecard.review_average.toFixed(1)}
                    <Star size={10} weight="fill" className="text-amber" />
                    <span className="text-muted text-[10px]">
                      ({s.scorecard.review_count})
                    </span>
                  </span>
                ) : (
                  <span className="text-muted">&mdash;</span>
                )}
              </td>
              <td className="text-right">
                <span className="num text-secondary">
                  {s.scorecard.active_listing_count}
                </span>
                {s.scorecard.draft_listing_count > 0 && (
                  <span className="text-[10px] text-muted ml-1">
                    +{s.scorecard.draft_listing_count}d
                  </span>
                )}
              </td>
              <td className="text-right num text-muted">
                {s.scorecard.workspace_entries_written}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Shop assignment matrix ── */

function ShopAssignmentMatrix({ tournament }: { tournament: TournamentResult }) {
  return (
    <div className="bg-white border border-rule overflow-hidden">
      <table className="geist-table">
        <thead>
          <tr>
            <th>Entrant</th>
            {tournament.rounds.map((r) => (
              <th key={r.round_index} className="text-center">
                R{r.round_index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tournament.entrants.map((entrant) => (
            <tr key={entrant.entrant_id}>
              <td>
                <span className="font-semibold text-ink text-sm">
                  {entrant.display_name}
                </span>
              </td>
              {tournament.rounds.map((round) => {
                const assignment = round.shop_assignments.find(
                  (a) => a.entrant_id === entrant.entrant_id
                );
                return (
                  <td
                    key={round.round_index}
                    className="text-center"
                  >
                    {assignment ? (
                      <Badge variant="orange" subtle>
                        Shop #{assignment.shop_id}
                      </Badge>
                    ) : (
                      <span className="text-muted">&mdash;</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Round detail panel ── */

function RoundDetail({
  round,
  tournament,
}: {
  round: TournamentRoundResult;
  tournament: TournamentResult;
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {/* Round standings */}
      <RoundStandingsTable standings={round.standings} />

      {/* Day-by-day drilldown */}
      <div>
        <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <ListNumbers size={14} weight="duotone" className="text-orange" />
          Day-by-Day Breakdown
        </h4>
        <div className="space-y-1">
          {round.days.map((day) => {
            const isExpanded = expandedDay === day.day;
            return (
              <div
                key={day.day}
                className="border border-rule bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDay(isExpanded ? null : day.day)
                  }
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-1 transition-colors cursor-pointer"
                >
                  <CaretRight
                    size={12}
                    weight="bold"
                    className={`text-muted transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <span className="text-sm font-semibold text-ink">
                    Day {day.day}
                  </span>
                  <span className="text-xs font-mono text-muted">
                    {day.simulation_date}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-muted uppercase tracking-wider">
                    {day.turn_order.length} entrants
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-rule px-4 py-3 bg-gray-1 space-y-2">
                    <div className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider mb-2">
                      Turn Order
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {day.turn_order.map((entrantId, idx) => {
                        const entrant = tournament.entrants.find(
                          (e) => e.entrant_id === entrantId
                        );
                        return (
                          <div
                            key={entrantId}
                            className="flex items-center gap-1.5"
                          >
                            <span className="w-5 h-5 flex items-center justify-center bg-orange-1 border border-orange-4 text-[10px] font-mono font-bold text-orange">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-medium text-ink">
                              {entrant?.display_name ?? entrantId}
                            </span>
                            {idx < day.turn_order.length - 1 && (
                              <CaretRight
                                size={10}
                                className="text-gray-5 mx-0.5"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Link to run */}
      <div className="flex items-center gap-2 pt-2">
        <Link
          to={`/runs/${round.run_id}`}
          className="text-sm text-orange hover:text-orange-dark font-medium flex items-center gap-1 transition-colors"
        >
          View full run detail
          <CaretRight size={12} weight="bold" />
        </Link>
        <span className="text-[10px] font-mono text-muted">
          {round.run_id}
        </span>
      </div>
    </div>
  );
}

/* ── Main tournament detail page ── */

export function TournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: tournament,
    isLoading,
    error,
  } = useTournamentResult(tournamentId ?? "");

  const requestedRound = Number(searchParams.get("round"));
  const activeRound = useMemo(() => {
    if (!tournament || Number.isNaN(requestedRound)) return 0;
    return tournament.rounds.some((round) => round.round_index === requestedRound)
      ? requestedRound
      : 0;
  }, [requestedRound, tournament]);

  useEffect(() => {
    if (!tournament) return;
    if (searchParams.get("round") === String(activeRound)) return;
    const next = new URLSearchParams(searchParams);
    if (activeRound === 0) next.delete("round");
    else next.set("round", String(activeRound));
    setSearchParams(next, { replace: true });
  }, [activeRound, searchParams, setSearchParams, tournament]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton width="240px" height="32px" />
        <div className="grid grid-cols-4 gap-3 stagger">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <Skeleton width="100%" height="300px" />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<Sword size={48} weight="duotone" />}
          title="Tournament not found"
          description="This tournament may not exist or the backend endpoint is not available."
        />
        <BackendNotice
          title="Tournament result is unavailable"
          description="The tournament detail request failed or the requested artifact was not found."
          endpoints={["GET /control/tournaments/:tournamentId"]}
        />
      </div>
    );
  }

  const winner = tournament.standings[0];
  const selectedRound =
    tournament.rounds.find((round) => round.round_index === activeRound) ??
    tournament.rounds[0];

  return (
    <div className="space-y-10">
      {/* Back link + title */}
      <div>
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          All Tournaments
        </Link>

        <div className="tech-card relative overflow-hidden px-8 py-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} weight="fill" className="text-orange" />
                <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
                  Tournament Result
                </span>
              </div>
              <h1 className="text-3xl font-bold text-ink leading-tight tracking-tight mb-2">
                <span className="font-mono text-xl text-secondary">
                  {tournament.run_id}
                </span>
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="orange">
                  {tournament.entrants.length} entrants
                </Badge>
                <Badge variant="gray">
                  {tournament.round_count} rounds
                </Badge>
                <Badge variant="gray">
                  {tournament.days_per_round} days/round
                </Badge>
                <Badge variant="gray">
                  {tournament.shop_ids.length} shops
                </Badge>
              </div>
            </div>

            {/* Winner callout */}
            {winner && (
              <div className="shrink-0 text-center border-2 border-amber/20 bg-white shadow-[var(--shadow-elevated)] px-8 py-5">
                <div className="flex items-center justify-center gap-1.5 text-amber text-[10px] font-pixel-grid uppercase tracking-widest mb-2">
                  <Crown size={11} weight="fill" />
                  Champion
                </div>
                <div className="text-xl font-bold text-ink mb-1">
                  {winner.entrant.display_name}
                </div>
                <ModelTag
                  provider={winner.entrant.provider}
                  model={winner.entrant.model}
                />
                <div className="mt-3 num text-2xl font-bold text-amber">
                  {formatCurrency(winner.average_primary_score)}
                </div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  avg score
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <section className="grid grid-cols-4 gap-3 stagger">
        <Stat
          label="Total Rounds"
          value={tournament.round_count}
          icon={<Sword size={12} weight="duotone" />}
          accent="orange"
        />
        <Stat
          label="Days per Round"
          value={tournament.days_per_round}
          icon={<Lightning size={12} weight="duotone" />}
          accent="violet"
        />
        <Stat
          label="Entrants"
          value={tournament.entrants.length}
          icon={<Robot size={12} weight="duotone" />}
          accent="teal"
        />
        <Stat
          label="Shop Pool"
          value={tournament.shop_ids.join(", ")}
          icon={<Package size={12} weight="duotone" />}
          accent="emerald"
        />
      </section>

      {/* Aggregate standings */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <Trophy size={18} weight="duotone" className="text-orange" />
          Overall Standings
        </h2>
        <AggregateStandingsTable standings={tournament.standings} />
      </section>

      {/* Shop assignment rotation */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <ShoppingCart size={18} weight="duotone" className="text-orange" />
          Shop Assignment Rotation
        </h2>
        <p className="text-sm text-secondary mb-4">
          Each round, entrants rotate to different shops for fairness.
        </p>
        <ShopAssignmentMatrix tournament={tournament} />
      </section>

      {/* Entrant profiles */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <Robot size={18} weight="duotone" className="text-orange" />
          Entrants
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {tournament.entrants.map((entrant) => {
            const standing = tournament.standings.find(
              (s) => s.entrant.entrant_id === entrant.entrant_id
            );
            return (
              <div
                key={entrant.entrant_id}
                className="tech-card p-4 animate-card-in"
              >
                <div className="flex items-center gap-3 mb-3">
                  {standing && <RankBadge rank={standing.rank} />}
                  <div>
                    <div className="font-semibold text-ink">
                      {entrant.display_name}
                    </div>
                    <ModelTag
                      provider={entrant.provider}
                      model={entrant.model}
                    />
                  </div>
                </div>
                {standing && (
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-rule">
                    <div>
                      <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                        Avg Score
                      </div>
                      <div className="num font-bold text-orange">
                        {formatCurrency(standing.average_primary_score)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                        Wins
                      </div>
                      <div className="num font-bold text-ink">
                        {standing.round_wins}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                        Avg Sales
                      </div>
                      <div className="num font-bold text-ink">
                        {standing.average_total_sales_count.toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Round-by-round detail */}
      <section>
        <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <CurrencyDollar size={18} weight="duotone" className="text-orange" />
          Round Details
        </h2>

        {/* Round tabs */}
        <div
          className="mb-6 flex items-center gap-0 border-b border-rule"
          role="tablist"
          aria-label="Tournament rounds"
        >
          {tournament.rounds.map((round) => (
            <button
              key={round.round_index}
              type="button"
              role="tab"
              aria-selected={activeRound === round.round_index}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (round.round_index === 0) next.delete("round");
                else next.set("round", String(round.round_index));
                setSearchParams(next, { replace: true });
              }}
              className={`px-5 py-2.5 text-sm font-medium cursor-pointer transition-colors ${
                activeRound === round.round_index
                  ? "tab-active"
                  : "tab-inactive"
              }`}
            >
              Round {round.round_index + 1}
            </button>
          ))}
        </div>

        {selectedRound && (
          <RoundDetail round={selectedRound} tournament={tournament} />
        )}
      </section>
    </div>
  );
}
