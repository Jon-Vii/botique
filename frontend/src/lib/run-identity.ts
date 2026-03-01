import type {
  RunIdentity,
  RunManifest,
  RunSummary,
  SimulationScenario,
} from "../types/api";
import { isScenarioId } from "./scenarios";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function hasRunIdentity(identity: RunIdentity | null | undefined): identity is RunIdentity {
  return Boolean(
    identity &&
      (identity.provider ||
        identity.model ||
        identity.turns_per_day !== undefined ||
        identity.temperature !== undefined ||
        identity.top_p !== undefined),
  );
}

export function getRunScenario({
  summary,
  manifest,
}: {
  summary?: Pick<RunSummary, "scenario"> | null;
  manifest?: RunManifest | null;
}): SimulationScenario | null {
  if (summary?.scenario) {
    return summary.scenario;
  }

  if (manifest?.summary?.scenario) {
    return manifest.summary.scenario;
  }

  const invocationScenario =
    readString(manifest?.invocation?.scenario_id) ??
    readString(manifest?.invocation?.scenario);

  if (!isScenarioId(invocationScenario)) {
    return null;
  }

  return {
    scenario_id: invocationScenario,
    controlled_shop_ids: [],
  };
}

export function getRunIdentity({
  summary,
  manifest,
}: {
  summary?: Pick<RunSummary, "identity"> | null;
  manifest?: RunManifest | null;
}): RunIdentity | null {
  if (hasRunIdentity(summary?.identity)) {
    return summary.identity;
  }

  if (hasRunIdentity(manifest?.summary?.identity)) {
    return manifest.summary.identity;
  }

  const invocation = manifest?.invocation;
  if (!invocation) {
    return null;
  }

  const model =
    readString(invocation.model) ?? readString(invocation.mistral_model);
  const provider =
    readString(invocation.provider) ?? (model ? "mistral" : null);
  const turnsPerDay =
    readNumber(invocation.turns_per_day) ?? readNumber(invocation.max_turns);
  const temperature = readNumber(invocation.temperature) ??
    readNumber(invocation.mistral_temperature);
  const topP = readNumber(invocation.top_p) ?? readNumber(invocation.mistral_top_p);

  const identity: RunIdentity = {};
  if (provider) {
    identity.provider = provider;
  }
  if (model) {
    identity.model = model;
  }
  if (turnsPerDay !== null) {
    identity.turns_per_day = turnsPerDay;
  }
  if (temperature !== null) {
    identity.temperature = temperature;
  }
  if (topP !== null) {
    identity.top_p = topP;
  }

  return hasRunIdentity(identity) ? identity : null;
}

export function buildRunIdentityTokens(identity?: RunIdentity | null) {
  if (!identity) {
    return [];
  }

  const tokens: string[] = [];

  if (identity.provider && identity.model) {
    tokens.push(`${identity.provider}/${identity.model}`);
  } else if (identity.model) {
    tokens.push(identity.model);
  } else if (identity.provider) {
    tokens.push(identity.provider);
  }

  if (identity.turns_per_day !== undefined) {
    tokens.push(`${identity.turns_per_day} turns/day`);
  }
  if (identity.temperature !== undefined) {
    tokens.push(`temp ${identity.temperature}`);
  }
  if (identity.top_p !== undefined) {
    tokens.push(`top-p ${identity.top_p}`);
  }

  return tokens;
}
