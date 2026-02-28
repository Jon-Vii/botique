import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError, type ZodTypeAny, z } from "zod";

import { AppError, BadRequestError } from "../errors";
import {
  inventorySchema,
  listingSchema,
  operationStatusSchema,
  orderSchema,
  paginatedResultsSchema,
  paymentSchema,
  reviewSchema,
  shopSchema,
  taxonomyNodeSchema
} from "../schemas/domain";
import {
  createDraftListingBodySchema,
  getListingQuerySchema,
  getOrdersQuerySchema,
  getReviewsQuerySchema,
  getShopListingsQuerySchema,
  inventoryBodySchema,
  legacyQuerySchema,
  listingIdParamsSchema,
  receiptParamsSchema,
  searchMarketplaceQuerySchema,
  shopIdParamsSchema,
  shopListingParamsSchema,
  taxonomyQuerySchema,
  updateListingBodySchema,
  updateShopBodySchema
} from "../schemas/requests";
import type { MarketplaceService } from "../services/marketplace-service";

function parseValue<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  label: string
): z.output<TSchema> {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestError(`Invalid ${label}.`, error.flatten());
    }
    throw error;
  }
}

function sendValidated<TSchema extends ZodTypeAny>(
  reply: FastifyReply,
  schema: TSchema,
  payload: unknown,
  statusCode = 200
) {
  const validated = schema.parse(payload);
  reply.code(statusCode);
  return validated;
}

export async function registerCoreRoutes(app: FastifyInstance, service: MarketplaceService) {
  const listingsPageSchema = paginatedResultsSchema(listingSchema);
  const ordersPageSchema = paginatedResultsSchema(orderSchema);
  const reviewsPageSchema = paginatedResultsSchema(reviewSchema);
  const paymentsPageSchema = paginatedResultsSchema(paymentSchema);
  const taxonomyPageSchema = paginatedResultsSchema(taxonomyNodeSchema);

  app.post("/shops/:shop_id/listings", async (request: FastifyRequest, reply) => {
    parseValue(legacyQuerySchema, request.query ?? {}, "query parameters");
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const body = parseValue(createDraftListingBodySchema, request.body ?? {}, "request body");
    const listing = await service.createDraftListing(params.shop_id, body);
    return sendValidated(reply, listingSchema, listing, 201);
  });

  app.patch("/shops/:shop_id/listings/:listing_id", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopListingParamsSchema, request.params, "path parameters");
    const body = parseValue(updateListingBodySchema, request.body ?? {}, "request body");
    const listing = await service.updateListing(params.shop_id, params.listing_id, body);
    return sendValidated(reply, listingSchema, listing);
  });

  app.delete("/shops/:shop_id/listings/:listing_id", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopListingParamsSchema, request.params, "path parameters");
    const result = await service.deleteListing(params.shop_id, params.listing_id);
    return sendValidated(reply, operationStatusSchema, result);
  });

  app.get("/listings/active", async (request: FastifyRequest, reply) => {
    const query = parseValue(searchMarketplaceQuerySchema, request.query ?? {}, "query parameters");
    const listings = await service.searchMarketplace(query);
    return sendValidated(reply, listingsPageSchema, listings);
  });

  app.get("/listings/:listing_id", async (request: FastifyRequest, reply) => {
    parseValue(getListingQuerySchema, request.query ?? {}, "query parameters");
    const params = parseValue(listingIdParamsSchema, request.params, "path parameters");
    const listing = await service.getListing(params.listing_id);
    return sendValidated(reply, listingSchema, listing);
  });

  app.get("/shops/:shop_id/listings", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const query = parseValue(getShopListingsQuerySchema, request.query ?? {}, "query parameters");
    const listings = await service.getShopListings(params.shop_id, query);
    return sendValidated(reply, listingsPageSchema, listings);
  });

  app.get("/listings/:listing_id/inventory", async (request: FastifyRequest, reply) => {
    const params = parseValue(listingIdParamsSchema, request.params, "path parameters");
    const inventory = await service.getListingInventory(params.listing_id);
    return sendValidated(reply, inventorySchema, inventory);
  });

  app.put("/listings/:listing_id/inventory", async (request: FastifyRequest, reply) => {
    const params = parseValue(listingIdParamsSchema, request.params, "path parameters");
    const body = parseValue(inventoryBodySchema, request.body ?? {}, "request body");
    const inventory = await service.updateListingInventory(params.listing_id, body);
    return sendValidated(reply, inventorySchema, inventory);
  });

  app.get("/shops/:shop_id", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const shop = await service.getShopInfo(params.shop_id);
    return sendValidated(reply, shopSchema, shop);
  });

  app.put("/shops/:shop_id", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const body = parseValue(updateShopBodySchema, request.body ?? {}, "request body");
    const shop = await service.updateShop(params.shop_id, body);
    return sendValidated(reply, shopSchema, shop);
  });

  app.get("/shops/:shop_id/receipts", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const query = parseValue(getOrdersQuerySchema, request.query ?? {}, "query parameters");
    const orders = await service.getOrders(params.shop_id, query);
    return sendValidated(reply, ordersPageSchema, orders);
  });

  app.get("/shops/:shop_id/receipts/:receipt_id", async (request: FastifyRequest, reply) => {
    const params = parseValue(receiptParamsSchema, request.params, "path parameters");
    const order = await service.getOrderDetails(params.shop_id, params.receipt_id);
    return sendValidated(reply, orderSchema, order);
  });

  app.get("/shops/:shop_id/payments", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const payments = await service.getPayments(params.shop_id);
    return sendValidated(reply, paymentsPageSchema, payments);
  });

  app.get("/shops/:shop_id/reviews", async (request: FastifyRequest, reply) => {
    const params = parseValue(shopIdParamsSchema, request.params, "path parameters");
    const query = parseValue(getReviewsQuerySchema, request.query ?? {}, "query parameters");
    const reviews = await service.getReviews(params.shop_id, query);
    return sendValidated(reply, reviewsPageSchema, reviews);
  });

  app.get("/seller-taxonomy/nodes", async (request: FastifyRequest, reply) => {
    const query = parseValue(taxonomyQuerySchema, request.query ?? {}, "query parameters");
    const taxonomyNodes = await service.getTaxonomyNodes(query.taxonomy_id);
    return sendValidated(reply, taxonomyPageSchema, taxonomyNodes);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          type: error.name,
          message: error.message,
          details: error.details ?? null
        }
      });
    }

    if (error instanceof ZodError) {
      return reply.code(500).send({
        ok: false,
        error: {
          type: "ResponseValidationError",
          message: "Server produced an invalid response.",
          details: error.flatten()
        }
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      ok: false,
      error: {
        type: "InternalServerError",
        message: "Unexpected server error."
      }
    });
  });
}
