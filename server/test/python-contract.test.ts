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

  test("SellerCoreClient can create and fetch a listing over HTTP", async (t) => {
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
    title="Python Contract Listing",
    description="Created from the Python client against the Botique server.",
    price=10,
    who_made="i_did",
    when_made="2020_2025",
    taxonomy_id=9102,
    type="download",
)
fetched = client.get_listing(listing_id=created["listing_id"])
print(json.dumps({
    "listing_id": created["listing_id"],
    "state": created["state"],
    "title": fetched["title"],
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
    assert.equal(payload.title, "Python Contract Listing");
  });
});
