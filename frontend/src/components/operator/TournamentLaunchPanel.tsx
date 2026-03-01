import { useState } from "react";
import { Trophy, Plus, Trash } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { LoadingDots } from "../LoadingDots";
import { ScenarioPicker } from "./ScenarioPicker";
import { useLaunchTournament, useWorldState } from "../../hooks/useApi";
import { DEFAULT_SCENARIO_ID, getScenarioMeta } from "../../lib/scenarios";
import type { ScenarioId } from "../../types/api";

const PRESET_ENTRANTS = [
  { entrant_id: "mistral-large", display_name: "Mistral Large", provider: "mistral", model: "mistral-large-latest" },
  { entrant_id: "mistral-medium", display_name: "Mistral Medium", provider: "mistral", model: "mistral-medium-latest" },
  { entrant_id: "mistral-small", display_name: "Mistral Small", provider: "mistral", model: "mistral-small-latest" },
  { entrant_id: "magistral-medium", display_name: "Magistral Medium", provider: "mistral", model: "magistral-medium-latest" },
  { entrant_id: "magistral-small", display_name: "Magistral Small", provider: "mistral", model: "magistral-small-latest" },
  { entrant_id: "ministral-14b", display_name: "Ministral 14B", provider: "mistral", model: "ministral-14b-latest" },
  { entrant_id: "ministral-8b", display_name: "Ministral 8B", provider: "mistral", model: "ministral-8b-latest" },
  { entrant_id: "devstral-2", display_name: "Devstral 2", provider: "mistral", model: "devstral-2-25-12" },
  { entrant_id: "codestral", display_name: "Codestral", provider: "mistral", model: "codestral-latest" },
];

type Entrant = {
  entrant_id: string;
  display_name: string;
  provider: string;
  model: string;
};

