import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import process from "node:process";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";

import { buildApp } from "../src/app";
import { createInMemoryMarketplaceRepository } from "../src/repositories/in-memory-marketplace-repository";
import { createSampleState } from "./fixtures/sample-state";

const execFileAsync = promisify(execFile);

describe("Python SellerCoreClient contract", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseUrl = "";
  let listenError: unknown = null;

  before(async () => {
    app = await buildApp({
      repository: createInMemoryMarketplaceRepository(createSampleState())
    });

    try {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to resolve test server address.");
      }
      baseUrl = `http://127.0.0.1:${address.port}/v3/application`;
    } catch (error) {
      listenError = error;
    }
  });

  after(async () => {
    await app.close();
  });

  test("SellerCoreClient can create listings, inspect capacity, and queue stocked production over HTTP", async (t) => {
    if (listenError) {
      t.skip(`Local HTTP listen is unavailable in this environment: ${String(listenError)}`);
      return;
    }

    const python = await execFileAsync(
      "python3",
      [
        "-c",
        `
import json
from seller_core import SellerCoreClient
from seller_core.models import ClientConfig

client = SellerCoreClient(config=ClientConfig(base_url="${baseUrl}"))
created = client.create_draft_listing(
    shop_id=1001,
    quantity=3,
    title="Python Contract Hook Rail",
    description="Created from the Python client against the Botique server.",
    price=48,
    fulfillment_mode="made_to_order",
    quantity_on_hand=0,
    who_made="i_did",
    when_made="2020_2025",
    taxonomy_id=9104,
    type="physical",
    material_cost_per_unit=12,
    capacity_units_per_item=2,
    lead_time_days=4,
)
fetched = client.get_listing(listing_id=created["listing_id"])
capacity_before = client.get_capacity_status(shop_id=1001)
queued = client.queue_production(shop_id=1001, listing_id=2001, units=2)
capacity_after = client.get_capacity_status(shop_id=1001)
print(json.dumps({
    "listing_id": created["listing_id"],
    "state": created["state"],
    "title": fetched["title"],
    "queue_depth_before": capacity_before["queue_depth"],
    "queued_units": queued["units_queued"],
    "queue_depth_after": capacity_after["queue_depth"],
}))
        `
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONPATH: `${process.cwd()}/src`
        },
        encoding: "utf-8"
      }
    );

    const payload = JSON.parse(python.stdout.trim());
    assert.equal(payload.state, "draft");
    assert.equal(payload.title, "Python Contract Hook Rail");
    assert.equal(payload.queue_depth_before, 1);
    assert.equal(payload.queued_units, 2);
    assert.equal(payload.queue_depth_after, 3);
  });
});
