from __future__ import annotations

from typing import Iterable

from seller_core.client import SellerCoreClient
from seller_core.models import JSONValue

from .registry import AgentToolRegistry, ToolBehavior, ToolManifestEntry, ToolSurface


DEFAULT_OWNER_AGENT_CORE_TOOLS: tuple[str, ...] = (
    "create_draft_listing",
    "update_listing",
    "delete_listing",
    "get_listing",
    "get_shop_listings",
    "search_marketplace",
    "get_shop_info",
    "update_shop",
    "get_orders",
    "get_order_details",
    "get_reviews",
    "get_taxonomy_nodes",
)

DEFAULT_OWNER_AGENT_INSPECT_TOOLS: tuple[str, ...] = (
    "get_listing",
    "get_shop_listings",
    "search_marketplace",
    "get_shop_info",
    "get_orders",
    "get_order_details",
    "get_reviews",
    "get_taxonomy_nodes",
)

DEFAULT_OWNER_AGENT_ACT_TOOLS: tuple[str, ...] = (
    "create_draft_listing",
    "update_listing",
    "delete_listing",
    "update_shop",
)

_TOOL_BEHAVIOR_BY_NAME = {
    **{tool_name: ToolBehavior.INSPECT for tool_name in DEFAULT_OWNER_AGENT_INSPECT_TOOLS},
    **{tool_name: ToolBehavior.ACT for tool_name in DEFAULT_OWNER_AGENT_ACT_TOOLS},
}


def _bound_shop_id(
    arguments: dict[str, object],
    *,
    shop_id: int | str | None,
    path_params: tuple[str, ...],
) -> dict[str, object]:
    if "shop_id" not in path_params:
        return arguments

    if shop_id is None:
        return arguments

    requested = arguments.get("shop_id")
    if requested is not None and requested != shop_id:
        raise ValueError(f"shop_id is bound to {shop_id!r} for this agent.")

    return {
        **arguments,
        "shop_id": shop_id,
    }


def _tool_parameters_schema(
    item: dict[str, object],
    *,
    shop_id: int | str | None,
) -> dict[str, JSONValue]:
    properties: dict[str, JSONValue] = {}
    visible_path_params = [field for field in item["path_params"] if not (field == "shop_id" and shop_id is not None)]

    for field_name in visible_path_params:
        properties[field_name] = _field_schema(
            field_name,
            description=f"Required path parameter `{field_name}`.",
        )

    for field_name in item["query_params"]:
        properties[field_name] = _field_schema(
            field_name,
            description=f"Optional query parameter `{field_name}`.",
        )

    for field_name in item["required_body_fields"]:
        properties[field_name] = _field_schema(
            field_name,
            description=f"Required request body field `{field_name}`.",
        )

    required_fields = visible_path_params + list(item["required_body_fields"])
    return {
        "type": "object",
        "properties": properties,
        "required": required_fields,
        "additionalProperties": True,
    }


def _field_schema(field_name: str, *, description: str) -> dict[str, JSONValue]:
    if field_name in {"shop_id", "listing_id", "receipt_id", "taxonomy_id", "limit", "offset", "quantity"}:
        return {"type": "integer", "description": description}
    if field_name in {"price", "min_price", "max_price"}:
        return {"type": "number", "description": description}
    if field_name in {"was_paid", "was_shipped", "was_delivered", "legacy"}:
        return {"type": "boolean", "description": description}
    if field_name == "sort_order":
        return {
            "type": "string",
            "enum": ["asc", "desc"],
            "description": description,
        }
    return {"type": "string", "description": description}


def register_seller_core_tools(
    registry: AgentToolRegistry,
    client: SellerCoreClient,
    *,
    tool_names: Iterable[str] = DEFAULT_OWNER_AGENT_CORE_TOOLS,
    shop_id: int | str | None = None,
) -> AgentToolRegistry:
    manifest_by_name = {
        item["tool_name"]: item
        for item in client.manifest()
    }

    for tool_name in tool_names:
        try:
            item = manifest_by_name[tool_name]
        except KeyError as exc:
            raise ValueError(f"seller_core does not expose tool {tool_name!r}.") from exc

        registry.register(
            ToolManifestEntry(
                name=item["tool_name"],
                description=item["description"],
                surface=ToolSurface.CORE,
                behavior=_TOOL_BEHAVIOR_BY_NAME.get(tool_name, ToolBehavior.INSPECT),
                operation_id=item["operation_id"],
                path_params=tuple(item["path_params"]),
                query_params=tuple(item["query_params"]),
                required_body_fields=tuple(item["required_body_fields"]),
                body_encoding=item["body_encoding"],
                scopes=tuple(item["scopes"]),
                notes=tuple(item["notes"]),
                parameters_schema=_tool_parameters_schema(item, shop_id=shop_id),
            ),
            lambda arguments, *, seller_client=client, name=tool_name, bound_shop_id=shop_id, path_params=tuple(item["path_params"]): seller_client.call(
                name,
                _bound_shop_id(
                    dict(arguments),
                    shop_id=bound_shop_id,
                    path_params=path_params,
                ),
            ),
        )

    return registry
