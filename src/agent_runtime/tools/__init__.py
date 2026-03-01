from __future__ import annotations

from seller_core.client import SellerCoreClient

from agent_runtime.memory import AgentMemoryStore, InMemoryAgentMemory

from .core import (
    DEFAULT_OWNER_AGENT_CORE_TOOLS,
    DEFAULT_OWNER_AGENT_EXTENSION_TOOLS,
    DEFAULT_OWNER_AGENT_SELLER_TOOLS,
    register_seller_tools,
)
from .extensions import register_memory_tools
from .registry import (
    AgentToolRegistry,
    ToolExecutionResult,
    ToolManifestEntry,
    ToolNotFoundError,
    ToolSurface,
)


def build_owner_agent_tool_registry(
    client: SellerCoreClient,
    *,
    memory: AgentMemoryStore | None = None,
    shop_id: int | str | None = None,
) -> AgentToolRegistry:
    registry = AgentToolRegistry()
    register_seller_tools(registry, client, shop_id=shop_id)
    register_memory_tools(registry, memory or InMemoryAgentMemory(), shop_id=shop_id)
    return registry


__all__ = [
    "AgentToolRegistry",
    "DEFAULT_OWNER_AGENT_CORE_TOOLS",
    "DEFAULT_OWNER_AGENT_EXTENSION_TOOLS",
    "DEFAULT_OWNER_AGENT_SELLER_TOOLS",
    "ToolExecutionResult",
    "ToolManifestEntry",
    "ToolNotFoundError",
    "ToolSurface",
    "build_owner_agent_tool_registry",
    "register_memory_tools",
    "register_seller_tools",
]
