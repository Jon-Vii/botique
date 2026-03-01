from __future__ import annotations

from seller_core.models import BodyEncoding, EndpointSpec
from seller_core.tool_schemas import (
    array_schema,
    boolean_schema,
    integer_schema,
    number_schema,
    object_schema,
    string_schema,
)


ETSY_V3_BASE_URL = "https://api.etsy.com/v3/application"


SHOP_ID_SCHEMA = integer_schema(
    description="Your Botique shop identifier. The runtime usually binds this automatically to the current owner-agent shop.",
    minimum=1,
)
LISTING_ID_SCHEMA = integer_schema(
    description="Listing identifier for the offer you want to inspect or change.",
    minimum=1,
)
RECEIPT_ID_SCHEMA = integer_schema(
    description="Receipt/order identifier returned by get_orders.",
    minimum=1,
)
LIMIT_SCHEMA = integer_schema(
    description="Maximum number of results to return.",
    minimum=1,
    maximum=100,
)
OFFSET_SCHEMA = integer_schema(
    description="Zero-based pagination offset.",
    minimum=0,
)
LISTING_STATE_SCHEMA = string_schema(
    description=(
        "Listing publication state. `draft` listings do not sell or appear in marketplace search. "
        "`active` listings can sell when they still have sellable inventory or capacity. "
        "`inactive` hides the listing without deleting it. `sold_out` reflects no sellable stock."
    ),
    enum=("draft", "active", "inactive", "sold_out"),
)
FULFILLMENT_MODE_SCHEMA = string_schema(
    description=(
        "`stocked` listings sell finished units already on hand. "
        "`made_to_order` listings sell future production capacity and accumulate backlog until production completes."
    ),
    enum=("stocked", "made_to_order"),
)
STRING_ARRAY_SCHEMA = array_schema(
    description="List of strings.",
    items={"type": "string"},
)


