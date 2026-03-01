import type { Listing } from "../schemas/domain";

// Product templates for NPC shops. Each NPC has 2 products matching their
// original catalog from default-marketplace-state.ts. These are used to
// gradually populate NPC shops during bootstrap scenarios. IDs are omitted
// and assigned at creation time.

const TAXONOMY = 9101;

export type NpcProductTemplate = Omit<
  Listing,
  "listing_id" | "shop_id" | "shop_name" | "views" | "favorites" | "url" | "created_at" | "updated_at" | "inventory" | "ranking_score"
>;

export const NPC_PRODUCT_POOL: Record<number, NpcProductTemplate[]> = {
  // Printform Studio — desk/office
  1002: [
    {
      title: "Minimal Headphone Stand",
      description: "Clean-line 3D printed headphone stand in matte PLA. Weighted base keeps it stable on any desk.",
      state: "active",
      type: "physical",
      quantity: 5,
      fulfillment_mode: "stocked",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 24,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["headphone stand", "desk accessory", "3d printed", "minimal"],
      materials: ["pla", "silicone pad"],
      material_cost_per_unit: 5.5,
      capacity_units_per_item: 3,
      lead_time_days: 2,
      image_ids: [3201]
    },
    {
      title: "Under-Desk Cable Clip Strip",
      description: "Adhesive-backed cable management strip with six snap-fit channels. Printed in flexible TPU.",
      state: "active",
      type: "physical",
      quantity: 12,
      fulfillment_mode: "stocked",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 14,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["cable management", "desk organizer", "3d printed", "tpu"],
      materials: ["tpu", "3m adhesive strips"],
      material_cost_per_unit: 3.2,
      capacity_units_per_item: 1,
      lead_time_days: 1,
      image_ids: [3202]
    }
  ],
  // Filament & Form — decorative/art
  1003: [
    {
      title: "Twisted Geometric Vase",
      description: "Spiral-twist vase printed in silk PLA with a smooth gradient finish. Watertight with internal liner.",
      state: "active",
      type: "physical",
      quantity: 3,
      fulfillment_mode: "stocked",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 38,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["vase", "geometric", "3d printed", "silk pla", "home decor"],
      materials: ["silk pla", "petg liner"],
      material_cost_per_unit: 9.5,
      capacity_units_per_item: 5,
      lead_time_days: 3,
      image_ids: [3301]
    },
    {
      title: "Honeycomb Wall Panel Set",
      description: "Set of six interlocking hexagonal wall panels. Mount with included adhesive strips or screws.",
      state: "active",
      type: "physical",
      quantity: 4,
      fulfillment_mode: "stocked",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 46,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["wall art", "honeycomb", "3d printed", "geometric", "modular"],
      materials: ["pla", "mounting hardware"],
      material_cost_per_unit: 11,
      capacity_units_per_item: 4,
      lead_time_days: 3,
      image_ids: [3302]
    }
  ],
  // Nozzle Works — kitchen/home utility
  1004: [
    {
      title: "Modular Spice Rack Drawer Insert",
      description: "Customizable 3D printed drawer insert with angled spice jar slots. Fits standard 15-inch drawers.",
      state: "active",
      type: "physical",
      quantity: 4,
      fulfillment_mode: "stocked",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 22,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["spice rack", "kitchen organizer", "3d printed", "drawer insert"],
      materials: ["petg", "silicone feet"],
      material_cost_per_unit: 5.5,
      capacity_units_per_item: 3,
      lead_time_days: 2,
      image_ids: [3401]
    },
    {
      title: "Custom-Fit Container Lid",
      description: "Made-to-order replacement lid for any round container. Send your diameter and we print to fit.",
      state: "active",
      type: "physical",
      quantity: 999,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 16,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["custom lid", "replacement", "3d printed", "kitchen", "made to order"],
      materials: ["petg"],
      material_cost_per_unit: 2.8,
      capacity_units_per_item: 2,
      lead_time_days: 3,
      image_ids: []
    }
  ]
};
