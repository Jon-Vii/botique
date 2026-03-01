import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { z } from "zod";

import { BadRequestError, NotFoundError } from "../errors";
import {
  tournamentLaunchRequestSchema,
  tournamentLaunchResponseSchema,
  tournamentListItemSchema,
  tournamentResultSchema
} from "../schemas/control";

type TournamentLaunchRequest = z.infer<typeof tournamentLaunchRequestSchema>;
type TournamentLaunchResponse = z.infer<typeof tournamentLaunchResponseSchema>;
type TournamentListItem = z.infer<typeof tournamentListItemSchema>;
type TournamentResult = z.infer<typeof tournamentResultSchema>;

type TournamentControlServiceOptions = {
  artifactsRoot?: string;
  runtimeCliPath?: string;
  applicationBaseUrl: string;
  controlBaseUrl: string;
};

export class TournamentControlService {
  private readonly artifactsRoot: string;
  private readonly runtimeCliPath: string;
  private readonly applicationBaseUrl: string;
  private readonly controlBaseUrl: string;
  private activeTournaments = new Map<string, {
    status: "running" | "completed" | "failed";
    error?: string;
    entrant_count: number;
    round_count: number;
    days_per_round: number;
    scenario_id?: string;
    entrants?: z.infer<typeof tournamentLaunchRequestSchema>["entrants"];
    created_at: string;
  }>();

  constructor(options: TournamentControlServiceOptions) {
    this.artifactsRoot = resolve(options.artifactsRoot ?? join(process.cwd(), "artifacts", "agent-runtime"));
    this.runtimeCliPath = options.runtimeCliPath ?? resolve(process.cwd(), ".venv", "bin", "botique-agent-runtime");
    this.applicationBaseUrl = options.applicationBaseUrl;
    this.controlBaseUrl = options.controlBaseUrl;
  }

  getTournamentStatusInfo(tournamentId: string): { status: string; error?: string } {
    const info = this.activeTournaments.get(tournamentId);
    if (!info) return { status: "unknown" };
    return { status: info.status, ...(info.error ? { error: info.error } : {}) };
  }

  async listTournaments(): Promise<TournamentListItem[]> {
    await mkdir(this.artifactsRoot, { recursive: true });
    const entries = await readdir(this.artifactsRoot, { withFileTypes: true });
    const items: TournamentListItem[] = [];
    const seenIds = new Set<string>();

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifact = await this.readTournamentArtifact(join(this.artifactsRoot, entry.name));
      if (artifact === null) {
        continue;
      }
      items.push(artifact.listItem);
      seenIds.add(artifact.listItem.run_id);
    }

    // Include active tournaments that haven't written artifacts yet
    for (const [id, info] of this.activeTournaments) {
      if (!seenIds.has(id)) {
        const entrants = info.entrants?.map((e) => ({
          entrant_id: e.entrant_id,
          display_name: e.display_name,
          provider: e.provider,
          model: e.model,
        }));
        items.push(tournamentListItemSchema.parse({
          run_id: id,
          scenario: { scenario_id: info.scenario_id ?? "operate", controlled_shop_ids: [] },
          entrant_count: info.entrant_count,
          round_count: info.round_count,
          days_per_round: info.days_per_round,
          created_at: info.created_at,
          status: info.status,
          entrants,
        }));
      }
    }

    return items.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async getTournamentResult(tournamentId: string): Promise<TournamentResult> {
    const artifactDir = await this.findTournamentArtifactDir(tournamentId);
    const result = await this.readTournamentResult(artifactDir);
    const stripped = this.stripHeavyDayData(result);
    return tournamentResultSchema.parse(stripped);
  }

