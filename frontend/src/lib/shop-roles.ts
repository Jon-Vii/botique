import type { BadgeVariant } from "../components/Badge";
import type { SimulationScenario } from "../types/api";

export type ShopRole = "agent" | "npc";

const SHOP_ROLE_META: Record<
  ShopRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    variant: BadgeVariant;
  }
> = {
  agent: {
    label: "Agent shop",
    shortLabel: "Agent",
    description: "Scenario-controlled shop actively run by a live model.",
    variant: "orange",
  },
  npc: {
    label: "NPC shop",
    shortLabel: "NPC",
    description: "Background market shop outside the current controlled scenario.",
    variant: "gray",
  },
};

export function isAgentShop(
  shopId: number,
  scenario?: SimulationScenario | null,
) {
  return scenario?.controlled_shop_ids.includes(shopId) ?? false;
}

export function getShopRole(
  shopId: number,
  scenario?: SimulationScenario | null,
): ShopRole {
  return isAgentShop(shopId, scenario) ? "agent" : "npc";
}

export function getShopRoleMeta(
  roleOrShopId: ShopRole | number,
  scenario?: SimulationScenario | null,
) {
  return SHOP_ROLE_META[
    typeof roleOrShopId === "number"
      ? getShopRole(roleOrShopId, scenario)
      : roleOrShopId
  ];
}

export function countShopsByRole(
  shopIds: readonly number[],
  role: ShopRole,
  scenario?: SimulationScenario | null,
) {
  return shopIds.filter((shopId) => getShopRole(shopId, scenario) === role)
    .length;
}