CORE_TOOL_SPECS: tuple[EndpointSpec, ...] = (
    EndpointSpec(
        tool_name="create_draft_listing",
        operation_id="createDraftListing",
        method="POST",
        path_template="/shops/{shop_id}/listings",
        description=(
            "Create a new draft listing. Draft listings do not sell until you later update them to `active`. "
            "Choose `stocked` when customers should buy finished units already on hand; choose `made_to_order` when "
            "customers should buy future production capacity and create backlog."
        ),
        scopes=("listings_w",),
        path_params=("shop_id",),
        query_params=("legacy",),
        body_encoding=BodyEncoding.FORM,
        required_body_fields=(
            "quantity",
            "title",
            "description",
            "price",
            "who_made",
            "when_made",
            "taxonomy_id",
        ),
        notes=(
            "Draft listings are intentionally safe to prepare before they affect sales.",
            "For stocked listings, keep quantity and quantity_on_hand aligned with finished inventory you can actually ship.",
            "For made-to-order listings, quantity is only a compatibility availability field; real fulfillment comes from future shared production capacity and backlog.",
        ),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "title": string_schema(
                    description="Customer-facing listing title used for search relevance and conversion.",
                    min_length=1,
                ),
                "description": string_schema(
                    description="Customer-facing description. Clear descriptions support ranking and conversion.",
                    min_length=1,
                ),
                "price": number_schema(
                    description="Sale price charged when an order is created.",
                    minimum=0,
                ),
                "fulfillment_mode": FULFILLMENT_MODE_SCHEMA,
                "quantity": integer_schema(
                    description=(
                        "Compatibility sellable quantity field. For stocked listings it should reflect finished units on hand. "
                        "For made-to-order listings it acts as an availability signal rather than finished inventory."
                    ),
                    minimum=0,
                ),
                "quantity_on_hand": integer_schema(
                    description="Finished inventory already completed and ready to sell. Relevant for stocked listings.",
                    minimum=0,
                ),
                "who_made": string_schema(
                    description="Maker attribution field required by the Etsy-shaped contract.",
                    min_length=1,
                ),
                "when_made": string_schema(
                    description="Production timing field required by the Etsy-shaped contract.",
                    min_length=1,
                ),
                "taxonomy_id": integer_schema(
                    description="Seller taxonomy node for category placement and search relevance.",
                    minimum=1,
                ),
                "state": string_schema(
                    description="Initial listing state. Use `draft` unless you intentionally want this listing to start selling immediately.",
                    enum=("draft", "active", "inactive"),
                ),
                "type": string_schema(
                    description="Compatibility listing type such as `physical` or `download`.",
                    min_length=1,
                ),
                "tags": array_schema(
                    description="Search and trend tags associated with the listing.",
                    items={"type": "string"},
                ),
                "materials": array_schema(
                    description="Materials visible to buyers and useful for category coherence.",
                    items={"type": "string"},
                ),
                "material_cost_per_unit": number_schema(
                    description="Material spend incurred when a unit enters production.",
                    minimum=0,
                ),
                "capacity_units_per_item": integer_schema(
                    description="Shared production capacity consumed to make one unit.",
                    minimum=1,
                ),
                "lead_time_days": integer_schema(
                    description="Days between finishing production and the unit becoming ready.",
                    minimum=1,
                ),
                "image_ids": array_schema(
                    description="Compatibility image ids. Botique does not require them for agent experimentation.",
                    items={"type": "integer"},
                ),
            },
            required=(
                "shop_id",
                "quantity",
                "title",
                "description",
                "price",
                "who_made",
                "when_made",
                "taxonomy_id",
            ),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="update_listing",
        operation_id="updateListing",
        method="PATCH",
        path_template="/shops/{shop_id}/listings/{listing_id}",
        description=(
            "Change a listing's economics or publication state. Setting `state` to `active` makes the listing sellable. "
            "`stocked` listings sell from finished inventory; `made_to_order` listings sell into backlog against future production capacity."
        ),
        scopes=("listings_w",),
        path_params=("shop_id", "listing_id"),
        body_encoding=BodyEncoding.FORM,
        notes=(
            "Use this to activate a draft once price, production assumptions, and inventory/backlog behavior are acceptable.",
            "Changing fulfillment_mode changes how future sales are resolved, not how past orders are reinterpreted.",
        ),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "listing_id": LISTING_ID_SCHEMA,
                "title": string_schema(
                    description="Revised customer-facing title.",
                    min_length=1,
                ),
                "description": string_schema(
                    description="Revised customer-facing description.",
                    min_length=1,
                ),
                "price": number_schema(
                    description="New sale price for future orders.",
                    minimum=0,
                ),
                "state": LISTING_STATE_SCHEMA,
                "fulfillment_mode": FULFILLMENT_MODE_SCHEMA,
                "quantity": integer_schema(
                    description="Compatibility sellable quantity field. Prefer quantity_on_hand when changing stocked inventory assumptions.",
                    minimum=0,
                ),
                "quantity_on_hand": integer_schema(
                    description="Finished inventory available now for stocked listings.",
                    minimum=0,
                ),
                "taxonomy_id": integer_schema(
                    description="Updated taxonomy node for category placement.",
                    minimum=1,
                ),
                "tags": array_schema(
                    description="Updated tags used by search and trend matching.",
                    items={"type": "string"},
                ),
                "materials": array_schema(
                    description="Updated materials shown to buyers.",
                    items={"type": "string"},
                ),
                "material_cost_per_unit": number_schema(
                    description="Updated material cost incurred whenever a new unit enters production.",
                    minimum=0,
                ),
                "capacity_units_per_item": integer_schema(
                    description="Updated shared-capacity cost to produce one unit.",
                    minimum=1,
                ),
                "lead_time_days": integer_schema(
                    description="Updated production lead time in days.",
                    minimum=1,
                ),
                "who_made": string_schema(
                    description="Compatibility maker attribution field.",
                    min_length=1,
                ),
                "when_made": string_schema(
                    description="Compatibility production timing field.",
                    min_length=1,
                ),
                "type": string_schema(
                    description="Compatibility listing type.",
                    min_length=1,
                ),
                "image_ids": array_schema(
                    description="Compatibility image ids.",
                    items={"type": "integer"},
                ),
                "url": string_schema(
                    description="Override listing URL if needed for testing.",
                    min_length=1,
                ),
            },
            required=("shop_id", "listing_id"),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="delete_listing",
        operation_id="deleteListing",
        method="DELETE",
        path_template="/shops/{shop_id}/listings/{listing_id}",
        description=(
            "Delete a listing from the shop. This stops future sales from that listing, but already-created orders and backlog remain world-owned outcomes."
        ),
        scopes=("listings_d",),
        path_params=("shop_id", "listing_id"),
        notes=(
            "Prefer deactivation over deletion when you may want to inspect or revive a listing later.",
        ),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "listing_id": LISTING_ID_SCHEMA,
            },
            required=("shop_id", "listing_id"),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_listing",
        operation_id="getListing",
        method="GET",
        path_template="/listings/{listing_id}",
        description=(
            "Inspect one listing's current economics and sellability, including state, fulfillment mode, finished inventory, backlog, and production assumptions."
        ),
        path_params=("listing_id",),
        query_params=("includes", "language"),
        scopes=("listings_r",),
        parameters_schema=object_schema(
            properties={
                "listing_id": LISTING_ID_SCHEMA,
            },
            required=("listing_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_shop_listings",
        operation_id="getListingsByShop",
        method="GET",
        path_template="/shops/{shop_id}/listings",
        description=(
            "Review your shop's listings. Use this to compare drafts versus active offers and to inspect which stocked listings have inventory or which made-to-order listings are building backlog."
        ),
        path_params=("shop_id",),
        query_params=(
            "state",
            "limit",
            "offset",
            "sort_on",
            "sort_order",
            "includes",
            "language",
        ),
        scopes=("listings_r",),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "state": string_schema(
                    description="Optional listing-state filter.",
                    enum=("active", "draft", "inactive", "sold_out"),
                ),
                "limit": LIMIT_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "sort_on": string_schema(
                    description="Field used to sort your listings.",
                    enum=("created", "updated", "price", "title"),
                ),
                "sort_order": string_schema(
                    description="Sort direction.",
                    enum=("asc", "desc"),
                ),
            },
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="search_marketplace",
        operation_id="findAllListingsActive",
        method="GET",
        path_template="/listings/active",
        description=(
            "Search competing active marketplace listings. Draft listings never appear here. Use this to compare price, positioning, and category competition before editing your own offers."
        ),
        query_params=(
            "keywords",
            "sort_on",
            "sort_order",
            "min_price",
            "max_price",
            "color",
            "color_accuracy",
            "shop_location",
            "category",
            "taxonomy_id",
            "limit",
            "offset",
        ),
        scopes=(),
        parameters_schema=object_schema(
            properties={
                "keywords": string_schema(
                    description="Search phrase to compare against marketplace titles, descriptions, and tags.",
                    min_length=1,
                ),
                "taxonomy_id": integer_schema(
                    description="Optional taxonomy filter for a specific category branch.",
                    minimum=1,
                ),
                "min_price": number_schema(
                    description="Optional minimum sale price filter.",
                    minimum=0,
                ),
                "max_price": number_schema(
                    description="Optional maximum sale price filter.",
                    minimum=0,
                ),
                "limit": LIMIT_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "sort_on": string_schema(
                    description="Field used to rank results.",
                    enum=("score", "created", "price", "title"),
                ),
                "sort_order": string_schema(
                    description="Sort direction.",
                    enum=("asc", "desc"),
                ),
            },
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_listing_inventory",
        operation_id="getListingInventory",
        method="GET",
        path_template="/listings/{listing_id}/inventory",
        description=(
            "Read the low-level inventory document for a listing. In Botique this is mainly a compatibility surface for stocked inventory, not the preferred way to reason about shared production."
        ),
        path_params=("listing_id",),
        scopes=("listings_r",),
        notes=(
            "Owner agents should usually prefer get_listing plus production-aware tools over low-level inventory document inspection.",
        ),
        parameters_schema=object_schema(
            properties={"listing_id": LISTING_ID_SCHEMA},
            required=("listing_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="update_listing_inventory",
        operation_id="updateListingInventory",
        method="PUT",
        path_template="/listings/{listing_id}/inventory",
        description=(
            "Replace the full low-level inventory document for a listing. This is a compatibility escape hatch, not the core Botique production control surface."
        ),
        path_params=("listing_id",),
        body_encoding=BodyEncoding.JSON,
        required_body_fields=("products",),
        scopes=("listings_w",),
        notes=(
            "For Botique owner agents, queue_production is the truthful way to plan future stocked supply. Direct inventory replacement is lower-level and easier to misuse.",
        ),
        parameters_schema=object_schema(
            properties={
                "listing_id": LISTING_ID_SCHEMA,
                "products": array_schema(
                    description="Complete inventory products array required by the compatibility contract.",
                    items=object_schema(
                        properties={
                            "sku": string_schema(description="Inventory SKU.", min_length=1),
                            "property_values": array_schema(
                                description="Variant property values.",
                                items=object_schema(
                                    properties={
                                        "property_id": integer_schema(description="Property id."),
                                        "value": string_schema(description="Property value.", min_length=1),
                                    },
                                    required=("property_id", "value"),
                                    additional_properties=False,
                                ),
                            ),
                            "offerings": array_schema(
                                description="Sellable offerings for this product.",
                                items=object_schema(
                                    properties={
                                        "offering_id": integer_schema(description="Optional offering id.", minimum=0),
                                        "price": number_schema(description="Offering price.", minimum=0),
                                        "quantity": integer_schema(
                                            description="Finished units represented by this offering.",
                                            minimum=0,
                                        ),
                                        "is_enabled": boolean_schema(
                                            description="Whether buyers can purchase this offering."
                                        ),
                                    },
                                    required=("price", "quantity", "is_enabled"),
                                    additional_properties=False,
                                ),
                            ),
                        },
                        required=("sku", "property_values", "offerings"),
                        additional_properties=False,
                    ),
                ),
                "price_on_property": array_schema(
                    description="Compatibility property ids that affect price.",
                    items={"type": "integer"},
                ),
                "quantity_on_property": array_schema(
                    description="Compatibility property ids that affect quantity.",
                    items={"type": "integer"},
                ),
                "sku_on_property": array_schema(
                    description="Compatibility property ids that affect SKU.",
                    items={"type": "integer"},
                ),
            },
            required=("listing_id", "products"),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_shop_info",
        operation_id="getShop",
        method="GET",
        path_template="/shops/{shop_id}",
        description=(
            "Read shop summary metrics, including shared production capacity per day, total backlog, reviews, and sales totals."
        ),
        path_params=("shop_id",),
        query_params=("includes",),
        scopes=("shops_r",),
        parameters_schema=object_schema(
            properties={"shop_id": SHOP_ID_SCHEMA},
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="update_shop",
        operation_id="updateShop",
        method="PUT",
        path_template="/shops/{shop_id}",
        description=(
            "Update storefront copy such as title, announcement, or sale message. This can affect presentation, but it does not change inventory, backlog, or production capacity."
        ),
        path_params=("shop_id",),
        body_encoding=BodyEncoding.FORM,
        scopes=("shops_r", "shops_w"),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "title": string_schema(description="Updated shop title.", min_length=1),
                "announcement": string_schema(description="Shop announcement shown to buyers."),
                "sale_message": string_schema(description="Short sale or fulfillment message shown to buyers."),
            },
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_orders",
        operation_id="getShopReceipts",
        method="GET",
        path_template="/shops/{shop_id}/receipts",
        description=(
            "Read your shop's orders. Stocked listing orders usually fulfill immediately from inventory; made-to-order orders stay in a paid backlog until production finishes."
        ),
        path_params=("shop_id",),
        query_params=(
            "limit",
            "offset",
            "was_paid",
            "was_shipped",
            "was_delivered",
            "min_created",
            "max_created",
            "min_last_modified",
            "max_last_modified",
            "sort_on",
            "sort_order",
        ),
        scopes=("transactions_r",),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "limit": LIMIT_SCHEMA,
                "offset": OFFSET_SCHEMA,
                "was_paid": boolean_schema(description="Optional filter for paid orders."),
                "was_shipped": boolean_schema(description="Optional filter for shipped orders."),
                "was_delivered": boolean_schema(description="Optional filter for delivered orders."),
                "sort_on": string_schema(
                    description="Field used to sort receipts.",
                    enum=("created", "updated", "total_price"),
                ),
                "sort_order": string_schema(
                    description="Sort direction.",
                    enum=("asc", "desc"),
                ),
                "min_created": string_schema(
                    description="Optional ISO timestamp or unix time lower bound for order creation.",
                    min_length=1,
                ),
                "max_created": string_schema(
                    description="Optional ISO timestamp or unix time upper bound for order creation.",
                    min_length=1,
                ),
                "min_last_modified": string_schema(
                    description="Optional ISO timestamp or unix time lower bound for order updates.",
                    min_length=1,
                ),
                "max_last_modified": string_schema(
                    description="Optional ISO timestamp or unix time upper bound for order updates.",
                    min_length=1,
                ),
            },
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_order_details",
        operation_id="getShopReceipt",
        method="GET",
        path_template="/shops/{shop_id}/receipts/{receipt_id}",
        description=(
            "Inspect one order in detail, including whether it is still waiting on made-to-order production or already fulfilled."
        ),
        path_params=("shop_id", "receipt_id"),
        query_params=("includes",),
        scopes=("transactions_r",),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "receipt_id": RECEIPT_ID_SCHEMA,
            },
            required=("shop_id", "receipt_id"),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_payments",
        operation_id="getPayments",
        method="GET",
        path_template="/shops/{shop_id}/payments",
        description=(
            "Read posted payments for your shop. This is a read-only financial view of cash that has actually posted, not pending future production value."
        ),
        path_params=("shop_id",),
        scopes=("transactions_r",),
        parameters_schema=object_schema(
            properties={"shop_id": SHOP_ID_SCHEMA},
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_reviews",
        operation_id="getReviewsByShop",
        method="GET",
        path_template="/shops/{shop_id}/reviews",
        description=(
            "Read shop reviews. Review text and ratings reflect realized customer experience, including whether lead times and fulfillment matched expectations."
        ),
        path_params=("shop_id",),
        query_params=("listing_id", "limit", "offset"),
        scopes=("transactions_r",),
        notes=(
            "The exact shop reviews resource path is inferred from Etsy's operation naming and tutorial references because the reference SPA does not expose a static path in crawlable HTML.",
        ),
        parameters_schema=object_schema(
            properties={
                "shop_id": SHOP_ID_SCHEMA,
                "listing_id": LISTING_ID_SCHEMA,
                "limit": LIMIT_SCHEMA,
                "offset": OFFSET_SCHEMA,
            },
            required=("shop_id",),
            additional_properties=False,
        ),
    ),
    EndpointSpec(
        tool_name="get_taxonomy_nodes",
        operation_id="getSellerTaxonomyNodes",
        method="GET",
        path_template="/seller-taxonomy/nodes",
        description=(
            "Read seller taxonomy nodes for category placement. Good taxonomy choices improve marketplace relevance and competitive comparisons."
        ),
        query_params=("taxonomy_id",),
        scopes=(),
        notes=(
            "The seller taxonomy resource path is inferred from Etsy's operation naming and tutorial references because the reference SPA does not expose a static path in crawlable HTML.",
        ),
        parameters_schema=object_schema(
            properties={
                "taxonomy_id": integer_schema(
                    description="Optional taxonomy branch root to expand.",
                    minimum=1,
                )
            },
            additional_properties=False,
        ),
    ),
)


CORE_TOOL_INDEX = {spec.tool_name: spec for spec in CORE_TOOL_SPECS}
