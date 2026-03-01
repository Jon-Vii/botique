import { z } from "zod";

const intField = () => z.coerce.number().int();
const positiveIntField = () => intField().positive();
const nonNegativeIntField = () => intField().nonnegative();
const numberField = () => z.coerce.number();
const nonNegativeNumberField = () => numberField().nonnegative();

const booleanFromUnknown = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  return value;
}, z.boolean());

const csvStringArray = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}, z.array(z.string()));

const csvIntArray = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item));
  }

  return value;
}, z.array(intField()));

const paginationQuerySchema = z.object({
  limit: nonNegativeIntField().min(1).max(100).default(25),
  offset: nonNegativeIntField().default(0)
});

export const shopIdParamsSchema = z.object({
  shop_id: positiveIntField()
});

export const listingIdParamsSchema = z.object({
  listing_id: positiveIntField()
});

export const shopListingParamsSchema = shopIdParamsSchema.merge(listingIdParamsSchema);

export const receiptParamsSchema = shopIdParamsSchema.extend({
  receipt_id: positiveIntField()
});

export const createDraftListingBodySchema = z.object({
  quantity: nonNegativeIntField(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: nonNegativeNumberField(),
  fulfillment_mode: z.enum(["stocked", "made_to_order"]).optional(),
  quantity_on_hand: nonNegativeIntField().optional(),
  who_made: z.string().trim().min(1),
  when_made: z.string().trim().min(1),
  taxonomy_id: positiveIntField(),
  state: z.enum(["draft", "active", "inactive"]).optional(),
  type: z.string().trim().min(1).optional(),
  tags: csvStringArray.optional(),
  materials: csvStringArray.optional(),
  material_cost_per_unit: nonNegativeNumberField().optional(),
  capacity_units_per_item: positiveIntField().optional(),
  lead_time_days: positiveIntField().optional(),
  image_ids: csvIntArray.optional(),
  url: z.string().trim().optional()
});

export const updateListingBodySchema = z
  .object({
    quantity: nonNegativeIntField().optional(),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    price: nonNegativeNumberField().optional(),
    fulfillment_mode: z.enum(["stocked", "made_to_order"]).optional(),
    quantity_on_hand: nonNegativeIntField().optional(),
    who_made: z.string().trim().min(1).optional(),
    when_made: z.string().trim().min(1).optional(),
    taxonomy_id: positiveIntField().optional(),
    state: z.enum(["draft", "active", "inactive", "sold_out"]).optional(),
    type: z.string().trim().min(1).optional(),
    tags: csvStringArray.optional(),
    materials: csvStringArray.optional(),
    material_cost_per_unit: nonNegativeNumberField().optional(),
    capacity_units_per_item: positiveIntField().optional(),
    lead_time_days: positiveIntField().optional(),
    image_ids: csvIntArray.optional(),
    url: z.string().trim().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one listing field is required.");

export const getShopListingsQuerySchema = paginationQuerySchema.extend({
  state: z.enum(["active", "draft", "inactive", "sold_out"]).optional(),
  sort_on: z.enum(["created", "updated", "price", "title"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  includes: z.string().optional(),
  language: z.string().optional()
});

export const searchMarketplaceQuerySchema = paginationQuerySchema.extend({
  keywords: z.string().trim().optional(),
  sort_on: z.enum(["score", "created", "price", "title"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  min_price: nonNegativeNumberField().optional(),
  max_price: nonNegativeNumberField().optional(),
  color: z.string().optional(),
  color_accuracy: nonNegativeNumberField().optional(),
  shop_location: z.string().optional(),
  category: z.string().optional(),
  taxonomy_id: positiveIntField().optional()
});

export const getListingQuerySchema = z.object({
  includes: z.string().optional(),
  language: z.string().optional()
});

export const updateShopBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    announcement: z.string().trim().optional(),
    sale_message: z.string().trim().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one shop field is required.");

export const getOrdersQuerySchema = paginationQuerySchema.extend({
  was_paid: booleanFromUnknown.optional(),
  was_shipped: booleanFromUnknown.optional(),
  was_delivered: booleanFromUnknown.optional(),
  min_created: z.union([z.string(), z.number()]).optional(),
  max_created: z.union([z.string(), z.number()]).optional(),
  min_last_modified: z.union([z.string(), z.number()]).optional(),
  max_last_modified: z.union([z.string(), z.number()]).optional(),
  sort_on: z.enum(["created", "updated", "total_price"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional()
});

export const getReviewsQuerySchema = paginationQuerySchema.extend({
  listing_id: positiveIntField().optional()
});

export const inventoryBodySchema = z.object({
  products: z.array(
    z.object({
      sku: z.string(),
      property_values: z.array(z.object({ property_id: intField(), value: z.string() })),
      offerings: z.array(
        z.object({
          offering_id: intField().optional(),
          price: nonNegativeNumberField(),
          quantity: nonNegativeIntField(),
          is_enabled: booleanFromUnknown
        })
      )
    })
  ),
  price_on_property: z.array(intField()).default([]),
  quantity_on_property: z.array(intField()).default([]),
  sku_on_property: z.array(intField()).default([])
});

export const taxonomyQuerySchema = z.object({
  taxonomy_id: positiveIntField().optional()
});

export const legacyQuerySchema = z.object({
  legacy: z.string().optional()
});

export type CreateDraftListingBody = z.infer<typeof createDraftListingBodySchema>;
export type UpdateListingBody = z.infer<typeof updateListingBodySchema>;
export type UpdateShopBody = z.infer<typeof updateShopBodySchema>;
export type SearchMarketplaceQuery = z.infer<typeof searchMarketplaceQuerySchema>;
export type GetShopListingsQuery = z.infer<typeof getShopListingsQuerySchema>;
export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>;
export type GetReviewsQuery = z.infer<typeof getReviewsQuerySchema>;
export type InventoryBody = z.infer<typeof inventoryBodySchema>;
