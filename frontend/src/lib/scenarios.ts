import type { BadgeVariant } from "../components/Badge";
import type { ScenarioId, SimulationScenario } from "../types/api";

export const DEFAULT_SCENARIO_ID: ScenarioId = "operate";

export const SCENARIO_OPTIONS: Array<{
  id: ScenarioId;
  label: string;
  cue: string;
  description: string;
  variant: BadgeVariant;
}> = [
  {
    id: "operate",
    label: "Operate",
    cue: "Live catalog pressure",
    description:
      "Starts from an operating shop with an active catalog, history, and real ongoing demand.",
    variant: "emerald",
  },
  {
    id: "bootstrap",
    label: "Bootstrap",
    cue: "Cold-start buildout",
    description:
      "Starts from a real shop shell with no active catalog, forcing a fresh launch under limited runway.",
    variant: "violet",
  },
];

export function isScenarioId(value: unknown): value is ScenarioId {
  return value === "operate" || value === "bootstrap";
}

export function getScenarioMeta(scenario?: SimulationScenario | ScenarioId | null) {
  const scenarioId =
    typeof scenario === "string" ? scenario : scenario?.scenario_id ?? DEFAULT_SCENARIO_ID;

  return (
    SCENARIO_OPTIONS.find((option) => option.id === scenarioId) ??
    SCENARIO_OPTIONS[0]
  );
}

export function getScenarioLabel(scenario?: SimulationScenario | ScenarioId | null) {
  return getScenarioMeta(scenario).label;
}

export function formatControlledShopIds(
  shopIds?: readonly number[] | null,
) {
  if (!shopIds || shopIds.length === 0) {
    return "none";
  }

  return shopIds.map((shopId) => `#${shopId}`).join(", ");
}
