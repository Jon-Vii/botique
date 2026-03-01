import { execFile, spawn } from "node:child_process";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import { BadRequestError, NotFoundError } from "../errors";
import type { SimulationModule } from "../simulation/world-simulation";
import type { StoredWorldState } from "../simulation/state-types";
import {
  dayBriefingSchema,
  daySnapshotListSchema,
  memoryNoteListSchema,
  memoryReminderListSchema,
  runLaunchRequestSchema,
  runLaunchResponseSchema,
  runListEntrySchema,
  runManifestSchema,
  runProgressSchema,
  runSummarySchema,
  turnRecordListSchema,
  workspaceRevisionListSchema,
  workspaceSchema,
} from "../schemas/control";

const execFileAsync = promisify(execFile);

type RunLaunchRequest = z.infer<typeof runLaunchRequestSchema>;
type RunLaunchResponse = z.infer<typeof runLaunchResponseSchema>;
type RunListEntry = z.infer<typeof runListEntrySchema>;
type RunProgress = z.infer<typeof runProgressSchema>;
type RunSummary = z.infer<typeof runSummarySchema>;
type RunManifest = z.infer<typeof runManifestSchema>;
type DaySnapshot = z.infer<typeof daySnapshotListSchema>[number];
type DayBriefing = z.infer<typeof dayBriefingSchema>;
type TurnRecord = z.infer<typeof turnRecordListSchema>[number];
type MemoryNote = z.infer<typeof memoryNoteListSchema>[number];
type MemoryReminder = z.infer<typeof memoryReminderListSchema>[number];
type Workspace = z.infer<typeof workspaceSchema>;
type WorkspaceRevision = z.infer<typeof workspaceRevisionListSchema>[number];

type RunControlServiceOptions = {
  artifactsRoot?: string;
  runtimeCliPath?: string;
  applicationBaseUrl: string;
  controlBaseUrl: string;
};

type RunArtifact = {
  artifactDir: string;
  manifest: any | null;
  summary: any;
  createdAt: string;
};

export class RunControlService {
  private readonly artifactsRoot: string;
  private readonly runtimeCliPath: string;
  private readonly applicationBaseUrl: string;
  private readonly controlBaseUrl: string;

  constructor(options: RunControlServiceOptions) {
    this.artifactsRoot = resolve(options.artifactsRoot ?? join(process.cwd(), "artifacts", "agent-runtime"));
    this.runtimeCliPath = options.runtimeCliPath ?? resolve(process.cwd(), ".venv", "bin", "botique-agent-runtime");
    this.applicationBaseUrl = options.applicationBaseUrl;
    this.controlBaseUrl = options.controlBaseUrl;
  }

  async listRuns(): Promise<RunListEntry[]> {
    await mkdir(this.artifactsRoot, { recursive: true });
    const entries = await readdir(this.artifactsRoot, { withFileTypes: true });
    const runs: RunListEntry[] = [];
    const completedRunIds = new Set<string>();

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifact = await this.readRunArtifact(join(this.artifactsRoot, entry.name));
      if (artifact === null) {
        continue;
      }

      const normalized = normalizeRunListEntryPayload(
        artifact.summary,
        artifact.manifest,
        artifact.createdAt,
      );
      if (normalized) {
        runs.push(runListEntrySchema.parse(normalized));
        completedRunIds.add(normalized.run_id);
      }
    }

    // Detect in-progress runs (have progress.json but no summary.json)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(this.artifactsRoot, entry.name);
      const hasSummary = await this.pathExists(join(dir, "summary.json"));
      if (hasSummary) continue;
      const progress = await this.readJsonSafe(join(dir, "progress.json"));
      if (!progress || typeof progress !== "object") continue;
      const runId = progress.run_id;
      if (typeof runId !== "string" || completedRunIds.has(runId)) continue;