export function TournamentLaunchPanel({
  onSuccess,
  onError,
  apiKey,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  apiKey?: string;
}) {
  const { data: world } = useWorldState();
  const launchTournament = useLaunchTournament();
  const shops = world?.marketplace.shops ?? [];

  const [entrants, setEntrants] = useState<Entrant[]>([
    PRESET_ENTRANTS[0],
    PRESET_ENTRANTS[1],
  ]);
  const [selectedShopIds, setSelectedShopIds] = useState<number[]>([]);
  const [daysPerRound, setDaysPerRound] = useState(5);
  const [rounds, setRounds] = useState(2);
  const [turnsPerDay, setTurnsPerDay] = useState(5);
  const [scenarioId, setScenarioId] = useState<ScenarioId>(DEFAULT_SCENARIO_ID);
  const [launchedId, setLaunchedId] = useState<string | null>(null);
  const selectedScenario = getScenarioMeta(scenarioId);

  const addEntrant = () => {
    const unused = PRESET_ENTRANTS.find(
      (p) => !entrants.some((e) => e.entrant_id === p.entrant_id)
    );
    if (unused) {
      setEntrants([...entrants, unused]);
    }
  };

  const removeEntrant = (idx: number) => {
    if (entrants.length <= 2) return;
    setEntrants(entrants.filter((_, i) => i !== idx));
  };

  const toggleShop = (id: number) => {
    setSelectedShopIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleLaunch = () => {
    if (entrants.length < 2) {
      onError("Need at least 2 entrants");
      return;
    }
    const sids = selectedShopIds.length > 0
      ? selectedShopIds
      : shops.map((s) => s.shop_id);

    if (sids.length < entrants.length) {
      onError(`Need at least ${entrants.length} shops for ${entrants.length} entrants (only ${sids.length} available). Remove entrants or add shops.`);
      return;
    }

    if (!apiKey) {
      onError("Mistral API key is required — set it above");
      return;
    }

    launchTournament.mutate(
      {
        entrants,
        shop_ids: sids,
        days_per_round: daysPerRound,
        rounds,
        turns_per_day: turnsPerDay,
        scenario_id: scenarioId,
        api_key: apiKey,
      },
      {
        onSuccess: (data) => {
          onSuccess(`Tournament "${data.tournament_id}" launched`);
          setLaunchedId(data.tournament_id);
        },
        onError: (err) =>
          onError(err instanceof Error ? err.message : "Tournament launch failed"),
      }
    );
  };

  return (
    <div className="tech-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy size={14} weight="duotone" className="text-violet" />
          <span className="font-pixel-grid text-[10px] text-violet uppercase tracking-widest">
            Tournament
          </span>
        </div>
      </div>

      <div className="mb-4">
        <ScenarioPicker
          value={scenarioId}
          onChange={setScenarioId}
          tone="violet"
        />
        <p className="mt-2 text-xs leading-relaxed text-secondary">
          {selectedScenario.description}
        </p>
      </div>

      {/* Entrants */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Entrants
          </span>
          <button
            type="button"
            onClick={addEntrant}
            disabled={entrants.length >= PRESET_ENTRANTS.length}
            className="flex items-center gap-1 text-xs text-orange hover:text-orange-dark font-medium disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Plus size={12} weight="bold" />
            Add
          </button>
        </div>
        <div className="space-y-1.5">
          {entrants.map((e, idx) => (
            <div
              key={e.entrant_id}
              className="flex items-center gap-2 px-3 py-2 bg-gray-1 border border-rule"
            >
              <select
                value={e.entrant_id}
                onChange={(ev) => {
                  const preset = PRESET_ENTRANTS.find(
                    (p) => p.entrant_id === ev.target.value
                  );
                  if (preset) {
                    const next = [...entrants];
                    next[idx] = preset;
                    setEntrants(next);
                  }
                }}
                className="flex-1 bg-transparent text-sm font-mono text-ink focus:outline-none cursor-pointer"
              >
                {PRESET_ENTRANTS.map((p) => (
                  <option
                    key={p.entrant_id}
                    value={p.entrant_id}
                    disabled={entrants.some(
                      (ex, i) => i !== idx && ex.entrant_id === p.entrant_id
                    )}
                  >
                    {p.display_name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-mono text-muted">
                {e.model}
              </span>
              <button
                type="button"
                onClick={() => removeEntrant(idx)}
                disabled={entrants.length <= 2}
                className="text-muted hover:text-rose disabled:opacity-20 cursor-pointer transition-colors"
              >
                <Trash size={13} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Shop selection */}
      {shops.length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider block mb-2">
            Shops
            <span className="text-muted/60 normal-case tracking-normal ml-2">
              (none selected = all shops)
            </span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {shops.map((s) => {
              const selected = selectedShopIds.includes(s.shop_id);
              return (
                <button
                  type="button"
                  key={s.shop_id}
                  onClick={() => toggleShop(s.shop_id)}
                  aria-pressed={selected}
                  className={`px-2.5 py-1 text-xs font-mono border transition-[background-color,border-color,color] ${
                    selected
                      ? "border-orange/30 bg-orange-50 text-orange"
                      : "border-rule bg-white text-secondary hover:border-gray-5"
                  }`}
                >
                  {s.shop_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Config */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Days / Round
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={daysPerRound}
            onChange={(e) => setDaysPerRound(Number(e.target.value))}
            className="w-full border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-violet/40 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.08)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Rounds
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            className="w-full border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-violet/40 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.08)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Turns / Day
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={turnsPerDay}
            onChange={(e) => setTurnsPerDay(Number(e.target.value))}
            className="w-full border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-violet/40 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.08)]"
          />
        </div>
      </div>

      {/* Launch */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleLaunch}
          disabled={launchTournament.isPending || entrants.length < 2}
          aria-disabled={launchTournament.isPending || entrants.length < 2}
          className="flex cursor-pointer items-center gap-2 bg-violet px-5 py-2.5 text-sm font-semibold text-white transition-[box-shadow,transform,opacity] hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(139,92,246,0.3)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {launchTournament.isPending ? (
            <LoadingDots size={4} color="bg-white" />
          ) : (
            <>
              <Trophy size={14} weight="fill" />
              Launch Tournament
            </>
          )}
        </button>

        {launchedId && (
          <Link
            to={`/tournaments/${encodeURIComponent(launchedId)}`}
            className="text-sm font-medium text-violet transition-[color,filter] hover:brightness-110"
          >
            View tournament →
          </Link>
        )}
      </div>
    </div>
  );
}
