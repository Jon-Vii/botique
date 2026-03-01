from __future__ import annotations

from seller_core.models import BodyEncoding, EndpointSpec, SellerToolSurface
from seller_core.tool_schemas import integer_schema, object_schema


SHOP_ID_SCHEMA = integer_schema(
    description="Your Botique shop identifier. The runtime usually binds this automatically to the current owner-agent shop.",
    minimum=1,
)
LISTING_ID_SCHEMA = integer_schema(
    description="Listing identifier for the stocked item you want to schedule for future production.",
    minimum=1,
)


BOTIQUE_EXTENSION_TOOL_SPECS: tuple[EndpointSpec, ...] = (
    EndpointSpec(
        tool_name="queue_production",
        operation_id="queueProduction",
        method="POST",
        path_template="/shops/{shop_id}/production-queue",
        description=(
            "Queue future production for a stocked listing. This reserves space in the same shared production system that also fulfills made-to-order backlog. "
            "Use it to create future finished inventory, not to bypass production constraints."
        ),
        surface=SellerToolSurface.EXTENSION,
        path_params=("shop_id",),
        body_encoding=BodyEncoding.JSON,
        required_body_fields=("listing_id", "units"),
        notes=(
            "In v1 this is intentionally for stocked listings. Made-to-order listings already create customer-order production jobs automatically when they sell.",
            "Queued work competes with existing backlog for the same daily production capacity.",
        ),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "listing_id": LISTING_ID_SCHEMA,
                "units": integer_schema(
                    description="How many future finished units to add to the production queue.",
                    minimum=1,
                    maximum=100,
                ),
            },
            required=("shop_id", "listing_id", "units"),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_capacity_status",
        operation_id="getCapacityStatus",
        method="GET",
        path_template="/shops/{shop_id}/production-status",
        description=(
            "Inspect shared production capacity, queue depth, and per-listing backlog before deciding what to activate, price, or produce next."
        ),
        surface=SellerToolSurface.EXTENSION,
        path_params=("shop_id",),
        notes=(
            "This is seller-visible Botique state, not control-plane hidden world access.",
        ),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
            },
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
)


BOTIQUE_EXTENSION_TOOL_INDEX = {
    spec.tool_name: spec for spec in BOTIQUE_EXTENSION_TOOL_SPECS
}
