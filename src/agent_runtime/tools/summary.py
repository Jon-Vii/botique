from __future__ import annotations

from typing import Any, Mapping

from seller_core.client import SellerCoreClient
from seller_core.models import JSONValue

from .registry import AgentToolRegistry, ToolManifestEntry, ToolSurface


DEFAULT_OWNER_AGENT_RUNTIME_SUMMARY_TOOLS: tuple[str, ...] = (
    "get_shop_dashboard",
    "get_listing_details",
)


def _bound_shop_id(arguments: Mapping[str, Any], shop_id: int | str | None) -> int | str:
    if shop_id is None:
        value = arguments.get("shop_id")
        if value is None:
            raise ValueError("shop_id is required.")
        return value

    requested = arguments.get("shop_id")
    if requested is not None and requested != shop_id:
        raise ValueError(f"shop_id is bound to {shop_id!r} for this agent.")
    return shop_id


def _require_listing_id(arguments: Mapping[str, Any]) -> int:
    value = arguments.get("listing_id")
    if not isinstance(value, int):
        raise ValueError("listing_id must be an integer.")
    return value


def _call_tool(
    client: SellerCoreClient,
    tool_name: str,
    arguments: Mapping[str, Any],
) -> Mapping[str, Any]:
    result = client.call(tool_name, arguments)
    if not isinstance(result, Mapping):
        raise ValueError(f"{tool_name} must return a JSON object.")
    return result


