from __future__ import annotations

from dataclasses import dataclass

from seller_core.client import SellerCoreClient

from .briefing import MorningBriefing
from .events import EventLog, InMemoryEventLog
from .loop import DailyLoopConfig, DayRunResult, SingleShopDailyLoop
from .memory import AgentMemoryStore, InMemoryAgentMemory
from .providers import (
    MistralProviderConfig,
    MistralToolCallingProvider,
    ProviderPolicyConfig,
    ToolCallingAgentPolicy,
    ToolCallingProvider,
)
from .tools import build_owner_agent_tool_registry


@dataclass(frozen=True, slots=True)
class OwnerAgentRunnerConfig:
    max_turns: int = 6


class OwnerAgentRunner:
    def __init__(
        self,
        *,
        provider: ToolCallingProvider,
        seller_client: SellerCoreClient,
        memory: AgentMemoryStore | None = None,
        event_log: EventLog | None = None,
        config: OwnerAgentRunnerConfig | None = None,
        policy_config: ProviderPolicyConfig | None = None,
    ) -> None:
        self.memory = memory or InMemoryAgentMemory()
        self.event_log = event_log or InMemoryEventLog()
        self.config = config or OwnerAgentRunnerConfig()
        self.tool_registry = build_owner_agent_tool_registry(
            seller_client,
            memory=self.memory,
        )
        self.policy = ToolCallingAgentPolicy(
            provider,
            config=policy_config,
        )
        self.loop = SingleShopDailyLoop(
            tool_registry=self.tool_registry,
            event_log=self.event_log,
            config=DailyLoopConfig(max_turns=self.config.max_turns),
        )

    def run_day(self, briefing: MorningBriefing) -> DayRunResult:
        return self.loop.run_day(briefing=briefing, policy=self.policy)


def build_default_owner_agent_runner(
    *,
    max_turns: int = 6,
    base_url: str | None = None,
    api_key: str | None = None,
    bearer_token: str | None = None,
    timeout_seconds: float | None = None,
    mistral_api_key: str | None = None,
    mistral_model: str | None = None,
    mistral_temperature: float | None = None,
    mistral_top_p: float | None = None,
    memory: AgentMemoryStore | None = None,
    event_log: EventLog | None = None,
    policy_config: ProviderPolicyConfig | None = None,
) -> OwnerAgentRunner:
    seller_client = SellerCoreClient.from_env(
        base_url=base_url,
        api_key=api_key,
        bearer_token=bearer_token,
        timeout_seconds=timeout_seconds,
    )
    provider = MistralToolCallingProvider(
        MistralProviderConfig.from_env(
            api_key=mistral_api_key,
            model=mistral_model,
            temperature=mistral_temperature,
            top_p=mistral_top_p,
        )
    )
    return OwnerAgentRunner(
        provider=provider,
        seller_client=seller_client,
        memory=memory,
        event_log=event_log,
        config=OwnerAgentRunnerConfig(max_turns=max_turns),
        policy_config=policy_config,
    )
