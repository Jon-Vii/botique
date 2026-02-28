import type {
  Listing,
  ListingInventory,
  Order,
  Payment,
  Review,
  StoredShop,
  TaxonomyNode
} from "../../src/schemas/domain";
import type { StoredMarketplaceState } from "../../src/repositories/types";

function buildInventory(listingId: number, sku: string, price: number, quantity: number): ListingInventory {
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

export function createSampleState(): StoredMarketplaceState {
  const shops: StoredShop[] = [
    {
      shop_id: 1001,
      shop_name: "northwind-printables",
      title: "Northwind Printables",
      announcement: "Fresh printable goods for cozy desks and calm walls.",
      sale_message: "Weekend launch pricing on new sticker packs.",
      currency_code: "USD",
      digital_product_policy: "Instant digital delivery for all items.",
      created_at: "2026-02-20T09:00:00.000Z",
      updated_at: "2026-02-27T08:30:00.000Z"
    },
    {
      shop_id: 1002,
      shop_name: "lumen-studio",
      title: "Lumen Studio",
      announcement: "Bold digital decor with retro color palettes.",
      sale_message: "New celestial wallpaper bundle just dropped.",
      currency_code: "USD",
      digital_product_policy: "Downloads only, no shipping delays.",
      created_at: "2026-02-18T08:00:00.000Z",
      updated_at: "2026-02-27T07:15:00.000Z"
    }
  ];

  const listings: Listing[] = [
    {
      listing_id: 2001,
      shop_id: 1001,
      shop_name: "northwind-printables",
      title: "Mushroom Cottage Printable Wall Art",
      description: "Set of three whimsical printable wall art files with cottagecore mushroom motifs.",
      state: "active",
      type: "download",
      quantity: 999,
      price: 14,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9101,
      tags: ["mushroom", "cottagecore", "wall art", "printable"],
      materials: ["pdf", "png"],
      image_ids: [3101, 3102],
      views: 124,
      favorites: 31,
      url: "https://botique.example/listings/2001",
      created_at: "2026-02-24T09:00:00.000Z",
      updated_at: "2026-02-27T08:45:00.000Z",
      inventory: buildInventory(2001, "NWP-WALL-001", 14, 999)
    },
    {
      listing_id: 2002,
      shop_id: 1001,
      shop_name: "northwind-printables",
      title: "Minimal Focus Planner",
      description: "Clean one-page digital planner built for fast daily planning.",
      state: "draft",
      type: "download",
      quantity: 999,
      price: 9,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9102,
      tags: ["planner", "minimal", "productivity"],
      materials: ["pdf"],
      image_ids: [],
      views: 10,
      favorites: 2,
      url: "https://botique.example/listings/2002",
      created_at: "2026-02-26T11:00:00.000Z",
      updated_at: "2026-02-27T08:50:00.000Z",
      inventory: buildInventory(2002, "NWP-PLAN-001", 9, 999)
    },
    {
      listing_id: 2003,
      shop_id: 1002,
      shop_name: "lumen-studio",
      title: "Retro Celestial Sticker Pack",
      description: "Printable sticker sheet featuring suns, moons, and stars in a retro palette.",
      state: "active",
      type: "download",
      quantity: 999,
      price: 6,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9103,
      tags: ["sticker", "retro", "celestial"],
      materials: ["pdf", "png"],
      image_ids: [3201],
      views: 188,
      favorites: 48,
      url: "https://botique.example/listings/2003",
      created_at: "2026-02-22T10:00:00.000Z",
      updated_at: "2026-02-27T07:30:00.000Z",
      inventory: buildInventory(2003, "LUM-STICK-004", 6, 999)
    },
    {
      listing_id: 2004,
      shop_id: 1002,
      shop_name: "lumen-studio",
      title: "Celestial Phone Wallpaper Bundle",
      description: "Five moody digital wallpapers designed for modern phones.",
      state: "active",
      type: "download",
      quantity: 999,
      price: 8,
      currency_code: "USD",
      who_made: "i_did",
      when_made: "2020_2025",
      taxonomy_id: 9104,
      tags: ["wallpaper", "phone", "celestial"],
      materials: ["jpg"],
      image_ids: [3202],
      views: 94,
      favorites: 17,
      url: "https://botique.example/listings/2004",
      created_at: "2026-02-21T13:00:00.000Z",
      updated_at: "2026-02-27T07:40:00.000Z",
      inventory: buildInventory(2004, "LUM-WALL-001", 8, 999)
    }
  ];

  const orders: Order[] = [
    {
      receipt_id: 5001,
      shop_id: 1001,
      buyer_name: "Ava Chen",
      status: "fulfilled",
      was_paid: true,
      was_shipped: false,
      was_delivered: true,
      total_price: 14,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2001,
          title: "Mushroom Cottage Printable Wall Art",
          quantity: 1,
          price: 14
        }
      ],
      created_at: "2026-02-26T14:10:00.000Z",
      updated_at: "2026-02-26T14:12:00.000Z"
    },
    {
      receipt_id: 5002,
      shop_id: 1002,
      buyer_name: "Leo Ramirez",
      status: "paid",
      was_paid: true,
      was_shipped: false,
      was_delivered: false,
      total_price: 8,
      currency_code: "USD",
      line_items: [
        {
          listing_id: 2004,
          title: "Celestial Phone Wallpaper Bundle",
          quantity: 1,
          price: 8
        }
      ],
      created_at: "2026-02-27T12:04:00.000Z",
      updated_at: "2026-02-27T12:04:00.000Z"
    }
  ];

  const reviews: Review[] = [
    {
      review_id: 7001,
      shop_id: 1001,
      listing_id: 2001,
      rating: 5,
      review: "Beautiful files and very easy to print.",
      buyer_name: "Ava Chen",
      created_at: "2026-02-27T09:10:00.000Z"
    },
    {
      review_id: 7002,
      shop_id: 1002,
      listing_id: 2003,
      rating: 4,
      review: "Great palette and clean sticker sheet layout.",
      buyer_name: "Riley Brooks",
      created_at: "2026-02-27T10:25:00.000Z"
    }
  ];

  const payments: Payment[] = [
    {
      payment_id: 8001,
      shop_id: 1001,
      receipt_id: 5001,
      amount: 14,
      currency_code: "USD",
      status: "posted",
      posted_at: "2026-02-26T14:13:00.000Z"
    },
    {
      payment_id: 8002,
      shop_id: 1002,
      receipt_id: 5002,
      amount: 8,
      currency_code: "USD",
      status: "pending",
      posted_at: "2026-02-27T12:04:30.000Z"
    }
  ];

  const taxonomyNodes: TaxonomyNode[] = [
    {
      taxonomy_id: 9000,
      parent_taxonomy_id: null,
      name: "Digital Goods",
      full_path: "Digital Goods",
      level: 0
    },
    {
      taxonomy_id: 9101,
      parent_taxonomy_id: 9000,
      name: "Printable Wall Art",
      full_path: "Digital Goods > Printable Wall Art",
      level: 1
    },
    {
      taxonomy_id: 9102,
      parent_taxonomy_id: 9000,
      name: "Digital Planners",
      full_path: "Digital Goods > Digital Planners",
      level: 1
    },
    {
      taxonomy_id: 9103,
      parent_taxonomy_id: 9000,
      name: "Sticker Packs",
      full_path: "Digital Goods > Sticker Packs",
      level: 1
    },
    {
      taxonomy_id: 9104,
      parent_taxonomy_id: 9000,
      name: "Phone Wallpapers",
      full_path: "Digital Goods > Phone Wallpapers",
      level: 1
    }
  ];

  return { shops, listings, orders, reviews, payments, taxonomyNodes };
}
