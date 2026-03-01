import { FlagBanner, Storefront } from "@phosphor-icons/react";
import { Badge } from "./Badge";
import { formatControlledShopIds, getScenarioMeta } from "../lib/scenarios";
import type { ScenarioId, SimulationScenario } from "../types/api";

export function ScenarioBadge({
  scenario,
  subtle = false,
  className = "",
}: {
  scenario?: SimulationScenario | ScenarioId | null;
  subtle?: boolean;
  className?: string;
}) {
  const meta = getScenarioMeta(scenario);

  return (
    <Badge
      variant={meta.variant}
      subtle={subtle}
      icon={<FlagBanner size={10} weight="fill" />}
      className={className}
    >
      {meta.label}
    </Badge>
  );
}

export function ControlledShopsBadge({
  shopIds,
  subtle = true,
  className = "",
}: {
  shopIds?: readonly number[] | null;
  subtle?: boolean;
  className?: string;
}) {
  if (!shopIds || shopIds.length === 0) {
    return null;
  }

  return (
    <Badge
      variant="gray"
      subtle={subtle}
      icon={<Storefront size={10} weight="duotone" />}
      className={className}
    >
      {formatControlledShopIds(shopIds)}
    </Badge>
  );
}
