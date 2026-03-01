import type {
  Listing,
  ListingInventory,
  Order,
  Payment,
  ProductionQueueItem,
  Review,
  StoredShop,
  TaxonomyNode
} from "./schemas/domain";
import type { StoredMarketplaceState } from "./simulation/state-types";

function buildInventory(
  listingId: number,
  sku: string,
  price: number,
  quantity: number
): ListingInventory {
  return {
    listing_id: listingId,
    products: [
      {
        sku,
        property_values: [],
        offerings: [
          {
            offering_id: listingId * 10,
            price,
            quantity,
            is_enabled: true
          }
        ]
      }
    ],
    price_on_property: [],
    quantity_on_property: [],
    sku_on_property: []
  };
}

function buildQueueItem(input: {
  jobId: string;
  listingId: number;
  orderId: number | null;
  kind: ProductionQueueItem["kind"];
  status: ProductionQueueItem["status"];
  createdAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  capacityUnitsRequired: number;
  capacityUnitsRemaining: number;
  materialCost: number;
}): ProductionQueueItem {
  return {
    job_id: input.jobId,
    listing_id: input.listingId,
    order_id: input.orderId,
    kind: input.kind,
    status: input.status,
    created_at: input.createdAt,
    started_at: input.startedAt ?? null,
    ready_at: input.readyAt ?? null,
    capacity_units_required: input.capacityUnitsRequired,
    capacity_units_remaining: input.capacityUnitsRemaining,
    material_cost: input.materialCost
  };
}

// ─── All shops compete in a single taxonomy: 3D Printed Goods ───────
// One agent-controlled shop (1001) + three NPC shops, all in taxonomy 9101.
// Fixed daily traffic is split by share-of-voice, so agents must outcompete
// NPCs on listing quality, pricing, trend-fit, and catalog breadth.