      runs.push(runListEntrySchema.parse({
        run_id: runId,
        shop_id: typeof progress.shop_id === "number" ? progress.shop_id : 1,
        mode: "live" as const,
        day_count: progress.total_days ?? 1,
        has_summary: false,
        has_manifest: false,
        created_at: progress.updated_at ?? new Date().toISOString(),
        status: progress.status ?? "running",
        completed_day_count: progress.completed_day_count ?? 0,
      }));
    }

    // Sort: running runs first, then by created_at descending
    return runs.sort((left, right) => {
      const leftRunning = left.status === "running" ? 0 : 1;
      const rightRunning = right.status === "running" ? 0 : 1;
      if (leftRunning !== rightRunning) return leftRunning - rightRunning;
      return (right.created_at ?? "").localeCompare(left.created_at ?? "");
    });
  }

  async getRunProgress(runId: string): Promise<RunProgress | null> {
    const progressPath = join(this.artifactsRoot, runId, "progress.json");
    const progress = await this.readJsonSafe(progressPath);
    if (!progress || typeof progress !== "object") return null;
    try {
      return runProgressSchema.parse(progress);
    } catch {
      return null;
    }
  }

  async getRunSummary(runId: string): Promise<RunSummary> {
    const artifact = await this.getRunArtifact(runId);
    const payload = normalizeRunSummaryPayload(artifact.summary, artifact.manifest);
    return runSummarySchema.parse(payload);
  }

  async getRunManifest(runId: string): Promise<RunManifest> {
    const artifact = await this.getRunArtifact(runId);
    if (artifact.manifest === null) {
      throw new NotFoundError(`Run ${runId} is missing a manifest.`);
    }
    return runManifestSchema.parse(normalizeRunManifestPayload(artifact.manifest, artifact.summary));
  }

  async getRunDaySnapshots(runId: string): Promise<DaySnapshot[]> {
    const artifact = await this.getRunArtifact(runId);
    const days = Array.isArray(artifact.summary.days) ? artifact.summary.days : [];
    return daySnapshotListSchema.parse(days.map(normalizeDaySnapshotPayload));
  }

  async getRunDayBriefing(runId: string, day: number): Promise<DayBriefing> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const briefing = await this.readJson(join(artifactDir, "days", formatDayDirectory(day), "briefing.json"));
    return dayBriefingSchema.parse(normalizeDayBriefingPayload(briefing));
  }

  async getRunDayTurns(runId: string, day: number): Promise<TurnRecord[]> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const turns = await this.readJson(join(artifactDir, "days", formatDayDirectory(day), "turns.json"));
    if (!Array.isArray(turns)) {
      throw new NotFoundError(`Run ${runId} day ${day} does not have turn records.`);
    }
    return turnRecordListSchema.parse(turns.map(normalizeTurnRecordPayload));
  }

  async getRunMemoryNotes(runId: string): Promise<MemoryNote[]> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const entries = await this.readJsonSafe(join(artifactDir, "memory", "workspace_entries.json"));
    if (!Array.isArray(entries)) {
      return [];
    }
    return memoryNoteListSchema.parse(entries.map(normalizeWorkspaceEntryAsNote));
  }

  async getRunMemoryReminders(runId: string): Promise<MemoryReminder[]> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const reminders = await this.readJsonSafe(join(artifactDir, "memory", "reminders.json"));
    if (!Array.isArray(reminders)) {
      return [];
    }
    return memoryReminderListSchema.parse(reminders.map(normalizeReminderPayload));
  }

  async getRunWorkspace(runId: string): Promise<Workspace> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const workspace = await this.readJsonSafe(join(artifactDir, "memory", "workspace.json"));
    if (workspace === null || typeof workspace !== "object") {
      return null;
    }
    return workspaceSchema.parse(workspace);
  }

  async getRunWorkspaceRevisions(runId: string): Promise<WorkspaceRevision[]> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const revisions = await this.readJsonSafe(join(artifactDir, "memory", "workspace_revisions.json"));
    if (!Array.isArray(revisions)) {
      return [];
    }
    return workspaceRevisionListSchema.parse(revisions);
  }

  private activeRuns = new Map<string, { status: "running" | "completed" | "failed"; error?: string }>();

  getRunStatus(runId: string): "running" | "completed" | "failed" | "unknown" {
    return this.activeRuns.get(runId)?.status ?? "unknown";
  }

  getRunStatusInfo(runId: string): { status: string; error?: string } {
    const info = this.activeRuns.get(runId);
    if (!info) return { status: "unknown" };
    return { status: info.status, ...(info.error ? { error: info.error } : {}) };
  }

  async launchRun(request: RunLaunchRequest): Promise<RunLaunchResponse> {
    const payload = runLaunchRequestSchema.parse(request);
    const runId = payload.run_id?.trim() || `run_${Date.now()}`;
    const outputDir = join(this.artifactsRoot, runId);

    const args = [
      "run-days",
      "--shop-id",
      String(payload.shop_id),
      "--days",
      String(payload.days),
      "--turns-per-day",
      String(payload.turns_per_day),
      "--run-id",
      runId,
      "--base-url",
      this.applicationBaseUrl,
      "--control-base-url",
      this.controlBaseUrl,
      "--output-dir",
      outputDir,
      "--reset-world",
      "--mistral-model",
      payload.model,
      "--provider",
      payload.provider,
    ];

    const scenarioId = payload.scenario_id ?? payload.scenario;
    if (scenarioId) {
      args.push("--scenario", scenarioId);
    }

    const env = { ...process.env };
    if (payload.api_key) {
      env.MISTRAL_API_KEY = payload.api_key;
    }

    // Fire-and-forget: spawn the process in the background, return immediately
    this.activeRuns.set(runId, { status: "running" });

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

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const response = JSON.parse(stdout.trim()) as { ok?: boolean; error?: { message?: string } };
          if (response.ok) {
            this.activeRuns.set(runId, { status: "completed" });
          } else {
            this.activeRuns.set(runId, {
              status: "failed",
              error: response.error?.message ?? "Run returned non-ok",
            });
          }
        } catch {
          this.activeRuns.set(runId, { status: "completed" });
        }
      } else {
        // Try to parse structured error from stdout (the CLI outputs JSON on failure)
        let errorMsg = stderr.trim().slice(0, 500) || `Process exited with code ${code}`;
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed?.error?.message) errorMsg = parsed.error.message;
        } catch { /* ignore */ }
        this.activeRuns.set(runId, { status: "failed", error: errorMsg });
      }
    });

    child.on("error", (err) => {
      this.activeRuns.set(runId, { status: "failed", error: err.message });
    });

    return runLaunchResponseSchema.parse({ run_id: runId });
  }

  async simulateRun(
    simulation: SimulationModule,
    options: { shop_id: number; days: number; scenario_id?: "operate" | "bootstrap" },
  ): Promise<{ run_id: string }> {
    const runId = `sim_${Date.now().toString(36)}`;
    const shopId = options.shop_id;

    // Reset world with scenario
    await simulation.resetWorld({
      scenario_id: options.scenario_id,
      controlled_shop_ids: [shopId],
    });

    const startWorld = await simulation.getWorldState();
    const startState = extractShopSnapshot(startWorld, shopId);
    const days: any[] = [];

    let previousBalance = startState.available_balance;

    for (let i = 0; i < options.days; i++) {
      // Don't mark shop as controlled — no agent is running, so NPC auto-replenishment should kick in
      const result = await simulation.advanceDay({});
      const world = result.world;
      const snapshot = extractShopSnapshot(world, shopId);
      const yesterdayRevenue = Math.max(snapshot.available_balance - previousBalance, 0);
      previousBalance = snapshot.available_balance;

      days.push({
        day: snapshot.day,
        simulation_date: snapshot.simulation_date,
        state_before: i === 0 ? startState : days[i - 1].state_after,
        state_after: snapshot,
        state_next_day: snapshot,
        turn_count: 0,
        yesterday_revenue: yesterdayRevenue,
        tool_calls: [],
      });
    }

    const endState = days.length > 0 ? days[days.length - 1].state_after : startState;
    const scenario = options.scenario_id
      ? { scenario_id: options.scenario_id, controlled_shop_ids: [shopId] }
      : { scenario_id: "operate" as const, controlled_shop_ids: [shopId] };

    const summary = {
      run_id: runId,
      shop_id: shopId,
      mode: "live",
      day_count: options.days,
      scenario,
      identity: { provider: "simulation", model: "demand-model" },
      start_day: startState.day ?? 1,
      end_day: endState.day ?? options.days,
      start_simulation_date: startState.simulation_date ?? "",
      end_simulation_date: endState.simulation_date ?? "",
      starting_state: startState,
      ending_state: endState,
      totals: {
        tool_call_count: 0,
        tool_calls_by_name: {},
        tool_calls_by_surface: {},
        turn_count: 0,
        yesterday_revenue: days.reduce((sum, d) => sum + d.yesterday_revenue, 0),
        notes_written: 0,
        reminders_set: 0,
        reminders_completed: 0,
        simulation_advances: options.days,
      },
      memory: { note_count: 0, reminder_count: 0, pending_reminder_count: 0 },
      days,
    };

    const manifest = {
      artifact_version: 1,
      run_id: runId,
      shop_id: shopId,
      mode: "live",
      day_count: options.days,
      generated_at: new Date().toISOString(),
      invocation: {
        command: "simulate",
        days: options.days,
        shop_id: shopId,
        run_id: runId,
        provider: "simulation",
        model: "demand-model",
        scenario_id: options.scenario_id ?? "operate",
      },
    };

    // Write artifacts
    const outputDir = join(this.artifactsRoot, runId);
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
    await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // Write day subdirectories
    for (const day of days) {
      const dayDir = join(outputDir, "days", formatDayDirectory(day.day));
      await mkdir(dayDir, { recursive: true });
      await writeFile(join(dayDir, "record.json"), JSON.stringify(day, null, 2));
    }

    return { run_id: runId };
  }

  private async getRunArtifact(runId: string): Promise<RunArtifact> {
    const artifactDir = await this.findRunArtifactDir(runId);
    const summary = await this.readJson(join(artifactDir, "summary.json"));
    const manifest = await this.readJsonSafe(join(artifactDir, "manifest.json"));
    const createdAt = await this.resolveCreatedAt(artifactDir, manifest, summary);
    return {
      artifactDir,
      manifest,
      summary,
      createdAt,
    };
  }

  private async findRunArtifactDir(runId: string): Promise<string> {
    const directDir = join(this.artifactsRoot, runId);
    if (await this.pathExists(join(directDir, "summary.json"))) {
      const artifact = await this.readRunArtifact(directDir);
      if (artifact?.summary.run_id === runId) {
        return directDir;
      }
    }

    const entries = await readdir(this.artifactsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifactDir = join(this.artifactsRoot, entry.name);
      const artifact = await this.readRunArtifact(artifactDir);
      if (artifact?.summary.run_id === runId) {
        return artifactDir;
      }
    }

    throw new NotFoundError(`Run ${runId} was not found.`);
  }

  private async readRunArtifact(artifactDir: string): Promise<RunArtifact | null> {
    const summary = await this.readJsonSafe(join(artifactDir, "summary.json"));
    if (summary === null || typeof summary !== "object") {
      return null;
    }
    if (isTournamentSummary(summary)) {
      return null;
    }

    const manifest = await this.readJsonSafe(join(artifactDir, "manifest.json"));

    const createdAt = await this.resolveCreatedAt(artifactDir, manifest, summary);
    return { artifactDir, manifest, summary, createdAt };
  }

  private async resolveCreatedAt(artifactDir: string, manifest: any | null, summary: any): Promise<string> {
    if (typeof manifest?.generated_at === "string") {
      return manifest.generated_at;
    }
    if (typeof summary?.generated_at === "string") {
      return summary.generated_at;
    }
    return (await stat(artifactDir)).mtime.toISOString();
  }

  private async readJson(path: string): Promise<any> {
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

function isTournamentSummary(summary: any): boolean {
  return typeof summary?.round_count === "number" && Array.isArray(summary?.rounds);
}

function formatDayDirectory(day: number): string {
  return `day-${String(day).padStart(4, "0")}`;
}

function normalizeRunSummaryPayload(summary: any, manifest: any | null) {
  const scenario = extractRunScenario(summary);
  const identity = extractRunIdentity(manifest, summary);
  const dayCount = getRunDayCount(summary, manifest);
  const startDay = getRunStartDay(summary);
  const endDay = getRunEndDay(summary, dayCount, startDay);
  const startDate = getRunStartSimulationDate(summary);
  const endDate = getRunEndSimulationDate(summary, startDate);
  const startingState = normalizeStartingState(summary, startDate, startDay);
  const endingState = normalizeEndingState(summary, endDate, endDay);

  return {
    run_id: summary.run_id,
    shop_id: summary.shop_id,
    shop_name: summary.shop_name ?? null,
    mode: getRunMode(summary),
    day_count: dayCount,
    scenario,
    identity,
    start_day: startDay,
    end_day: endDay,
    start_simulation_date: startDate,
    end_simulation_date: endDate,
    starting_state: startingState,
    ending_state: endingState,
    totals: {
      tool_call_count: summary?.totals?.tool_call_count ?? summarizeLegacyActionCount(summary),
      tool_calls_by_name:
        summary?.totals?.tool_calls_by_name ?? summarizeLegacyToolCalls(summary),
      tool_calls_by_surface: summary?.totals?.tool_calls_by_surface ?? {},
      turn_count: summary?.totals?.turn_count ?? summarizeLegacyTurnCount(summary),
      yesterday_revenue:
        summary?.totals?.yesterday_revenue ?? summarizeLegacyYesterdayRevenue(summary),
      notes_written:
        summary?.totals?.workspace_entries_added ?? normalizeNonNegativeInteger(summary?.note_count) ?? 0,
      reminders_set:
        summary?.totals?.reminders_set ?? normalizeNonNegativeInteger(summary?.reminder_count) ?? 0,
      reminders_completed: summary?.totals?.reminders_completed ?? 0,
      simulation_advances:
        summary?.totals?.simulation_advances ?? Math.max(dayCount - 1, 0),
    },
    memory: {
      note_count:
        summary?.memory?.workspace_entry_count ?? normalizeNonNegativeInteger(summary?.note_count) ?? 0,
      reminder_count:
        summary?.memory?.reminder_count ?? normalizeNonNegativeInteger(summary?.reminder_count) ?? 0,
      pending_reminder_count: summary?.memory?.pending_reminder_count ?? 0,
    },
  };
}

function normalizeRunManifestPayload(manifest: any, summary: any) {
  const scenario = extractRunScenario(summary);
  const identity = extractRunIdentity(manifest, summary);
  const rawInvocation =
    manifest?.invocation && typeof manifest.invocation === "object"
      ? manifest.invocation
      : {};

  return {
    artifact_version: manifest?.artifact_version ?? 1,
    run_id: manifest?.run_id ?? summary?.run_id,
    shop_id: manifest?.shop_id ?? summary?.shop_id,
    mode: manifest?.mode ?? getRunMode(summary),
    day_count: getRunDayCount(summary, manifest),
    scenario,
    identity,
    invocation: {
      ...rawInvocation,
      command: rawInvocation.command ?? "run-days",
      days: rawInvocation.days ?? getRunDayCount(summary, manifest),
      max_turns: rawInvocation.max_turns ?? rawInvocation.turns_per_day ?? null,
      turns_per_day: rawInvocation.turns_per_day ?? rawInvocation.max_turns ?? null,
      shop_id: rawInvocation.shop_id ?? String(summary?.shop_id ?? ""),
      run_id: rawInvocation.run_id ?? summary?.run_id ?? "",
      provider: rawInvocation.provider ?? identity?.provider,
      model: rawInvocation.model ?? identity?.model,
      mistral_model: rawInvocation.mistral_model ?? identity?.model,
      temperature:
        rawInvocation.temperature ?? rawInvocation.mistral_temperature ?? identity?.temperature,
      mistral_temperature:
        rawInvocation.mistral_temperature ?? rawInvocation.temperature ?? identity?.temperature,
      top_p: rawInvocation.top_p ?? rawInvocation.mistral_top_p ?? identity?.top_p,
      mistral_top_p:
        rawInvocation.mistral_top_p ?? rawInvocation.top_p ?? identity?.top_p,
      scenario: rawInvocation.scenario ?? rawInvocation.scenario_id ?? scenario?.scenario_id,
      scenario_id:
        rawInvocation.scenario_id ?? rawInvocation.scenario ?? scenario?.scenario_id,
    },
    summary: {
      scenario,
      identity,
    },
  };
}

function normalizeRunListEntryPayload(
  summary: any,
  manifest: any | null,
  createdAt: string,
) {
  const runId =
    typeof summary?.run_id === "string" && summary.run_id.trim()
      ? summary.run_id
      : undefined;
  const shopId = normalizePositiveInteger(summary?.shop_id);
  const dayCount = getRunDayCount(summary, manifest);

  if (!runId || !shopId || !dayCount) {
    return undefined;
  }

  return {
    run_id: runId,
    shop_id: shopId,
    mode: getRunMode(summary),
    day_count: dayCount,
    scenario: extractRunScenario(summary),
    identity: extractRunIdentity(manifest, summary),
    has_summary: true,
    has_manifest: manifest !== null,
    created_at: createdAt,
  };
}

function normalizeDaySnapshotPayload(day: any) {
  const state = day?.state_after ?? day?.state_before ?? day?.state_next_day;
  return {
    day: state?.day ?? day?.day,
    simulation_date: state?.simulation_date ?? day?.simulation_date,
    available_balance: state?.available_balance ?? 0,
    currency_code: state?.currency_code ?? "USD",
    active_listing_count: state?.active_listing_count ?? 0,
    draft_listing_count: state?.draft_listing_count ?? 0,
    total_sales_count: state?.total_sales_count ?? 0,
    review_average: state?.review_average ?? 0,
    review_count: state?.review_count ?? 0,
    turn_count: day?.turn_count,
    yesterday_revenue: day?.yesterday_revenue ?? 0,
    tool_calls: Array.isArray(day?.tool_calls) ? day.tool_calls : [],
  };
}

function normalizeDayBriefingPayload(briefing: any) {
  return {
    day: briefing?.day,
    shop_id: briefing?.shop_id,
    shop_name: briefing?.shop_name,
    run_id: briefing?.run_id,
    generated_at: briefing?.generated_at,
    balance_summary: briefing?.balance_summary,
    objective_progress: briefing?.objective_progress,
    listing_changes: briefing?.listing_changes ?? [],
    market_movements: briefing?.market_movements ?? [],
    yesterday_orders: {
      order_count: briefing?.yesterday_orders?.order_count ?? 0,
      revenue: briefing?.yesterday_orders?.revenue ?? 0,
      average_order_value: briefing?.yesterday_orders?.average_order_value ?? 0,
      refunded_order_count: briefing?.yesterday_orders?.refunded_order_count ?? 0,
    },
    new_reviews: briefing?.new_reviews ?? [],
    new_customer_messages: briefing?.new_customer_messages ?? [],
    notes: briefing?.recent_workspace_entries ?? [],
    due_reminders: briefing?.due_reminders ?? [],
    priorities_prompt: briefing?.priorities_prompt ?? "",
  };
}

function normalizeTurnRecordPayload(turn: any) {
  return {
    turn_index: turn?.turn_index ?? 0,
    tool_call: {
      name: turn?.tool_call?.name ?? "",
      arguments: turn?.tool_call?.arguments ?? {},
    },
    tool_result: {
      tool_name: turn?.tool_result?.tool_name ?? "",
      arguments: turn?.tool_result?.arguments ?? {},
      output: turn?.tool_result?.output ?? null,
      surface: turn?.tool_result?.surface,
    },
    decision_summary: turn?.decision_summary ?? "",
    assistant_text: turn?.assistant_text ?? "",
    started_at: turn?.started_at ?? "",
    completed_at: turn?.completed_at ?? "",
    state_changes: turn?.state_changes ?? null,
    provider_tool_calls: Array.isArray(turn?.provider_tool_calls)
      ? turn.provider_tool_calls.map((call: any, index: number) => ({
          call_id: call?.call_id ?? call?.id ?? `provider_call_${index + 1}`,
          name: call?.name ?? "",
          arguments: call?.arguments ?? {},
        }))
      : undefined,
  };
}

function normalizeWorkspaceEntryAsNote(entry: any) {
  const body = typeof entry?.content === "string" ? entry.content : "";
  return {
    note_id: entry?.entry_id ?? "",
    shop_id: entry?.shop_id ?? 0,
    title: inferMemoryTitle(body, "Journal entry"),
    body,
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    created_day: entry?.created_day ?? 0,
    created_at: entry?.created_at ?? "",
  };
}

function normalizeReminderPayload(reminder: any) {
  const body = typeof reminder?.content === "string" ? reminder.content : "";
  return {
    reminder_id: reminder?.reminder_id ?? "",
    shop_id: reminder?.shop_id ?? 0,
    title: inferMemoryTitle(body, "Reminder"),
    body,
    due_day: reminder?.due_day ?? 0,
    completed: reminder?.status === "completed",
    created_at: reminder?.created_at ?? "",
  };
}

function inferMemoryTitle(content: string, fallback: string): string {
  const firstLine = content
    .split(/\r?\n/, 1)[0]
    ?.trim();
  if (!firstLine) {
    return fallback;
  }
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function extractRunScenario(summary: any):
  | { scenario_id: "operate" | "bootstrap"; controlled_shop_ids: number[] }
  | undefined {
  const rawScenario = summary?.scenario;
  const scenarioId = rawScenario?.scenario_id ?? rawScenario;

  if (scenarioId !== "operate" && scenarioId !== "bootstrap") {
    return undefined;
  }

  return {
    scenario_id: scenarioId,
    controlled_shop_ids: Array.isArray(rawScenario?.controlled_shop_ids)
      ? rawScenario.controlled_shop_ids
          .filter((value: unknown): value is number => Number.isInteger(value))
      : [],
  };
}

function extractRunProvider(manifest: any | null | undefined): string | undefined {
  const provider = manifest?.invocation?.provider ?? manifest?.provider;
  return typeof provider === "string" && provider.trim() ? provider : undefined;
}

function extractRunModel(manifest: any | null | undefined): string | undefined {
  const model =
    manifest?.invocation?.model ??
    manifest?.invocation?.mistral_model ??
    manifest?.model;
  return typeof model === "string" && model.trim() ? model : undefined;
}

function extractRunIdentity(
  manifest: any | null | undefined,
  summary: any | null | undefined,
) {
  const rawIdentity =
    summary?.identity && typeof summary.identity === "object"
      ? summary.identity
      : undefined;
  const turnsPerDay = normalizePositiveInteger(
    rawIdentity?.turns_per_day ??
      manifest?.invocation?.turns_per_day ??
      manifest?.invocation?.max_turns,
  );
  const temperature = normalizeNumber(
    rawIdentity?.temperature ??
      manifest?.invocation?.temperature ??
      manifest?.invocation?.mistral_temperature,
  );
  const topP = normalizeNumber(
    rawIdentity?.top_p ??
      manifest?.invocation?.top_p ??
      manifest?.invocation?.mistral_top_p,
  );

  const identity = {
    provider:
      (typeof rawIdentity?.provider === "string" && rawIdentity.provider.trim()
        ? rawIdentity.provider
        : undefined) ?? extractRunProvider(manifest),
    model:
      (typeof rawIdentity?.model === "string" && rawIdentity.model.trim()
        ? rawIdentity.model
        : undefined) ?? extractRunModel(manifest),
    turns_per_day: turnsPerDay,
    temperature,
    top_p: topP,
  };

  return Object.values(identity).some((value) => value !== undefined)
    ? identity
    : undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

function getLegacyDays(summary: any): any[] {
  return Array.isArray(summary?.days) ? summary.days : [];
}

function getRunDayCount(summary: any, manifest: any | null): number {
  return (
    normalizePositiveInteger(summary?.day_count) ??
    normalizePositiveInteger(manifest?.day_count) ??
    normalizePositiveInteger(manifest?.invocation?.days) ??
    getLegacyDays(summary).length ??
    1
  );
}

function getRunMode(summary: any): "live" | "mock" {
  return summary?.mode === "mock" ? "mock" : "live";
}

function getRunStartDay(summary: any): number {
  const days = getLegacyDays(summary);
  return (
    normalizePositiveInteger(summary?.start_day) ??
    normalizePositiveInteger(days[0]?.day) ??
    normalizePositiveInteger(summary?.starting_state?.day) ??
    normalizePositiveInteger(summary?.final_state?.day) ??
    1
  );
}

function getRunEndDay(summary: any, dayCount: number, startDay: number): number {
  const days = getLegacyDays(summary);
  return (
    normalizePositiveInteger(summary?.end_day) ??
    normalizePositiveInteger(days.at(-1)?.day) ??
    normalizePositiveInteger(summary?.ending_state?.day) ??
    normalizePositiveInteger(summary?.final_state?.day) ??
    Math.max(startDay + dayCount - 1, startDay)
  );
}

function getRunStartSimulationDate(summary: any): string {
  const days = getLegacyDays(summary);
  return (
    readString(summary?.start_simulation_date) ??
    readString(summary?.starting_state?.simulation_date) ??
    readString(days[0]?.simulation_date) ??
    readString(summary?.end_simulation_date) ??
    readString(summary?.ending_state?.simulation_date) ??
    readString(summary?.final_state?.simulation_date) ??
    new Date(0).toISOString()
  );
}

function getRunEndSimulationDate(summary: any, fallback: string): string {
  const days = getLegacyDays(summary);
  return (
    readString(summary?.end_simulation_date) ??
    readString(summary?.ending_state?.simulation_date) ??
    readString(summary?.final_state?.simulation_date) ??
    readString(days.at(-1)?.simulation_date) ??
    fallback
  );
}

function normalizeStartingState(summary: any, simulationDate: string, day: number) {
  if (summary?.starting_state && typeof summary.starting_state === "object") {
    return summary.starting_state;
  }

  const firstDay = getLegacyDays(summary)[0];
  return {
    available_balance: normalizeNumber(firstDay?.balance_before) ?? 0,
    currency_code: readString(summary?.final_state?.currency_code) ?? "USD",
    active_listing_count: normalizeNonNegativeInteger(firstDay?.active_before) ?? 0,
    draft_listing_count: normalizeNonNegativeInteger(firstDay?.draft_before) ?? 0,
    total_sales_count: 0,
    review_average: normalizeNumber(summary?.final_state?.review_average) ?? 0,
    review_count: normalizeNonNegativeInteger(summary?.final_state?.review_count) ?? 0,
    simulation_date: simulationDate,
    day,
  };
}

function normalizeEndingState(summary: any, simulationDate: string, day: number) {
  if (summary?.ending_state && typeof summary.ending_state === "object") {
    return summary.ending_state;
  }

  const finalState =
    summary?.final_state && typeof summary.final_state === "object"
      ? summary.final_state
      : {};
  return {
    available_balance: normalizeNumber(finalState.available_balance) ?? 0,
    currency_code: readString(finalState.currency_code) ?? "USD",
    active_listing_count: normalizeNonNegativeInteger(finalState.active_listing_count) ?? 0,
    draft_listing_count: normalizeNonNegativeInteger(finalState.draft_listing_count) ?? 0,
    total_sales_count: normalizeNonNegativeInteger(finalState.total_sales_count) ?? 0,
    review_average: normalizeNumber(finalState.review_average) ?? 0,
    review_count: normalizeNonNegativeInteger(finalState.review_count) ?? 0,
    simulation_date: simulationDate,
    day,
  };
}

function summarizeLegacyActionCount(summary: any): number {
  return getLegacyDays(summary).reduce((total, day) => {
    if (Array.isArray(day?.actions)) {
      return total + day.actions.length;
    }
    return total + (normalizeNonNegativeInteger(day?.turns_used) ?? 0);
  }, 0);
}

function summarizeLegacyTurnCount(summary: any): number {
  return getLegacyDays(summary).reduce(
    (total, day) =>
      total +
      (normalizeNonNegativeInteger(day?.turns_used) ??
        (Array.isArray(day?.actions) ? day.actions.length : 0)),
    0,
  );
}

function summarizeLegacyToolCalls(summary: any): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const day of getLegacyDays(summary)) {
    if (!Array.isArray(day?.actions)) {
      continue;
    }
    for (const action of day.actions) {
      if (typeof action !== "string" || !action.trim()) {
        continue;
      }
      counts[action] = (counts[action] ?? 0) + 1;
    }
  }
  return counts;
}

function summarizeLegacyYesterdayRevenue(summary: any): number {
  const lastDay = getLegacyDays(summary).at(-1);
  const after = normalizeNumber(lastDay?.balance_after);
  const before = normalizeNumber(lastDay?.balance_before);
  if (after !== undefined && before !== undefined) {
    return Math.max(after - before, 0);
  }
  return 0;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function extractShopSnapshot(world: StoredWorldState, shopId: number) {
  const shop = world.marketplace.shops.find((s) => s.shop_id === shopId);
  const listings = world.marketplace.listings.filter((l) => l.shop_id === shopId);
  const orders = world.marketplace.orders.filter((o) => o.shop_id === shopId);
  const reviews = world.marketplace.reviews.filter((r) => r.shop_id === shopId);
  const payments = world.marketplace.payments.filter((p) => p.shop_id === shopId);

  const activeCount = listings.filter((l) => l.state === "active").length;
  const draftCount = listings.filter((l) => l.state === "draft").length;

  const postedTotal = payments
    .filter((p) => p.status === "posted")
    .reduce((sum, p) => sum + p.amount, 0);

  const materialCosts = shop?.material_costs_paid_total ?? 0;
  const seedCapital = shop?.seed_capital ?? 0;
  const availableBalance = Number((postedTotal + seedCapital - materialCosts).toFixed(2));

  const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === "number");
  const reviewAverage = ratings.length > 0
    ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
    : 0;

  return {
    day: world.simulation.current_day.day,
    simulation_date: world.simulation.current_day.date,
    available_balance: availableBalance,
    currency_code: shop?.currency_code ?? "USD",
    active_listing_count: activeCount,
    draft_listing_count: draftCount,
    total_sales_count: orders.length,
    review_average: reviewAverage,
    review_count: reviews.length,
  };
}
