from __future__ import annotations

from seller_core.client import SellerCoreClient

from agent_runtime.memory import AgentMemoryStore, InMemoryAgentMemory

from .core import DEFAULT_OWNER_AGENT_CORE_TOOLS, register_seller_core_tools
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
) -> AgentToolRegistry:
    registry = AgentToolRegistry()
    register_seller_core_tools(registry, client)
    register_memory_tools(registry, memory or InMemoryAgentMemory())
    return registry


__all__ = [
    "AgentToolRegistry",
    "DEFAULT_OWNER_AGENT_CORE_TOOLS",
    "ToolExecutionResult",
    "ToolManifestEntry",
    "ToolNotFoundError",
    "ToolSurface",
    "build_owner_agent_tool_registry",
    "register_memory_tools",
    "register_seller_core_tools",
]
