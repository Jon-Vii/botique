import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { buildApp } from "../src/app";
import { createInMemoryMarketplaceRepository } from "../src/repositories/in-memory-marketplace-repository";
import { createSampleState } from "./fixtures/sample-state";

describe("Botique server core endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp({
      repository: createInMemoryMarketplaceRepository(createSampleState())
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test("starts with seeded in-memory marketplace state by default", async (t) => {
    const defaultApp = await buildApp({
      config: {
        databaseUrl: undefined
      }
    });

    t.after(async () => {
      await defaultApp.close();
    });

    const [shopResponse, searchResponse, paymentsResponse, taxonomyResponse] = await Promise.all([
      defaultApp.inject({ method: "GET", url: "/v3/application/shops/1001" }),
      defaultApp.inject({ method: "GET", url: "/v3/application/listings/active?limit=10&offset=0" }),
      defaultApp.inject({ method: "GET", url: "/v3/application/shops/1001/payments" }),
      defaultApp.inject({ method: "GET", url: "/v3/application/seller-taxonomy/nodes?taxonomy_id=9000" })
    ]);

    assert.equal(shopResponse.statusCode, 200);
    assert.equal(shopResponse.json().shop_name, "northwind-printables");

    assert.equal(searchResponse.statusCode, 200);
    assert.ok(searchResponse.json().count >= 3);

    assert.equal(paymentsResponse.statusCode, 200);
    assert.equal(paymentsResponse.json().results[0].payment_id, 8001);

    assert.equal(taxonomyResponse.statusCode, 200);
    assert.equal(taxonomyResponse.json().count, 5);
  });

  test("creates, updates, reads, and deletes listings through the Etsy-shaped contract", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/v3/application/shops/1001/listings",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({
        quantity: "5",
        title: "Botique Test Listing",
        description: "Draft listing created through the compatibility contract.",
        price: "11.5",
        who_made: "i_did",
        when_made: "2020_2025",
        taxonomy_id: "9102",
        type: "download"
      }).toString()
    });

    assert.equal(createResponse.statusCode, 201);
    const createdListing = createResponse.json();
    assert.equal(createdListing.shop_id, 1001);
    assert.equal(createdListing.state, "draft");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/v3/application/shops/1001/listings/${createdListing.listing_id}`,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({
        state: "active",
        price: "12"
      }).toString()
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().state, "active");

    const getResponse = await app.inject({
      method: "GET",
      url: `/v3/application/listings/${createdListing.listing_id}`
    });

    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.json().price, 12);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/v3/application/shops/1001/listings/${createdListing.listing_id}`
    });

    assert.equal(deleteResponse.statusCode, 200);
    const deletePayload = deleteResponse.json() as {
      ok: boolean;
      deleted: boolean;
      listing_id: number;
    };
    assert.equal(deletePayload.ok, true);
    assert.equal(deletePayload.deleted, true);
    assert.equal(deletePayload.listing_id, createdListing.listing_id);
  });

  test("lists shop inventory and supports active marketplace search", async () => {
    const listingsResponse = await app.inject({
      method: "GET",
      url: "/v3/application/shops/1001/listings?state=active&limit=10&offset=0"
    });

    assert.equal(listingsResponse.statusCode, 200);
    const listingsPayload = listingsResponse.json();
    assert.equal(listingsPayload.count, 1);
    assert.equal(listingsPayload.results[0].listing_id, 2001);

    const searchResponse = await app.inject({
      method: "GET",
      url: "/v3/application/listings/active?keywords=mushroom&limit=5&offset=0"
    });

    assert.equal(searchResponse.statusCode, 200);
    const searchPayload = searchResponse.json();
    assert.equal(searchPayload.count, 1);
    assert.equal(searchPayload.results[0].listing_id, 2001);
    assert.ok(searchPayload.results[0].ranking_score > 0);
  });

  test("returns shop info, reviews, payments, taxonomy, and inventory documents", async () => {
    const [shopResponse, reviewsResponse, paymentsResponse, taxonomyResponse, inventoryResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/v3/application/shops/1001" }),
      app.inject({ method: "GET", url: "/v3/application/shops/1001/reviews?limit=10&offset=0" }),
      app.inject({ method: "GET", url: "/v3/application/shops/1001/payments" }),
      app.inject({ method: "GET", url: "/v3/application/seller-taxonomy/nodes?taxonomy_id=9000" }),
      app.inject({ method: "GET", url: "/v3/application/listings/2001/inventory" })
    ]);

    assert.equal(shopResponse.statusCode, 200);
    assert.equal(shopResponse.json().shop_name, "northwind-printables");

    assert.equal(reviewsResponse.statusCode, 200);
    assert.equal(reviewsResponse.json().results[0].review_id, 7001);

    assert.equal(paymentsResponse.statusCode, 200);
    assert.equal(paymentsResponse.json().results[0].payment_id, 8001);

    assert.equal(taxonomyResponse.statusCode, 200);
    assert.equal(taxonomyResponse.json().count, 5);

    assert.equal(inventoryResponse.statusCode, 200);
    assert.equal(inventoryResponse.json().listing_id, 2001);
  });

  test("filters receipts and returns receipt details", async () => {
    const ordersResponse = await app.inject({
      method: "GET",
      url: "/v3/application/shops/1001/receipts?was_paid=true&limit=10&offset=0"
    });

    assert.equal(ordersResponse.statusCode, 200);
    const ordersPayload = ordersResponse.json();
    assert.equal(ordersPayload.count, 1);
    assert.equal(ordersPayload.results[0].receipt_id, 5001);

    const orderResponse = await app.inject({
      method: "GET",
      url: "/v3/application/shops/1001/receipts/5001"
    });

    assert.equal(orderResponse.statusCode, 200);
    assert.equal(orderResponse.json().buyer_name, "Ava Chen");
  });

  test("lists only posted payments through the seller-facing contract", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v3/application/shops/1002/payments"
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.count, 0);
    assert.deepEqual(payload.results, []);
  });

  test("replaces full listing inventory with the JSON inventory contract, including zero stock", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/v3/application/listings/2001/inventory",
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        products: [
          {
            sku: "NEW-SKU-1",
            property_values: [],
            offerings: [
              {
                price: 18,
                quantity: 20,
                is_enabled: true
              }
            ]
          }
        ],
        price_on_property: [],
        quantity_on_property: [],
        sku_on_property: []
      })
    });

    assert.equal(response.statusCode, 200);
    const inventory = response.json();
    assert.equal(inventory.products[0].sku, "NEW-SKU-1");
    assert.equal(inventory.products[0].offerings[0].price, 18);
    assert.equal(inventory.listing_id, 2001);

    const updatedListing = await app.inject({
      method: "GET",
      url: "/v3/application/listings/2001"
    });
    assert.equal(updatedListing.json().quantity, 20);

    const zeroStockResponse = await app.inject({
      method: "PUT",
      url: "/v3/application/listings/2001/inventory",
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        products: [
          {
            sku: "NEW-SKU-1",
            property_values: [],
            offerings: [
              {
                price: 18,
                quantity: 0,
                is_enabled: true
              }
            ]
          }
        ],
        price_on_property: [],
        quantity_on_property: [],
        sku_on_property: []
      })
    });

    assert.equal(zeroStockResponse.statusCode, 200);

    const soldOutListing = await app.inject({
      method: "GET",
      url: "/v3/application/listings/2001"
    });
    assert.equal(soldOutListing.json().quantity, 0);

    const soldOutSearch = await app.inject({
      method: "GET",
      url: "/v3/application/listings/active?keywords=mushroom&limit=10&offset=0"
    });
    assert.equal(soldOutSearch.statusCode, 200);
    assert.equal(soldOutSearch.json().count, 0);

    const updatedShop = await app.inject({
      method: "GET",
      url: "/v3/application/shops/1001"
    });
    assert.equal(updatedShop.statusCode, 200);
    assert.equal(updatedShop.json().listing_active_count, 0);
  });
});