  async launchTournament(request: TournamentLaunchRequest): Promise<TournamentLaunchResponse> {
    const payload = tournamentLaunchRequestSchema.parse(request);
    const tournamentId = payload.run_id?.trim() || `tournament_${Date.now()}`;
    const outputDir = join(this.artifactsRoot, tournamentId);
    const tempDir = await mkdtemp(join(tmpdir(), "botique-tournament-"));
    const entrantsPath = join(tempDir, "entrants.json");

    await writeFile(entrantsPath, JSON.stringify({ entrants: payload.entrants }, null, 2), "utf-8");

    const args = [
      "run-tournament",
      "--entrants-file",
      entrantsPath,
      "--shop-ids",
      payload.shop_ids.join(","),
      "--days",
      String(payload.days_per_round),
      "--rounds",
      String(payload.rounds),
      "--turns-per-day",
      String(payload.turns_per_day),
      "--run-id",
      tournamentId,
      "--base-url",
      this.applicationBaseUrl,
      "--control-base-url",
      this.controlBaseUrl,
      "--output-dir",
      outputDir,
    ];

    if (payload.scenario_id) {
      args.push("--scenario", payload.scenario_id);
    }

    const env = { ...process.env };
    if (payload.api_key) {
      env.MISTRAL_API_KEY = payload.api_key;
    }

    // Fire-and-forget: spawn the process in the background, return immediately
    this.activeTournaments.set(tournamentId, {
      status: "running",
      entrant_count: payload.entrants.length,
      round_count: payload.rounds,
      days_per_round: payload.days_per_round,
      scenario_id: payload.scenario_id,
      entrants: payload.entrants,
      created_at: new Date().toISOString(),
    });

    const child = spawn(this.runtimeCliPath, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const updateStatus = (update: { status: "completed" | "failed"; error?: string }) => {
      const existing = this.activeTournaments.get(tournamentId);
      if (existing) {
        Object.assign(existing, update);
      }
    };

    child.on("close", (code) => {
      rm(tempDir, { recursive: true, force: true }).catch(() => {});

      if (code === 0) {
        try {
          const response = JSON.parse(stdout.trim()) as { ok?: boolean; error?: { message?: string } };
          if (response.ok) {
            updateStatus({ status: "completed" });
          } else {
            updateStatus({ status: "failed", error: response.error?.message ?? "Tournament returned non-ok" });
          }
        } catch {
          updateStatus({ status: "completed" });
        }
      } else {
        let errorMsg = stderr.trim().slice(0, 500) || `Process exited with code ${code}`;
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed?.error?.message) errorMsg = parsed.error.message;
        } catch { /* ignore */ }
        updateStatus({ status: "failed", error: errorMsg });
      }
    });

    child.on("error", (err) => {
      updateStatus({ status: "failed", error: err.message });
      rm(tempDir, { recursive: true, force: true }).catch(() => {});
    });

