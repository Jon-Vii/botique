import { Robot, Storefront } from "@phosphor-icons/react";
import { Badge } from "./Badge";
import { getShopRole, getShopRoleMeta, type ShopRole } from "../lib/shop-roles";
import type { SimulationScenario } from "../types/api";

export function ShopRoleBadge({
  shopId,
  role,
  scenario,
  subtle = true,
  compact = false,
  className = "",
}: {
  shopId?: number;
  role?: ShopRole;
  scenario?: SimulationScenario | null;
  subtle?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const resolvedRole =
    role ?? (shopId !== undefined ? getShopRole(shopId, scenario) : "npc");
  const meta = getShopRoleMeta(resolvedRole);
  const icon =
    resolvedRole === "agent" ? (
      <Robot size={10} weight="duotone" />
    ) : (
      <Storefront size={10} weight="duotone" />
    );

  return (
    <Badge
      variant={meta.variant}
      subtle={subtle}
      icon={icon}
      className={className}
    >
      {compact ? meta.shortLabel : meta.label}
    </Badge>
  );
}
