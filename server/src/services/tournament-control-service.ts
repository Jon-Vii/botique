import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import { BadRequestError, NotFoundError } from "../errors";
import {
  tournamentLaunchRequestSchema,
  tournamentLaunchResponseSchema,
  tournamentListItemSchema,
  tournamentResultSchema
} from "../schemas/control";

const execFileAsync = promisify(execFile);

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

  constructor(options: TournamentControlServiceOptions) {
    this.artifactsRoot = resolve(options.artifactsRoot ?? join(process.cwd(), "artifacts", "agent-runtime"));
    this.runtimeCliPath = options.runtimeCliPath ?? resolve(process.cwd(), ".venv", "bin", "botique-agent-runtime");
    this.applicationBaseUrl = options.applicationBaseUrl;
    this.controlBaseUrl = options.controlBaseUrl;
  }

  async listTournaments(): Promise<TournamentListItem[]> {
    await mkdir(this.artifactsRoot, { recursive: true });
    const entries = await readdir(this.artifactsRoot, { withFileTypes: true });
    const items: TournamentListItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifact = await this.readTournamentArtifact(join(this.artifactsRoot, entry.name));
      if (artifact === null) {
        continue;
      }
      items.push(artifact.listItem);
    }

    return items.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async getTournamentResult(tournamentId: string): Promise<TournamentResult> {
    const artifactDir = await this.findTournamentArtifactDir(tournamentId);
    const result = await this.readTournamentResult(artifactDir);
    return tournamentResultSchema.parse(result);
  }

  async launchTournament(request: TournamentLaunchRequest): Promise<TournamentLaunchResponse> {
    const payload = tournamentLaunchRequestSchema.parse(request);
    const tournamentId = payload.run_id?.trim() || `tournament_${Date.now()}`;
    const outputDir = join(this.artifactsRoot, tournamentId);
    const tempDir = await mkdtemp(join(tmpdir(), "botique-tournament-"));
    const entrantsPath = join(tempDir, "entrants.json");

    try {
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

      const { stdout, stderr } = await execFileAsync(this.runtimeCliPath, args, {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });

      const raw = stdout.trim();
      if (!raw) {
        throw new BadRequestError(`Tournament runtime produced no output.${stderr ? ` ${stderr}` : ""}`);
      }

      const response = JSON.parse(raw) as { ok?: boolean; error?: { message?: string } };
      if (!response.ok) {
        throw new BadRequestError(response.error?.message ?? "Tournament launch failed.");
      }

      await access(join(outputDir, "result.json"));
      return tournamentLaunchResponseSchema.parse({ tournament_id: tournamentId });
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Tournament launch failed.";
      throw new BadRequestError(message);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
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
  ): Promise<{ listItem: TournamentListItem; result: TournamentResult } | null> {
    const manifest = await this.readTournamentManifest(artifactDir);
    const result = await this.readTournamentResultFileSafe(artifactDir, manifest);
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
      const parsed = tournamentResultSchema.safeParse(payload);
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