    return tournamentLaunchResponseSchema.parse({ tournament_id: tournamentId });
  }

  private async findTournamentArtifactDir(tournamentId: string): Promise<string> {
    const directDir = join(this.artifactsRoot, tournamentId);
    if (await this.pathExists(join(directDir, "result.json"))) {
      return directDir;
    }

    const entries = await readdir(this.artifactsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifactDir = join(this.artifactsRoot, entry.name);
      const result = await this.readTournamentResultFileSafe(artifactDir);
      if (result?.run_id === tournamentId) {
        return artifactDir;
      }
    }

    throw new NotFoundError(`Tournament ${tournamentId} was not found.`);
  }

  private async readTournamentArtifact(
    artifactDir: string
  ): Promise<{ listItem: TournamentListItem; result: TournamentResult | null } | null> {
    const manifest = await this.readTournamentManifest(artifactDir);
    const result = await this.readTournamentResultFileSafe(artifactDir, manifest);

    // Try building list item from manifest summary first (fast, avoids parsing huge result.json)
    const summary = manifest?.summary;
    if (summary && typeof summary === "object" && summary.run_id) {
      const generatedAt =
        typeof manifest?.generated_at === "string"
          ? manifest.generated_at
          : (await stat(artifactDir)).mtime.toISOString();

      const scenario =
        summary.scenario ??
        result?.scenario ??
        this.scenarioFromManifest(manifest, summary);

      if (!scenario) {
        return null;
      }

      const winner = summary.winner ?? summary.standings?.[0]?.entrant ?? result?.standings[0]?.entrant;
      const entrants = result?.entrants ?? summary.standings?.map((s: any) => s.entrant) ?? [];
      const parsed = tournamentListItemSchema.safeParse({
        run_id: summary.run_id,
        scenario,
        entrant_count: summary.entrant_count ?? result?.entrants?.length ?? 0,
        round_count: summary.round_count ?? result?.round_count ?? 1,
        days_per_round: summary.days_per_round ?? result?.days_per_round ?? 0,
        created_at: generatedAt,
        status: "completed",
        winner: winner ?? undefined,
        entrants: entrants.length > 0 ? entrants : undefined,
      });
      if (parsed.success) {
        return { result, listItem: parsed.data };
      }
    }

    // Fall back to building from full result
    if (result === null) {
      return null;
    }

    const generatedAt =
      typeof manifest?.generated_at === "string"
        ? manifest.generated_at
        : (await stat(artifactDir)).mtime.toISOString();

    const winner = result.standings[0]?.entrant;
    return {
      result,
      listItem: tournamentListItemSchema.parse({
        run_id: result.run_id,
        scenario: result.scenario,
        entrant_count: result.entrants.length,
        round_count: result.round_count,
        days_per_round: result.days_per_round,
        created_at: generatedAt,
        status: "completed",
        winner: winner ?? undefined,
        entrants: result.entrants,
      }),
    };
  }

  private scenarioFromManifest(manifest: any, summary: any): unknown | null {
    const scenarioId =
      typeof manifest?.invocation?.scenario_id === "string"
        ? manifest.invocation.scenario_id
        : typeof manifest?.invocation?.scenario === "string"
          ? manifest.invocation.scenario
          : null;
    if (!scenarioId) return null;
    return {
      scenario_id: scenarioId,
      controlled_shop_ids: Array.isArray(summary.shop_ids) ? summary.shop_ids : [],
    };
  }

  /** Strip the massive per-day live_day traces to keep the API response small.
   *  Extracts a lightweight balance_timeline per round for charting. */
  private stripHeavyDayData(payload: unknown): unknown {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const value = payload as Record<string, unknown>;
    if (!Array.isArray(value.rounds)) return payload;

    return {
      ...value,
      rounds: (value.rounds as any[]).map((round: any) => {
        const balanceTimeline: { entrant_id: string; day: number; balance: number }[] = [];

        const days = Array.isArray(round.days)
          ? round.days.map((day: any) => {
              const entrant_results = Array.isArray(day.entrant_results)
                ? day.entrant_results.map((er: any) => {
                    const entrantId = er.entrant?.entrant_id ?? er.entrant_id;
                    const liveDayObj = typeof er.live_day === "object" && er.live_day !== null ? er.live_day : null;
                    const dayNum = liveDayObj?.day ?? (typeof er.live_day === "number" ? er.live_day : day.day);

                    // Extract balance for timeline
                    const balance = liveDayObj?.state_after?.balance_summary?.available;
                    if (entrantId && typeof balance === "number") {
                      balanceTimeline.push({ entrant_id: entrantId, day: dayNum, balance });
                    }

                    return {
                      entrant: er.entrant,
                      entrant_id: entrantId,
                      live_day: dayNum,
                    };
                  })
                : [];
              return {
                day: day.day,
                simulation_date: day.simulation_date,
                turn_order: day.turn_order,
                entrant_results,
              };
            })
          : [];

        return {
          ...round,
          days,
          balance_timeline: balanceTimeline,
        };
      }),
    };
  }

  private async readTournamentResultFile(artifactDir: string): Promise<unknown> {
    const payload = await this.readJson(join(artifactDir, "result.json"));
    return payload;
  }

  private async readTournamentResult(artifactDir: string): Promise<unknown> {
    const [payload, manifest] = await Promise.all([
      this.readTournamentResultFile(artifactDir),
      this.readTournamentManifest(artifactDir),
    ]);

    return this.withTournamentScenario(payload, manifest);
  }

  private async readTournamentResultFileSafe(
    artifactDir: string,
    manifest?: any | null,
  ): Promise<TournamentResult | null> {
    try {
      const payload =
        manifest === undefined
          ? await this.readTournamentResult(artifactDir)
          : this.withTournamentScenario(
              await this.readTournamentResultFile(artifactDir),
              manifest,
            );
      const stripped = this.stripHeavyDayData(payload);
      const parsed = tournamentResultSchema.safeParse(stripped);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async readTournamentManifest(artifactDir: string): Promise<any | null> {
    return this.readJsonSafe(join(artifactDir, "manifest.json"));
  }

  private withTournamentScenario(payload: unknown, manifest: any | null): unknown {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return payload;
    }

    const value = payload as Record<string, unknown>;
    if (value.scenario) {
      return payload;
    }

    const manifestScenario =
      manifest?.summary?.scenario ??
      (() => {
        const scenarioId =
          typeof manifest?.invocation?.scenario_id === "string"
            ? manifest.invocation.scenario_id
            : typeof manifest?.invocation?.scenario === "string"
              ? manifest.invocation.scenario
              : null;
        return scenarioId
          ? {
              scenario_id: scenarioId,
              controlled_shop_ids: Array.isArray(value.shop_ids)
                ? value.shop_ids
                : [],
            }
          : null;
      })();

    if (!manifestScenario) {
      return payload;
    }

    return {
      ...value,
      scenario: manifestScenario,
    };
  }

  private async readJson(path: string): Promise<unknown> {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  }

  private async readJsonSafe(path: string): Promise<any | null> {
    try {
      return await this.readJson(path);
    } catch {
      return null;
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
