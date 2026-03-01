import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import { BadRequestError, NotFoundError } from "../errors";
import {
  dayBriefingSchema,
  daySnapshotListSchema,
  memoryNoteListSchema,
  memoryReminderListSchema,
  runLaunchRequestSchema,
  runLaunchResponseSchema,
  runListEntrySchema,
  runManifestSchema,
  runSummarySchema,
  turnRecordListSchema,
} from "../schemas/control";

const execFileAsync = promisify(execFile);

type RunLaunchRequest = z.infer<typeof runLaunchRequestSchema>;
type RunLaunchResponse = z.infer<typeof runLaunchResponseSchema>;
type RunListEntry = z.infer<typeof runListEntrySchema>;
type RunSummary = z.infer<typeof runSummarySchema>;
type RunManifest = z.infer<typeof runManifestSchema>;
type DaySnapshot = z.infer<typeof daySnapshotListSchema>[number];
type DayBriefing = z.infer<typeof dayBriefingSchema>;
type TurnRecord = z.infer<typeof turnRecordListSchema>[number];
type MemoryNote = z.infer<typeof memoryNoteListSchema>[number];
type MemoryReminder = z.infer<typeof memoryReminderListSchema>[number];

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

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifact = await this.readRunArtifact(join(this.artifactsRoot, entry.name));
      if (artifact === null) {
        continue;
      }

      runs.push(
        runListEntrySchema.parse({
          run_id: artifact.summary.run_id,
          shop_id: artifact.summary.shop_id,
          mode: artifact.summary.mode,
          day_count: artifact.summary.day_count,
          has_summary: true,
          has_manifest: artifact.manifest !== null,
          created_at: artifact.createdAt,
        }),
      );
    }

    return runs.sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""));
  }

  async getRunSummary(runId: string): Promise<RunSummary> {
    const artifact = await this.getRunArtifact(runId);
    const payload = normalizeRunSummaryPayload(artifact.summary);
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
    ];

    if (payload.scenario) {
      args.push("--scenario", payload.scenario);
    }

    try {
      const { stdout, stderr } = await execFileAsync(this.runtimeCliPath, args, {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      const raw = stdout.trim();
      if (!raw) {
        throw new BadRequestError(`Run runtime produced no output.${stderr ? ` ${stderr}` : ""}`);
      }
      const response = JSON.parse(raw) as { ok?: boolean; error?: { message?: string } };
      if (!response.ok) {
        throw new BadRequestError(response.error?.message ?? "Run launch failed.");
      }

      await access(join(outputDir, "summary.json"));
      return runLaunchResponseSchema.parse({ run_id: runId });
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Run launch failed.";
      throw new BadRequestError(message);
    }
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
    if (manifest && manifest?.invocation?.command === "run-tournament") {
      return null;
    }

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

function normalizeRunSummaryPayload(summary: any) {
  return {
    run_id: summary.run_id,
    shop_id: summary.shop_id,
    mode: summary.mode,
    day_count: summary.day_count,
    start_day: summary.start_day,
    end_day: summary.end_day,
    start_simulation_date: summary.start_simulation_date,
    end_simulation_date: summary.end_simulation_date,
    starting_state: summary.starting_state,
    ending_state: summary.ending_state,
    totals: {
      tool_call_count: summary?.totals?.tool_call_count ?? 0,
      tool_calls_by_name: summary?.totals?.tool_calls_by_name ?? {},
      tool_calls_by_surface: summary?.totals?.tool_calls_by_surface ?? {},
      turn_count: summary?.totals?.turn_count ?? 0,
      yesterday_revenue: summary?.totals?.yesterday_revenue ?? 0,
      notes_written: summary?.totals?.workspace_entries_added ?? 0,
      reminders_set: summary?.totals?.reminders_set ?? 0,
      reminders_completed: summary?.totals?.reminders_completed ?? 0,
      simulation_advances: summary?.totals?.simulation_advances ?? 0,
    },
    memory: {
      note_count: summary?.memory?.workspace_entry_count ?? 0,
      reminder_count: summary?.memory?.reminder_count ?? 0,
      pending_reminder_count: summary?.memory?.pending_reminder_count ?? 0,
    },
  };
}

function normalizeRunManifestPayload(manifest: any, summary: any) {
  return {
    artifact_version: manifest?.artifact_version ?? 1,
    run_id: manifest?.run_id ?? summary?.run_id,
    shop_id: manifest?.shop_id ?? summary?.shop_id,
    mode: manifest?.mode ?? summary?.mode ?? "live",
    day_count: manifest?.day_count ?? summary?.day_count ?? 0,
    invocation: {
      command: manifest?.invocation?.command ?? "run-days",
      days: manifest?.invocation?.days ?? summary?.day_count ?? 0,
      max_turns: manifest?.invocation?.max_turns ?? null,
      shop_id: manifest?.invocation?.shop_id ?? String(summary?.shop_id ?? ""),
      run_id: manifest?.invocation?.run_id ?? summary?.run_id ?? "",
    },
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
