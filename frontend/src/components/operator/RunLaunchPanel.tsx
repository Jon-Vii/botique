import { useState } from "react";
import { Rocket, Warning } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { BackendNotice } from "../BackendNotice";
import { LoadingDots } from "../LoadingDots";
import { Badge } from "../Badge";
import { Snippet } from "../Snippet";
import { frontendFeatures } from "../../config/features";
import { useLaunchRun, useWorldState } from "../../hooks/useApi";

const MODEL_OPTIONS = [
  { label: "Mistral Medium", value: "mistral-medium-latest" },
  { label: "Mistral Small", value: "mistral-small-latest" },
  { label: "Mistral Large", value: "mistral-large-latest" },
  { label: "Codestral", value: "codestral-latest" },
  { label: "Mistral Nemo", value: "open-mistral-nemo" },
] as const;

export function RunLaunchPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { data: world } = useWorldState();
  const launchRun = useLaunchRun();
  const shops = world?.marketplace.shops ?? [];
  const canLaunchFromUi = frontendFeatures.enablePendingControlActions;

  const [shopId, setShopId] = useState("");
  const [days, setDays] = useState(5);
  const [turnsPerDay, setTurnsPerDay] = useState(5);
  const [runId, setRunId] = useState("");
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].value);
  const [launchedRunId, setLaunchedRunId] = useState<string | null>(null);

  const handleLaunch = () => {
    const sid = shopId ? Number(shopId) : shops[0]?.shop_id;
    if (!sid) {
      onError("No shop selected");
      return;
    }
    if (!canLaunchFromUi) {
      onError("Run launch is not wired to the backend yet");
      return;
    }
    const rid = runId.trim() || `run-${Date.now()}`;

    launchRun.mutate(
      {
        shop_id: sid,
        days,
        turns_per_day: turnsPerDay,
        run_id: rid,
        model,
        provider: "mistral",
      },
      {
        onSuccess: (data) => {
          onSuccess(`Run "${data.run_id}" launched`);
          setLaunchedRunId(data.run_id);
        },
        onError: (err) =>
          onError(err instanceof Error ? err.message : "Run launch failed"),
      }
    );
  };

  return (
    <div className="tech-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Rocket size={14} weight="duotone" className="text-orange" />
          <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
            Single Run
          </span>
        </div>
        <Badge variant="amber" subtle>
          <Warning size={10} weight="fill" />
          Backend endpoint pending
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Shop */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Shop
          </label>
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="w-full cursor-pointer border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-orange/40 focus:shadow-[0_0_0_2px_rgba(255,112,0,0.08)]"
          >
            {shops.length === 0 && <option value="">No shops available</option>}
            {shops.map((s) => (
              <option key={s.shop_id} value={s.shop_id}>
                #{s.shop_id} - {s.shop_name}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full cursor-pointer border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-orange/40 focus:shadow-[0_0_0_2px_rgba(255,112,0,0.08)]"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Days */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Days
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-orange/40 focus:shadow-[0_0_0_2px_rgba(255,112,0,0.08)]"
          />
        </div>

        {/* Turns per day */}
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
            className="w-full border border-rule bg-white px-3 py-2 text-sm font-mono text-ink transition-[border-color,box-shadow] focus:outline-none focus:border-orange/40 focus:shadow-[0_0_0_2px_rgba(255,112,0,0.08)]"
          />
        </div>

        {/* Run ID */}
        <div className="col-span-2 space-y-1.5">
          <label className="text-[10px] font-mono font-semibold text-muted uppercase tracking-wider">
            Run ID
            <span className="text-muted/60 normal-case tracking-normal ml-2">
              (optional — auto-generated if blank)
            </span>
          </label>
          <input
            type="text"
            placeholder="my-run-01"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            className="w-full border border-rule bg-white px-3 py-2 text-sm font-mono text-ink placeholder:text-muted/40 transition-[border-color,box-shadow] focus:outline-none focus:border-orange/40 focus:shadow-[0_0_0_2px_rgba(255,112,0,0.08)]"
          />
        </div>
      </div>

      {/* Launch */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleLaunch}
          disabled={!canLaunchFromUi || launchRun.isPending || shops.length === 0}
          aria-disabled={!canLaunchFromUi || launchRun.isPending || shops.length === 0}
          className="flex cursor-pointer items-center gap-2 bg-orange px-5 py-2.5 text-sm font-semibold text-white transition-[box-shadow,transform,opacity] hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,112,0,0.3)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {launchRun.isPending ? (
            <LoadingDots size={4} color="bg-white" />
          ) : (
            <>
              <Rocket size={14} weight="fill" />
              Launch Run
            </>
          )}
        </button>

        {launchedRunId && (
          <Link
            to={`/runs/${encodeURIComponent(launchedRunId)}`}
            className="text-sm text-orange hover:text-orange-dark font-medium transition-colors"
          >
            View run →
          </Link>
        )}
      </div>

      {!canLaunchFromUi ? (
        <div className="mt-5">
          <BackendNotice
            title="Use the CLI for single runs"
            description="The operator form stays visible for the eventual control-plane integration, but the current repo does not expose the POST endpoint needed to start runs from the browser."
            endpoints={["POST /control/runs/launch"]}
            compact
          >
            <Snippet
              dark={false}
              text={[
                "botique-agent-runtime run-days \\",
                `  --shop-id ${(shopId || shops[0]?.shop_id || 1001).toString()} \\`,
                `  --days ${days} \\`,
                `  --turns-per-day ${turnsPerDay} \\`,
                `  --run-id ${runId.trim() || "reference_baseline_01"} \\`,
                `  --mistral-model ${model}`,
              ]}
            />
          </BackendNotice>
        </div>
      ) : null}
    </div>
  );
}
