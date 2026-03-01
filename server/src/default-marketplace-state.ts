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

export function createDefaultMarketplaceState(): StoredMarketplaceState {
  const shops: StoredShop[] = [
    {
      shop_id: 1001,
      shop_name: "layercake-labs",
      title: "Layer Cake Labs",
      announcement: "Small-batch 3D printed planters and propagation tools for apartment growers.",
      sale_message: "Restocked moss green trays and opened two custom marker slots.",
      currency_code: "USD",
      digital_product_policy:
        "Stocked trays ship in 1-2 business days; custom prints run in the next two-night print queue.",
      production_capacity_per_day: 10,
      backlog_units: 0,
      material_costs_paid_total: 38.5,
      production_queue: [
        buildQueueItem({
          jobId: "pq_layercake_01",
          listingId: 2001,
          orderId: null,
          kind: "stock",
          status: "in_progress",
          createdAt: "2026-02-27T05:30:00.000Z",
          startedAt: "2026-02-27T06:15:00.000Z",
          readyAt: null,
          capacityUnitsRequired: 4,
          capacityUnitsRemaining: 2,
          materialCost: 12.4
        })
      ],
      created_at: "2026-02-16T09:00:00.000Z",
      updated_at: "2026-02-27T08:30:00.000Z"
    },
    {
      shop_id: 1002,
      shop_name: "sunline-cutworks",
      title: "Sunline Cutworks",
      announcement: "Laser-cut acrylic and plywood decor with layered color and family-name customization.",
      sale_message: "Family signs are booking into next week's cut window.",
      currency_code: "USD",
      digital_product_policy:
        "Ready ornaments ship in 1-2 days; personalized signs go through proofing plus a 4-day cut-and-finish queue.",
      production_capacity_per_day: 6,
      backlog_units: 1,
      material_costs_paid_total: 114,
      production_queue: [
        buildQueueItem({
          jobId: "pq_sunline_01",
          listingId: 2003,
          orderId: 5002,
          kind: "customer_order",
          status: "in_progress",
          createdAt: "2026-02-27T12:20:00.000Z",
          startedAt: "2026-02-27T13:10:00.000Z",
          readyAt: null,
          capacityUnitsRequired: 3,
          capacityUnitsRemaining: 2,
          materialCost: 18
        })
      ],
      created_at: "2026-02-12T08:00:00.000Z",
      updated_at: "2026-02-27T07:15:00.000Z"
    },
    {
      shop_id: 1003,
      shop_name: "kiln-bloom-ceramics",
      title: "Kiln Bloom Ceramics",
      announcement: "Wheel-thrown kitchen ceramics glazed in quiet earth tones.",
      sale_message: "Only one speckled espresso pair left before the next firing.",
      currency_code: "USD",
      digital_product_policy:
        "Finished small batches ship in 2-3 days; made-to-order pieces wait for the next bisque and glaze cycle.",
      production_capacity_per_day: 5,
      backlog_units: 0,
      material_costs_paid_total: 126,
      production_queue: [
        buildQueueItem({
          jobId: "pq_kiln_01",
          listingId: 2005,
          orderId: null,
          kind: "stock",
          status: "waiting_ready",
          createdAt: "2026-02-26T09:00:00.000Z",
          startedAt: "2026-02-26T10:00:00.000Z",
          readyAt: "2026-02-28T15:00:00.000Z",
          capacityUnitsRequired: 4,
          capacityUnitsRemaining: 0,
          materialCost: 27
        })
      ],
      created_at: "2026-02-10T10:00:00.000Z",
      updated_at: "2026-02-27T09:10:00.000Z"
    },
    {
      shop_id: 1004,
      shop_name: "oak-and-orbit",
      title: "Oak & Orbit",
      announcement: "Solid-wood desk and entryway goods with hand-rubbed oil finishes.",
      sale_message: "Bench time is tight this week, but custom entry rails are still open.",
      currency_code: "USD",
      digital_product_policy:
        "Finished desk pieces ship in 2 days; custom joinery runs on a limited weekly bench schedule.",
      production_capacity_per_day: 4,
      backlog_units: 1,
      material_costs_paid_total: 82,
      production_queue: [
        buildQueueItem({
          jobId: "pq_oak_01",
          listingId: 2007,
          orderId: 5006,
          kind: "customer_order",
          status: "queued",
          createdAt: "2026-02-27T09:20:00.000Z",
          capacityUnitsRequired: 4,
          capacityUnitsRemaining: 4,
          materialCost: 21
        })
      ],
      created_at: "2026-02-08T11:00:00.000Z",
      updated_at: "2026-02-27T06:50:00.000Z"
    }
  ];

  const listings: Listing[] = [
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
      taxonomy_id: 9101,
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
      taxonomy_id: 9101,
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
    {
      listing_id: 2003,
      shop_id: 1002,
      shop_name: "sunline-cutworks",
      title: "Layered Birth Flower Family Sign",
      description: "Personalized laser-cut wall sign with layered florals, painted lettering, and hanging hardware.",
      state: "active",
      type: "physical",
      quantity: 999,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      backlog_units: 1,
      price: 64,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9102,
      tags: ["birth flower", "family sign", "laser cut", "custom"],
      materials: ["birch plywood", "acrylic paint"],
      material_cost_per_unit: 18,
      capacity_units_per_item: 3,
      lead_time_days: 4,
      image_ids: [3201],
      views: 221,
      favorites: 67,
      url: "https://botique.example/listings/2003",
      created_at: "2026-02-18T10:00:00.000Z",
      updated_at: "2026-02-27T07:30:00.000Z",
      inventory: buildInventory(2003, "SLC-SIGN-004", 64, 999)
    },
    {
      listing_id: 2004,
      shop_id: 1002,
      shop_name: "sunline-cutworks",
      title: "Art Deco Suncatcher Ornament Set",
      description: "Set of three mirrored acrylic ornaments cut and packed in small decorative batches.",
      state: "draft",
      type: "physical",
      quantity: 8,
      fulfillment_mode: "stocked",
      quantity_on_hand: 8,
      backlog_units: 0,
      price: 24,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9102,
      tags: ["suncatcher", "acrylic", "art deco", "laser cut"],
      materials: ["mirror acrylic", "brass jump rings"],
      material_cost_per_unit: 7,
      capacity_units_per_item: 1,
      lead_time_days: 2,
      image_ids: [],
      views: 58,
      favorites: 12,
      url: "https://botique.example/listings/2004",
      created_at: "2026-02-24T13:00:00.000Z",
      updated_at: "2026-02-27T07:40:00.000Z",
      inventory: buildInventory(2004, "SLC-SUN-001", 24, 8)
    },
    {
      listing_id: 2005,
      shop_id: 1003,
      shop_name: "kiln-bloom-ceramics",
      title: "Speckled Espresso Cup Pair",
      description: "Pair of wheel-thrown stoneware espresso cups with a warm speckled glaze and trimmed foot.",
      state: "active",
      type: "physical",
      quantity: 2,
      fulfillment_mode: "stocked",
      quantity_on_hand: 2,
      backlog_units: 0,
      price: 42,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9103,
      tags: ["ceramics", "espresso cup", "speckled", "stoneware"],
      materials: ["stoneware clay", "food-safe glaze"],
      material_cost_per_unit: 13.5,
      capacity_units_per_item: 4,
      lead_time_days: 5,
      image_ids: [3301],
      views: 187,
      favorites: 54,
      url: "https://botique.example/listings/2005",
      created_at: "2026-02-17T08:30:00.000Z",
      updated_at: "2026-02-27T09:25:00.000Z",
      inventory: buildInventory(2005, "KBC-ESP-003", 42, 2)
    },
    {
      listing_id: 2006,
      shop_id: 1003,
      shop_name: "kiln-bloom-ceramics",
      title: "Wheel-Thrown Garlic Keeper",
      description: "Lidded stoneware garlic keeper made in the next firing cycle with carved ventilation slots.",
      state: "draft",
      type: "physical",
      quantity: 999,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      backlog_units: 0,
      price: 58,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9103,
      tags: ["garlic keeper", "stoneware", "wheel thrown", "kitchen"],
      materials: ["stoneware clay", "linen glaze"],
      material_cost_per_unit: 16,
      capacity_units_per_item: 5,
      lead_time_days: 7,
      image_ids: [],
      views: 49,
      favorites: 11,
      url: "https://botique.example/listings/2006",
      created_at: "2026-02-26T12:00:00.000Z",
      updated_at: "2026-02-27T09:30:00.000Z",
      inventory: buildInventory(2006, "KBC-GAR-001", 58, 999)
    },
    {
      listing_id: 2007,
      shop_id: 1004,
      shop_name: "oak-and-orbit",
      title: "Custom Oak Entryway Key Rail",
      description: "Made-to-order solid oak key rail with three brass hooks and an optional engraved family name.",
      state: "active",
      type: "physical",
      quantity: 999,
      fulfillment_mode: "made_to_order",
      quantity_on_hand: 0,
      backlog_units: 1,
      price: 72,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9104,
      tags: ["oak", "entryway", "key rail", "custom"],
      materials: ["white oak", "brass hooks", "hardwax oil"],
      material_cost_per_unit: 21,
      capacity_units_per_item: 4,
      lead_time_days: 6,
      image_ids: [3401],
      views: 143,
      favorites: 29,
      url: "https://botique.example/listings/2007",
      created_at: "2026-02-15T13:00:00.000Z",
      updated_at: "2026-02-27T06:55:00.000Z",
      inventory: buildInventory(2007, "OAO-KEY-002", 72, 999)
    },
    {
      listing_id: 2008,
      shop_id: 1004,
      shop_name: "oak-and-orbit",
      title: "Walnut Monitor Riser with Tray",
      description: "Finished walnut riser with a routed tray sized for pens, earbuds, and charging cables.",
      state: "draft",
      type: "physical",
      quantity: 1,
      fulfillment_mode: "stocked",
      quantity_on_hand: 1,
      backlog_units: 0,
      price: 84,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9104,
      tags: ["walnut", "monitor riser", "desk organizer", "woodwork"],
      materials: ["walnut", "hardwax oil", "felt pads"],
      material_cost_per_unit: 28,
      capacity_units_per_item: 5,
      lead_time_days: 4,
      image_ids: [],
      views: 26,
      favorites: 5,
      url: "https://botique.example/listings/2008",
      created_at: "2026-02-26T09:00:00.000Z",
      updated_at: "2026-02-27T07:00:00.000Z",
      inventory: buildInventory(2008, "OAO-RISE-001", 84, 1)
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
        {
          listing_id: 2001,
          title: "Stackable Seed Starter Tray Set",
          quantity: 1,
          price: 28
        }
      ],
      created_at: "2026-02-26T14:10:00.000Z",
      updated_at: "2026-02-26T18:40:00.000Z"
    },
    {
      receipt_id: 5002,
      shop_id: 1002,
      buyer_name: "Leo Ramirez",
      status: "paid",
      was_paid: true,
      was_shipped: false,
      was_delivered: false,
      total_price: 64,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2003,
          title: "Layered Birth Flower Family Sign",
          quantity: 1,
          price: 64
        }
      ],
      created_at: "2026-02-27T12:04:00.000Z",
      updated_at: "2026-02-27T12:04:00.000Z"
    },
    {
      receipt_id: 5003,
      shop_id: 1002,
      buyer_name: "Morgan Lee",
      status: "fulfilled",
      was_paid: true,
      was_shipped: true,
      was_delivered: true,
      total_price: 64,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2003,
          title: "Layered Birth Flower Family Sign",
          quantity: 1,
          price: 64
        }
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
      total_price: 42,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2005,
          title: "Speckled Espresso Cup Pair",
          quantity: 1,
          price: 42
        }
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
      total_price: 42,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2005,
          title: "Speckled Espresso Cup Pair",
          quantity: 1,
          price: 42
        }
      ],
      created_at: "2026-02-27T11:20:00.000Z",
      updated_at: "2026-02-27T18:15:00.000Z"
    },
    {
      receipt_id: 5006,
      shop_id: 1004,
      buyer_name: "Tessa Nguyen",
      status: "paid",
      was_paid: true,
      was_shipped: false,
      was_delivered: false,
      total_price: 72,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2007,
          title: "Custom Oak Entryway Key Rail",
          quantity: 1,
          price: 72
        }
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
      total_price: 72,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2007,
          title: "Custom Oak Entryway Key Rail",
          quantity: 1,
          price: 72
        }
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
      review: "Beautiful layering and finish. Proofing took a bit longer, but the sign looks great.",
      buyer_name: "Morgan Lee",
      created_at: "2026-02-26T10:25:00.000Z"
    },
    {
      review_id: 7003,
      shop_id: 1003,
      listing_id: 2005,
      rating: 5,
      review: "Exactly the kind of small-batch cup pair I hoped for.",
      buyer_name: "Mina Patel",
      created_at: "2026-02-26T17:00:00.000Z"
    },
    {
      review_id: 7004,
      shop_id: 1003,
      listing_id: 2005,
      rating: 5,
      review: "Beautiful glaze, careful packaging, and a lovely weight in hand.",
      buyer_name: "Noah Kim",
      created_at: "2026-02-27T19:10:00.000Z"
    },
    {
      review_id: 7005,
      shop_id: 1004,
      listing_id: 2007,
      rating: 3,
      review: "Finish is lovely, but production ran a couple days longer than I expected.",
      buyer_name: "Jordan Bell",
      created_at: "2026-02-26T11:40:00.000Z"
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
      amount: 64,
      currency_code: "USD",
      status: "pending",
      available_at: "2026-03-03T12:04:30.000Z",
      posted_at: "2026-02-27T12:04:30.000Z"
    },
    {
      payment_id: 8003,
      shop_id: 1002,
      receipt_id: 5003,
      amount: 64,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-24T11:36:00.000Z",
      posted_at: "2026-02-24T11:36:00.000Z"
    },
    {
      payment_id: 8004,
      shop_id: 1003,
      receipt_id: 5004,
      amount: 42,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-26T13:21:00.000Z",
      posted_at: "2026-02-26T13:21:00.000Z"
    },
    {
      payment_id: 8005,
      shop_id: 1003,
      receipt_id: 5005,
      amount: 42,
      currency_code: "USD",
      status: "posted",
      available_at: "2026-02-27T18:16:00.000Z",
      posted_at: "2026-02-27T18:16:00.000Z"
    },
    {
      payment_id: 8006,
      shop_id: 1004,
      receipt_id: 5006,
      amount: 72,
      currency_code: "USD",
      status: "pending",
      available_at: "2026-03-04T09:15:30.000Z",
      posted_at: "2026-02-27T09:15:30.000Z"
    },
    {
      payment_id: 8007,
      shop_id: 1004,
      receipt_id: 5007,
      amount: 72,
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
    },
    {
      taxonomy_id: 9102,
      parent_taxonomy_id: 9000,
      name: "Laser Cut Decor",
      full_path: "Creative Goods > Laser Cut Decor",
      level: 1
    },
    {
      taxonomy_id: 9103,
      parent_taxonomy_id: 9000,
      name: "Ceramics",
      full_path: "Creative Goods > Ceramics",
      level: 1
    },
    {
      taxonomy_id: 9104,
      parent_taxonomy_id: 9000,
      name: "Woodwork",
      full_path: "Creative Goods > Woodwork",
      level: 1
    }
  ];

  return { shops, listings, orders, reviews, payments, taxonomyNodes };
}