export function createDefaultMarketplaceState(): StoredMarketplaceState {
  const TAXONOMY = 9101;
  const DATE_BASE = "2026-02-27T00:00:00.000Z";

  const shops: StoredShop[] = [
    // ── Agent-controlled shop ──
    {
      shop_id: 1001,
      shop_name: "layercake-labs",
      title: "Layer Cake Labs",
      announcement: "Small-batch 3D printed planters, organizers, and accessories for everyday life.",
      sale_message: "Restocked seed trays — two custom marker slots now open.",
      currency_code: "USD",
      digital_product_policy:
        "Stocked items ship in 1-2 business days; custom prints run in the next two-night print queue.",
      production_capacity_per_day: 10,
      backlog_units: 0,
      material_costs_paid_total: 38.5,
      seed_capital: 0,
      production_queue: [
        buildQueueItem({
          jobId: "pq_layercake_01",
          listingId: 2001,
          orderId: null,
          kind: "stock",
          status: "in_progress",
          createdAt: "2026-02-27T05:30:00.000Z",
          startedAt: "2026-02-27T06:15:00.000Z",
          capacityUnitsRequired: 4,
          capacityUnitsRemaining: 2,
          materialCost: 12.4
        })
      ],
      created_at: "2026-02-16T09:00:00.000Z",
      updated_at: "2026-02-27T08:30:00.000Z"
    },
    // ── NPC shop: functional desk/office prints ──
    {
      shop_id: 1002,
      shop_name: "printform-studio",
      title: "Printform Studio",
      announcement: "Functional 3D printed desk accessories and cable management solutions.",
      sale_message: "Headphone stands back in stock — monitor risers printing now.",
      currency_code: "USD",
      digital_product_policy:
        "Stocked items ship in 1-2 days; custom color runs take 3-4 days.",
      production_capacity_per_day: 8,
      backlog_units: 0,
      material_costs_paid_total: 62,
      seed_capital: 0,
      production_queue: [
        buildQueueItem({
          jobId: "pq_printform_01",
          listingId: 2003,
          orderId: null,
          kind: "stock",
          status: "in_progress",
          createdAt: "2026-02-27T06:00:00.000Z",
          startedAt: "2026-02-27T06:30:00.000Z",
          capacityUnitsRequired: 3,
          capacityUnitsRemaining: 1,
          materialCost: 8.5
        })
      ],
      created_at: "2026-02-10T08:00:00.000Z",
      updated_at: "2026-02-27T07:15:00.000Z"
    },
    // ── NPC shop: decorative/art prints ──
    {
      shop_id: 1003,
      shop_name: "filament-and-form",
      title: "Filament & Form",
      announcement: "Geometric vases, wall art, and decorative sculptures — all 3D printed in premium filaments.",
      sale_message: "New twisted vase colorway just dropped.",
      currency_code: "USD",
      digital_product_policy:
        "Most pieces ship in 2-3 days; large sculptures may need a 5-day print window.",
      production_capacity_per_day: 6,
      backlog_units: 0,
      material_costs_paid_total: 94,
      seed_capital: 0,
      production_queue: [
        buildQueueItem({
          jobId: "pq_filform_01",
          listingId: 2005,
          orderId: null,
          kind: "stock",
          status: "waiting_ready",
          createdAt: "2026-02-26T09:00:00.000Z",
          startedAt: "2026-02-26T10:00:00.000Z",
          readyAt: "2026-02-28T15:00:00.000Z",
          capacityUnitsRequired: 5,
          capacityUnitsRemaining: 0,
          materialCost: 14
        })
      ],
      created_at: "2026-02-12T10:00:00.000Z",
      updated_at: "2026-02-27T09:10:00.000Z"
    },
    // ── NPC shop: kitchen/home utility prints ──
    {
      shop_id: 1004,
      shop_name: "nozzle-works",
      title: "Nozzle Works",
      announcement: "Practical 3D printed kitchen gadgets, container lids, and household fixes.",
      sale_message: "Spice rack modules restocked. Custom lid sizes available.",
      currency_code: "USD",
      digital_product_policy:
        "Standard items ship in 1-2 days; custom-fit pieces need measurements and a 3-day queue.",
      production_capacity_per_day: 8,
      backlog_units: 1,
      material_costs_paid_total: 71,
      seed_capital: 0,
      production_queue: [
        buildQueueItem({
          jobId: "pq_nozzle_01",
          listingId: 2007,
          orderId: 5006,
          kind: "customer_order",
          status: "in_progress",
          createdAt: "2026-02-27T09:20:00.000Z",
          startedAt: "2026-02-27T09:45:00.000Z",
          capacityUnitsRequired: 3,
          capacityUnitsRemaining: 1,
          materialCost: 5.5
        })
      ],
      created_at: "2026-02-08T11:00:00.000Z",
      updated_at: "2026-02-27T06:50:00.000Z"
    }
  ];

  const listings: Listing[] = [
    // ── Shop 1001: Layer Cake Labs (agent) ──
    {
      listing_id: 2001,
      shop_id: 1001,
      shop_name: "layercake-labs",
      title: "Stackable Seed Starter Tray Set",
      description: "Set of two 3D printed nursery trays with drainage channels sized for apartment windowsills.",
      state: "active",
      type: "physical",
      quantity: 6,
      fulfillment_mode: "stocked",
      quantity_on_hand: 6,
      backlog_units: 0,
      price: 28,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["seed starter", "planter", "3d printed", "stackable"],
      materials: ["pla", "rubber feet"],
      material_cost_per_unit: 6.2,
      capacity_units_per_item: 2,
      lead_time_days: 2,
      image_ids: [3101, 3102],
      views: 164,
      favorites: 42,
      url: "https://botique.example/listings/2001",
      created_at: "2026-02-19T09:00:00.000Z",
      updated_at: "2026-02-27T08:45:00.000Z",
      inventory: buildInventory(2001, "LCL-START-001", 28, 6)
    },
    {
      listing_id: 2002,
      shop_id: 1001,
      shop_name: "layercake-labs",
      title: "Custom Herb Marker Stakes",
      description: "Personalized set of twelve garden markers printed to order for kitchen herbs and balcony planters.",
      state: "draft",
      type: "physical",
      quantity: 999,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 32,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: TAXONOMY,
      tags: ["custom", "garden marker", "herb label", "3d printed"],
      materials: ["pla", "outdoor vinyl"],
      material_cost_per_unit: 4.5,
      capacity_units_per_item: 1,
      lead_time_days: 2,
      image_ids: [],
      views: 33,
      favorites: 8,
      url: "https://botique.example/listings/2002",
      created_at: "2026-02-25T11:00:00.000Z",
      updated_at: "2026-02-27T08:50:00.000Z",
      inventory: buildInventory(2002, "LCL-MARK-002", 32, 999)
    },
    // ── Shop 1002: Printform Studio (NPC — desk/office) ──
    {
      listing_id: 2003,
      shop_id: 1002,
      shop_name: "printform-studio",
      title: "Minimal Headphone Stand",
      description: "Clean-line 3D printed headphone stand in matte PLA. Weighted base keeps it stable on any desk.",
      state: "active",
      type: "physical",
      quantity: 5,
      fulfillment_mode: "stocked",
      quantity_on_hand: 5,
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
      image_ids: [3201],
      views: 198,
      favorites: 51,
      url: "https://botique.example/listings/2003",
      created_at: "2026-02-14T10:00:00.000Z",
      updated_at: "2026-02-27T07:30:00.000Z",
      inventory: buildInventory(2003, "PFS-HEAD-001", 24, 5)
    },
    {
      listing_id: 2004,
      shop_id: 1002,
      shop_name: "printform-studio",
      title: "Under-Desk Cable Clip Strip",
      description: "Adhesive-backed cable management strip with six snap-fit channels. Printed in flexible TPU.",
      state: "active",
      type: "physical",
      quantity: 12,
      fulfillment_mode: "stocked",
      quantity_on_hand: 12,
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
      image_ids: [3202],
      views: 312,
      favorites: 89,
      url: "https://botique.example/listings/2004",
      created_at: "2026-02-18T13:00:00.000Z",
      updated_at: "2026-02-27T07:40:00.000Z",
      inventory: buildInventory(2004, "PFS-CABLE-002", 14, 12)
    },
    // ── Shop 1003: Filament & Form (NPC — decorative/art) ──
    {
      listing_id: 2005,
      shop_id: 1003,
      shop_name: "filament-and-form",
      title: "Twisted Geometric Vase",
      description: "Spiral-twist vase printed in silk PLA with a smooth gradient finish. Watertight with internal liner.",
      state: "active",
      type: "physical",
      quantity: 3,
      fulfillment_mode: "stocked",
      quantity_on_hand: 3,
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
      image_ids: [3301],
      views: 245,
      favorites: 72,
      url: "https://botique.example/listings/2005",
      created_at: "2026-02-13T08:30:00.000Z",
      updated_at: "2026-02-27T09:25:00.000Z",
      inventory: buildInventory(2005, "FF-VASE-001", 38, 3)
    },
    {
      listing_id: 2006,
      shop_id: 1003,
      shop_name: "filament-and-form",
      title: "Honeycomb Wall Panel Set",
      description: "Set of six interlocking hexagonal wall panels. Mount with included adhesive strips or screws.",
      state: "active",
      type: "physical",
      quantity: 4,
      fulfillment_mode: "stocked",
      quantity_on_hand: 4,
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
      image_ids: [3302],
      views: 178,
      favorites: 43,
      url: "https://botique.example/listings/2006",
      created_at: "2026-02-20T12:00:00.000Z",
      updated_at: "2026-02-27T09:30:00.000Z",
      inventory: buildInventory(2006, "FF-HEX-002", 46, 4)
    },
    // ── Shop 1004: Nozzle Works (NPC — kitchen/home utility) ──
    {
      listing_id: 2007,
      shop_id: 1004,
      shop_name: "nozzle-works",
      title: "Modular Spice Rack Drawer Insert",
      description: "Customizable 3D printed drawer insert with angled spice jar slots. Fits standard 15-inch drawers.",
      state: "active",
      type: "physical",
      quantity: 4,
      fulfillment_mode: "stocked",
      quantity_on_hand: 4,
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
      image_ids: [3401],
      views: 156,
      favorites: 38,
      url: "https://botique.example/listings/2007",
      created_at: "2026-02-15T13:00:00.000Z",
      updated_at: "2026-02-27T06:55:00.000Z",
      inventory: buildInventory(2007, "NW-SPICE-001", 22, 4)
    },
    {
      listing_id: 2008,
      shop_id: 1004,
      shop_name: "nozzle-works",
      title: "Custom-Fit Container Lid",
      description: "Made-to-order replacement lid for any round container. Send your diameter and we print to fit.",
      state: "active",
      type: "physical",
      quantity: 999,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      backlog_units: 1,
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
      image_ids: [],
      views: 89,
      favorites: 14,
      url: "https://botique.example/listings/2008",
      created_at: "2026-02-22T09:00:00.000Z",
      updated_at: "2026-02-27T07:00:00.000Z",
      inventory: buildInventory(2008, "NW-LID-002", 16, 999)
    }
  ];

  const orders: Order[] = [
    {
      receipt_id: 5001,
      shop_id: 1001,
      buyer_name: "Ava Chen",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 28,
      currency_code: "USD",
      line_items: [
        { listing_id: 2001, title: "Stackable Seed Starter Tray Set", quantity: 1, price: 28 }
      ],
      created_at: "2026-02-26T14:10:00.000Z",
      updated_at: "2026-02-26T18:40:00.000Z"
    },
    {
      receipt_id: 5002,
      shop_id: 1002,
      buyer_name: "Leo Ramirez",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 24,
      currency_code: "USD",
      line_items: [
        { listing_id: 2003, title: "Minimal Headphone Stand", quantity: 1, price: 24 }
      ],
      created_at: "2026-02-25T12:04:00.000Z",
      updated_at: "2026-02-26T10:30:00.000Z"
    },
    {
      receipt_id: 5003,
      shop_id: 1002,
      buyer_name: "Morgan Lee",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 14,
      currency_code: "USD",
      line_items: [
        { listing_id: 2004, title: "Under-Desk Cable Clip Strip", quantity: 1, price: 14 }
      ],
      created_at: "2026-02-23T15:20:00.000Z",
      updated_at: "2026-02-24T11:35:00.000Z"
    },
    {
      receipt_id: 5004,
      shop_id: 1003,
      buyer_name: "Mina Patel",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 38,
      currency_code: "USD",
      line_items: [
        { listing_id: 2005, title: "Twisted Geometric Vase", quantity: 1, price: 38 }
      ],
      created_at: "2026-02-25T16:30:00.000Z",
      updated_at: "2026-02-26T13:20:00.000Z"
    },
    {
      receipt_id: 5005,
      shop_id: 1003,
      buyer_name: "Noah Kim",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 46,
      currency_code: "USD",
      line_items: [
        { listing_id: 2006, title: "Honeycomb Wall Panel Set", quantity: 1, price: 46 }
      ],
      created_at: "2026-02-24T11:20:00.000Z",
      updated_at: "2026-02-25T18:15:00.000Z"
    },
    {
      receipt_id: 5006,
      shop_id: 1004,
      buyer_name: "Tessa Nguyen",
      status: "paid",
      was_paid: true,
      was_shipped: false,
      was_delivered: false,
      total_price: 16,
      currency_code: "USD",
      line_items: [
        { listing_id: 2008, title: "Custom-Fit Container Lid", quantity: 1, price: 16 }
      ],
      created_at: "2026-02-27T09:15:00.000Z",
      updated_at: "2026-02-27T09:15:00.000Z"
    },
    {
      receipt_id: 5007,
      shop_id: 1004,
      buyer_name: "Jordan Bell",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 22,
      currency_code: "USD",
      line_items: [
        { listing_id: 2007, title: "Modular Spice Rack Drawer Insert", quantity: 1, price: 22 }
      ],
      created_at: "2026-02-22T10:10:00.000Z",
      updated_at: "2026-02-24T14:00:00.000Z"
    }
  ];

  const reviews: Review[] = [
    {
      review_id: 7001,
      shop_id: 1001,
      listing_id: 2001,
      rating: 5,
      review: "Crisp print quality and the trays actually help keep my starts organized.",
      buyer_name: "Ava Chen",
      created_at: "2026-02-27T09:10:00.000Z"
    },
    {
      review_id: 7002,
      shop_id: 1002,
      listing_id: 2003,
      rating: 4,
      review: "Clean design and solid build. Slight layer lines but looks good on the desk.",
      buyer_name: "Leo Ramirez",
      created_at: "2026-02-26T10:25:00.000Z"
    },
    {
      review_id: 7003,
      shop_id: 1002,
      listing_id: 2004,
      rating: 5,
      review: "Finally solved my cable mess. The TPU flex is perfect for routing.",
      buyer_name: "Morgan Lee",
      created_at: "2026-02-25T10:00:00.000Z"
    },
    {
      review_id: 7004,
      shop_id: 1003,
      listing_id: 2005,
      rating: 5,
      review: "The silk PLA finish catches light beautifully. Exactly what I wanted.",
      buyer_name: "Mina Patel",
      created_at: "2026-02-26T17:00:00.000Z"
    },
    {
      review_id: 7005,
      shop_id: 1003,
      listing_id: 2006,
      rating: 4,
      review: "Panels look great on the wall. One was slightly warped but still mounted fine.",
      buyer_name: "Noah Kim",
      created_at: "2026-02-26T11:40:00.000Z"
    },
    {
      review_id: 7006,
      shop_id: 1004,
      listing_id: 2007,
      rating: 4,
      review: "Fits my drawer perfectly. The angled slots are a nice touch.",
      buyer_name: "Jordan Bell",
      created_at: "2026-02-25T14:00:00.000Z"
    }
  ];

  const payments: Payment[] = [
    {
      payment_id: 8001,
      shop_id: 1001,
      receipt_id: 5001,
      amount: 28,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-26T14:13:00.000Z",
      posted_at: "2026-02-26T14:13:00.000Z"
    },
    {
      payment_id: 8002,
      shop_id: 1002,
      receipt_id: 5002,
      amount: 24,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-26T10:31:00.000Z",
      posted_at: "2026-02-26T10:31:00.000Z"
    },
    {
      payment_id: 8003,
      shop_id: 1002,
      receipt_id: 5003,
      amount: 14,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-24T11:36:00.000Z",
      posted_at: "2026-02-24T11:36:00.000Z"
    },
    {
      payment_id: 8004,
      shop_id: 1003,
      receipt_id: 5004,
      amount: 38,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-26T13:21:00.000Z",
      posted_at: "2026-02-26T13:21:00.000Z"
    },
    {
      payment_id: 8005,
      shop_id: 1003,
      receipt_id: 5005,
      amount: 46,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-25T18:16:00.000Z",
      posted_at: "2026-02-25T18:16:00.000Z"
    },
    {
      payment_id: 8006,
      shop_id: 1004,
      receipt_id: 5006,
      amount: 16,
      currency_code: "USD",
      status: "pending",
      available_at: "2026-03-02T09:15:30.000Z",
      posted_at: "2026-02-27T09:15:30.000Z"
    },
    {
      payment_id: 8007,
      shop_id: 1004,
      receipt_id: 5007,
      amount: 22,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-24T14:01:00.000Z",
      posted_at: "2026-02-24T14:01:00.000Z"
    }
  ];

  const taxonomyNodes: TaxonomyNode[] = [
    {
      taxonomy_id: 9000,
      parent_taxonomy_id: null,
      name: "Creative Goods",
      full_path: "Creative Goods",
      level: 0
    },
    {
      taxonomy_id: 9101,
      parent_taxonomy_id: 9000,
      name: "3D Printed Goods",
      full_path: "Creative Goods > 3D Printed Goods",
      level: 1
    }
  ];

  return { shops, listings, orders, reviews, payments, taxonomyNodes };
}
