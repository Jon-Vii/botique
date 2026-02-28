import { z } from "zod";

export const inventoryOfferingSchema = z.object({
  offering_id: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  quantity: z.number().int().nonnegative(),
  is_enabled: z.boolean()
});

export const inventoryProductSchema = z.object({
  sku: z.string(),
  property_values: z.array(z.object({ property_id: z.number().int(), value: z.string() })),
  offerings: z.array(inventoryOfferingSchema)
});

export const inventorySchema = z.object({
  listing_id: z.number().int().positive(),
  products: z.array(inventoryProductSchema),
  price_on_property: z.array(z.number().int()),
  quantity_on_property: z.array(z.number().int()),
  sku_on_property: z.array(z.number().int())
});

export const listingSchema = z.object({
  listing_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  shop_name: z.string(),
  title: z.string(),
  description: z.string(),
  state: z.enum(["draft", "active", "inactive", "sold_out"]),
  type: z.string(),
  quantity: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  currency_code: z.string(),
  who_made: z.string(),
  when_made: z.string(),
  taxonomy_id: z.number().int().positive(),
  tags: z.array(z.string()),
  materials: z.array(z.string()),
  image_ids: z.array(z.number().int()),
  views: z.number().int().nonnegative(),
  favorites: z.number().int().nonnegative(),
  url: z.string(),
  ranking_score: z.number().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  inventory: inventorySchema
});

export const storedShopSchema = z.object({
  shop_id: z.number().int().positive(),
  shop_name: z.string(),
  title: z.string(),
  announcement: z.string(),
  sale_message: z.string(),
  currency_code: z.string(),
  digital_product_policy: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

export const shopSchema = storedShopSchema.extend({
  listing_active_count: z.number().int().nonnegative(),
  total_sales_count: z.number().int().nonnegative(),
  review_average: z.number().nonnegative(),
  review_count: z.number().int().nonnegative()
});

export const orderLineItemSchema = z.object({
  listing_id: z.number().int().positive(),
  title: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative()
});

export const orderSchema = z.object({
  receipt_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  buyer_name: z.string(),
  status: z.enum(["paid", "fulfilled", "refunded"]),
  was_paid: z.boolean(),
  was_shipped: z.boolean(),
  was_delivered: z.boolean(),
  total_price: z.number().nonnegative(),
  currency_code: z.string(),
  line_items: z.array(orderLineItemSchema),
  created_at: z.string(),
  updated_at: z.string()
});

export const reviewSchema = z.object({
  review_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  listing_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  review: z.string(),
  buyer_name: z.string(),
  created_at: z.string()
});

export const paymentSchema = z.object({
  payment_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  receipt_id: z.number().int().positive(),
  amount: z.number().nonnegative(),
  currency_code: z.string(),
  status: z.enum(["posted", "pending"]),
  posted_at: z.string()
});

export const taxonomyNodeSchema = z.object({
  taxonomy_id: z.number().int().positive(),
  parent_taxonomy_id: z.number().int().positive().nullable(),
  name: z.string(),
  full_path: z.string(),
  level: z.number().int().nonnegative()
});

export const operationStatusSchema = z.object({
  ok: z.literal(true),
  deleted: z.boolean(),
  listing_id: z.number().int().positive()
});

export function paginatedResultsSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    count: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    results: z.array(itemSchema)
  });
}

export type Listing = z.infer<typeof listingSchema>;
export type ListingInventory = z.infer<typeof inventorySchema>;
export type Shop = z.infer<typeof shopSchema>;
export type StoredShop = z.infer<typeof storedShopSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type TaxonomyNode = z.infer<typeof taxonomyNodeSchema>;
export type OperationStatus = z.infer<typeof operationStatusSchema>;
