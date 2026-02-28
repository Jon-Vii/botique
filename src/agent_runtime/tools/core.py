from __future__ import annotations

from typing import Iterable

from seller_core.client import SellerCoreClient

from .registry import AgentToolRegistry, ToolManifestEntry, ToolSurface


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


def register_seller_core_tools(
    registry: AgentToolRegistry,
    client: SellerCoreClient,
    *,
    tool_names: Iterable[str] = DEFAULT_OWNER_AGENT_CORE_TOOLS,
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
                operation_id=item["operation_id"],
                path_params=tuple(item["path_params"]),
                query_params=tuple(item["query_params"]),
                required_body_fields=tuple(item["required_body_fields"]),
                body_encoding=item["body_encoding"],
                scopes=tuple(item["scopes"]),
                notes=tuple(item["notes"]),
            ),
            lambda arguments, *, seller_client=client, name=tool_name: seller_client.call(
                name, arguments
            ),
        )

    return registry