def _page_results(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    results = payload.get("results", ())
    if not isinstance(results, list):
        return []
    return [item for item in results if isinstance(item, Mapping)]


def _to_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return default


def _to_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return default


def _listing_signal_key(listing: Mapping[str, Any]) -> tuple[int, int]:
    return (
        _to_int(listing.get("favorites")),
        _to_int(listing.get("views")),
    )


def _capacity_index(capacity_status: Mapping[str, Any]) -> dict[int, Mapping[str, Any]]:
    return {
        _to_int(item.get("listing_id")): item
        for item in _page_results({"results": capacity_status.get("listings", [])})
    }


def _listing_dashboard_row(
    listing: Mapping[str, Any],
    *,
    capacity_listing: Mapping[str, Any] | None,
) -> dict[str, JSONValue]:
    return {
        "listing_id": _to_int(listing.get("listing_id")),
        "title": str(listing.get("title", "")),
        "state": str(listing.get("state", "")),
        "fulfillment_mode": str(listing.get("fulfillment_mode", "")),
        "price": round(_to_float(listing.get("price")), 2),
        "quantity_on_hand": _to_int(listing.get("quantity_on_hand")),
        "backlog_units": _to_int(listing.get("backlog_units")),
        "queued_stock_units": _to_int(
            (capacity_listing or {}).get("queued_stock_units")
        ),
        "queued_customer_order_units": _to_int(
            (capacity_listing or {}).get("queued_customer_order_units")
        ),
        "views": _to_int(listing.get("views")),
        "favorites": _to_int(listing.get("favorites")),
        "taxonomy_id": _to_int(listing.get("taxonomy_id")),
    }


def _review_summary(review: Mapping[str, Any]) -> dict[str, JSONValue]:
    return {
        "review_id": _to_int(review.get("review_id")),
        "listing_id": _to_int(review.get("listing_id")),
        "rating": _to_float(review.get("rating")),
        "buyer_name": str(review.get("buyer_name", "")),
        "excerpt": str(review.get("review", ""))[:160],
        "created_at": str(review.get("created_at", "")),
    }


def _order_summary(order: Mapping[str, Any]) -> dict[str, JSONValue]:
    line_items = order.get("line_items", ())
    sample_titles: list[str] = []
    if isinstance(line_items, list):
        for item in line_items[:2]:
            if isinstance(item, Mapping):
                title = item.get("title")
                if isinstance(title, str) and title:
                    sample_titles.append(title)

    return {
        "receipt_id": _to_int(order.get("receipt_id")),
        "status": str(order.get("status", "")),
        "total_price": round(_to_float(order.get("total_price")), 2),
        "buyer_name": str(order.get("buyer_name", "")),
        "created_at": str(order.get("created_at", "")),
        "titles": sample_titles,
    }


def _dashboard_alerts(
    *,
    active_rows: list[dict[str, JSONValue]],
    draft_count: int,
    capacity_status: Mapping[str, Any],
) -> list[str]:
    alerts: list[str] = []

    if not active_rows:
        alerts.append("No active listings are selling right now.")

    if draft_count > 0:
        alerts.append(
            f"{draft_count} draft listing(s) still need activation before they can sell."
        )

    low_stock_titles = [
        str(row["title"])
        for row in active_rows
        if row.get("fulfillment_mode") == "stocked"
        and _to_int(row.get("quantity_on_hand")) <= 2
    ]
    if low_stock_titles:
        alerts.append("Low stock risk: " + ", ".join(low_stock_titles[:3]) + ".")

    backlog_units = _to_int(capacity_status.get("backlog_units"))
    if backlog_units > 0:
        alerts.append(
            f"Backlog is at {backlog_units} unit(s); new made-to-order demand will compete for the same capacity."
        )

    queue_depth = _to_int(capacity_status.get("queue_depth"))
    if queue_depth > 0:
        alerts.append(f"{queue_depth} production job(s) are already queued.")

    return alerts


def _signal_summary(
    listings: list[Mapping[str, Any]],
) -> dict[str, JSONValue] | None:
    if not listings:
        return None
    strongest = max(listings, key=_listing_signal_key)
    weakest = min(listings, key=_listing_signal_key)
    return {
        "strongest": {
            "listing_id": _to_int(strongest.get("listing_id")),
            "title": str(strongest.get("title", "")),
            "views": _to_int(strongest.get("views")),
            "favorites": _to_int(strongest.get("favorites")),
        },
        "weakest": {
            "listing_id": _to_int(weakest.get("listing_id")),
            "title": str(weakest.get("title", "")),
            "views": _to_int(weakest.get("views")),
            "favorites": _to_int(weakest.get("favorites")),
        },
    }


def register_owner_summary_tools(
    registry: AgentToolRegistry,
    client: SellerCoreClient,
    *,
    shop_id: int | str | None = None,
) -> AgentToolRegistry:
    registry.register(
        ToolManifestEntry(
            name="get_shop_dashboard",
            description=(
                "Read a compact owner dashboard for the current shop, including cash, listing counts, "
                "production pressure, recent order and review signals, and short listing rows."
            ),
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            parameters_schema={
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False,
            },
            notes=(
                "This is a runtime-composed seller-visible summary over existing shop tools. It does not reveal hidden world state.",
            ),
        ),
        lambda arguments, *, seller_client=client, bound_shop_id=shop_id: _get_shop_dashboard(
            seller_client,
            bound_shop_id=bound_shop_id,
            arguments=arguments,
        ),
    )

    registry.register(
        ToolManifestEntry(
            name="get_listing_details",
            description=(
                "Inspect one listing in detail, including its current economics, stock or backlog, queued production, "
                "and recent review signals."
            ),
            surface=ToolSurface.EXTENSION,
            work_cost=1,
            required_body_fields=("listing_id",),
            body_encoding="json",
            parameters_schema={
                "type": "object",
                "properties": {
                    "listing_id": {
                        "type": "integer",
                        "description": "Listing identifier to inspect in detail.",
                    }
                },
                "required": ["listing_id"],
                "additionalProperties": False,
            },
            notes=(
                "Use this drill-down after the shop dashboard highlights a listing worth changing or producing.",
            ),
        ),
        lambda arguments, *, seller_client=client, bound_shop_id=shop_id: _get_listing_details(
            seller_client,
            bound_shop_id=bound_shop_id,
            arguments=arguments,
        ),
    )
    return registry


def _get_shop_dashboard(
    client: SellerCoreClient,
    *,
    bound_shop_id: int | str | None,
    arguments: Mapping[str, Any],
) -> dict[str, JSONValue]:
    shop_id = _bound_shop_id(arguments, bound_shop_id)
    shop = _call_tool(client, "get_shop_info", {"shop_id": shop_id})
    listings = _page_results(
        _call_tool(client, "get_shop_listings", {"shop_id": shop_id, "limit": 100, "offset": 0})
    )
    orders = _page_results(
        _call_tool(client, "get_orders", {"shop_id": shop_id, "limit": 5, "offset": 0})
    )
    reviews = _page_results(
        _call_tool(client, "get_reviews", {"shop_id": shop_id, "limit": 3, "offset": 0})
    )
    payments = _page_results(_call_tool(client, "get_payments", {"shop_id": shop_id}))
    capacity_status = _call_tool(client, "get_capacity_status", {"shop_id": shop_id})

    posted_total = sum(_to_float(item.get("amount")) for item in payments)
    posted_receipt_ids = {_to_int(item.get("receipt_id")) for item in payments}
    pending_total = sum(
        _to_float(item.get("total_price"))
        for item in orders
        if bool(item.get("was_paid"))
        and _to_int(item.get("receipt_id")) not in posted_receipt_ids
        and str(item.get("status", "")) != "refunded"
    )

    active_listings = [item for item in listings if item.get("state") == "active"]
    draft_listings = [item for item in listings if item.get("state") == "draft"]
    capacity_by_listing = _capacity_index(capacity_status)
    ordered_rows = sorted(
        listings,
        key=lambda item: (
            0 if item.get("state") == "active" else 1,
            -_to_int(item.get("favorites")),
            -_to_int(item.get("views")),
            _to_int(item.get("listing_id")),
        ),
    )
    listing_rows = [
        _listing_dashboard_row(
            listing,
            capacity_listing=capacity_by_listing.get(_to_int(listing.get("listing_id"))),
        )
        for listing in ordered_rows[:8]
    ]

    return {
        "shop": {
            "shop_id": _to_int(shop.get("shop_id")),
            "shop_name": str(shop.get("shop_name", "")),
            "currency_code": str(shop.get("currency_code", "USD")),
        },
        "balance_summary": {
            "available": round(posted_total, 2),
            "pending": round(pending_total, 2),
            "currency_code": str(shop.get("currency_code", "USD")),
        },
        "catalog_summary": {
            "active_listings": len(active_listings),
            "draft_listings": len(draft_listings),
            "total_listings": len(listings),
        },
        "production_summary": {
            "production_capacity_per_day": _to_int(capacity_status.get("production_capacity_per_day")),
            "backlog_units": _to_int(capacity_status.get("backlog_units")),
            "queue_depth": _to_int(capacity_status.get("queue_depth")),
            "queued_stock_units": _to_int(capacity_status.get("queued_stock_units")),
            "queued_customer_order_units": _to_int(
                capacity_status.get("queued_customer_order_units")
            ),
        },
        "recent_orders_summary": {
            "count": len(orders),
            "sample": [_order_summary(order) for order in orders[:3]],
        },
        "recent_reviews_summary": {
            "count": _to_int(shop.get("review_count")),
            "average_rating": round(_to_float(shop.get("review_average")), 2),
            "sample": [_review_summary(review) for review in reviews[:3]],
        },
        "listing_signal_summary": _signal_summary(active_listings),
        "alerts": _dashboard_alerts(
            active_rows=[row for row in listing_rows if row.get("state") == "active"],
            draft_count=len(draft_listings),
            capacity_status=capacity_status,
        ),
        "listings": listing_rows,
    }


def _get_listing_details(
    client: SellerCoreClient,
    *,
    bound_shop_id: int | str | None,
    arguments: Mapping[str, Any],
) -> dict[str, JSONValue]:
    shop_id = _bound_shop_id(arguments, bound_shop_id)
    listing_id = _require_listing_id(arguments)
    listing = _call_tool(
        client,
        "get_listing",
        {"listing_id": listing_id},
    )
    reviews = _page_results(
        _call_tool(
            client,
            "get_reviews",
            {"shop_id": shop_id, "listing_id": listing_id, "limit": 3, "offset": 0},
        )
    )
    capacity_status = _call_tool(client, "get_capacity_status", {"shop_id": shop_id})
    capacity_listing = _capacity_index(capacity_status).get(listing_id, {})

    return {
        "listing": {
            "listing_id": _to_int(listing.get("listing_id")),
            "title": str(listing.get("title", "")),
            "state": str(listing.get("state", "")),
            "fulfillment_mode": str(listing.get("fulfillment_mode", "")),
            "price": round(_to_float(listing.get("price")), 2),
            "taxonomy_id": _to_int(listing.get("taxonomy_id")),
            "tags": list(listing.get("tags", []))
            if isinstance(listing.get("tags"), list)
            else [],
            "views": _to_int(listing.get("views")),
            "favorites": _to_int(listing.get("favorites")),
            "quantity_on_hand": _to_int(listing.get("quantity_on_hand")),
            "backlog_units": _to_int(listing.get("backlog_units")),
            "material_cost_per_unit": round(
                _to_float(listing.get("material_cost_per_unit")), 2
            ),
            "capacity_units_per_item": _to_int(listing.get("capacity_units_per_item"), 1),
            "lead_time_days": _to_int(listing.get("lead_time_days"), 1),
        },
        "production_status": {
            "queued_stock_units": _to_int(capacity_listing.get("queued_stock_units")),
            "queued_customer_order_units": _to_int(
                capacity_listing.get("queued_customer_order_units")
            ),
            "shop_backlog_units": _to_int(capacity_status.get("backlog_units")),
            "production_capacity_per_day": _to_int(
                capacity_status.get("production_capacity_per_day")
            ),
        },
        "recent_reviews": [_review_summary(review) for review in reviews],
    }
