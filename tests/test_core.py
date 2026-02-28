from __future__ import annotations

import json
import unittest

from seller_core import SellerCoreClient
from seller_core.cli import main
from seller_core.models import ClientConfig, RequestPlan, ResponseEnvelope


class RecordingTransport:
    def __init__(self, response_data: object | None = None) -> None:
        self.response_data = response_data if response_data is not None else {"ok": "remote"}
        self.plans: list[RequestPlan] = []

    def send(self, plan: RequestPlan) -> ResponseEnvelope:
        self.plans.append(plan)
        return ResponseEnvelope(status_code=200, headers={}, data=self.response_data)


class CoreToolsClientTests(unittest.TestCase):
    def test_prepare_create_draft_listing_uses_form_request(self) -> None:
        client = SellerCoreClient(
            config=ClientConfig(
                base_url="https://api.example.test/v3/application",
                api_key="test-key",
                bearer_token="seller-token",
            )
        )

        plan = client.prepare(
            "create_draft_listing",
            {
                "shop_id": 42,
                "quantity": 5,
                "title": "Botique planner",
                "description": "Daily digital planner.",
                "price": 900,
                "who_made": "i_did",
                "when_made": "2020_2025",
                "taxonomy_id": 123,
                "type": "download",
            },
        )

        self.assertEqual(plan.method, "POST")
        self.assertEqual(
            plan.url, "https://api.example.test/v3/application/shops/42/listings"
        )
        self.assertEqual(plan.body_encoding.value, "form")
        self.assertEqual(plan.headers["x-api-key"], "test-key")
        self.assertEqual(plan.headers["Authorization"], "Bearer seller-token")
        self.assertEqual(plan.body["type"], "download")

    def test_prepare_delete_listing_uses_delete_method(self) -> None:
        client = SellerCoreClient(config=ClientConfig(base_url="https://api.example.test"))

        plan = client.prepare("delete_listing", {"shop_id": 42, "listing_id": 99})

        self.assertEqual(plan.method, "DELETE")
        self.assertEqual(
            plan.url, "https://api.example.test/shops/42/listings/99"
        )
        self.assertIsNone(plan.body)

    def test_prepare_update_listing_inventory_uses_json_body(self) -> None:
        client = SellerCoreClient(config=ClientConfig(base_url="https://api.example.test"))

        plan = client.prepare(
            "update_listing_inventory",
            {
                "listing_id": 123,
                "products": [
                    {
                        "sku": "SKU-1",
                        "offerings": [{"quantity": 1, "is_enabled": True, "price": 9.99}],
                        "property_values": [],
                    }
                ],
                "price_on_property": [],
                "quantity_on_property": [],
                "sku_on_property": [],
            },
        )

        self.assertEqual(plan.method, "PUT")
        self.assertEqual(plan.body_encoding.value, "json")
        self.assertEqual(plan.url, "https://api.example.test/listings/123/inventory")
        self.assertEqual(plan.body["products"][0]["sku"], "SKU-1")

    def test_call_search_marketplace_forwards_query_params(self) -> None:
        transport = RecordingTransport(response_data={"results": []})
        client = SellerCoreClient(
            config=ClientConfig(base_url="https://botique.example/api"),
            transport=transport,
        )

        result = client.search_marketplace(keywords="mushroom sticker", limit=10, offset=20)

        self.assertEqual(result, {"results": []})
        self.assertEqual(len(transport.plans), 1)
        plan = transport.plans[0]
        self.assertEqual(plan.method, "GET")
        self.assertEqual(plan.url, "https://botique.example/api/listings/active")
        self.assertEqual(
            plan.query,
            {"keywords": "mushroom sticker", "limit": 10, "offset": 20},
        )

    def test_prepare_requires_minimum_create_draft_listing_fields(self) -> None:
        client = SellerCoreClient(config=ClientConfig(base_url="https://api.example.test"))
        with self.assertRaisesRegex(ValueError, "missing required body fields"):
            client.prepare("create_draft_listing", {"shop_id": 1, "title": "Only a title"})


class CliTests(unittest.TestCase):
    def test_manifest_command_returns_tool_specs(self) -> None:
        from io import StringIO
        from unittest.mock import patch

        stdout = StringIO()
        with patch("sys.stdout", stdout):
            exit_code = main(["manifest"])

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        tool_names = {tool["tool_name"] for tool in payload["tools"]}
        self.assertIn("create_draft_listing", tool_names)
        self.assertIn("get_orders", tool_names)
        self.assertIn("delete_listing", tool_names)
        self.assertIn("update_listing_inventory", tool_names)

    def test_main_prepare_command_emits_json(self) -> None:
        from io import StringIO
        from unittest.mock import patch

        stdout = StringIO()
        argv = [
            "prepare",
            "get_shop_info",
            "--base-url",
            "https://botique.example/api",
            "--args",
            json.dumps({"shop_id": 99}),
        ]
        with patch("sys.stdout", stdout):
            exit_code = main(argv)

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["request"]["url"], "https://botique.example/api/shops/99")


if __name__ == "__main__":
    unittest.main()
