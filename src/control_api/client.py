from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Mapping

from seller_core.models import BodyEncoding, JSONValue, RequestPlan
from seller_core.transport import HttpTransport

ControlWorldState = dict[str, JSONValue]


@dataclass(frozen=True, slots=True)
class SimulationDay:
    day: int
    date: str
    advanced_at: str | None = None


@dataclass(frozen=True, slots=True)
class MarketTrend:
    trend_id: str
    label: str
    taxonomy_id: int | None
    tags: tuple[str, ...] = ()
    demand_multiplier: float = 1.0


@dataclass(frozen=True, slots=True)
class TrendState:
    generated_at: str
    baseline_multiplier: float
    active_trends: tuple[MarketTrend, ...] = ()


@dataclass(frozen=True, slots=True)
class TaxonomyMarketSnapshot:
    taxonomy_id: int
    listing_count: int
    average_price: float
    demand_multiplier: float


@dataclass(frozen=True, slots=True)
class MarketSnapshot:
    generated_at: str
    active_listing_count: int
    active_shop_count: int
    average_active_price: float
    taxonomy: tuple[TaxonomyMarketSnapshot, ...] = ()


@dataclass(frozen=True, slots=True)
class GlobalMarketState:
    current_day: SimulationDay
    market_snapshot: MarketSnapshot
    trend_state: TrendState


@dataclass(frozen=True, slots=True)
class AdvanceDayStep:
    name: str
    description: str


@dataclass(frozen=True, slots=True)
class AdvanceDayResult:
    previous_day: SimulationDay
    current_day: SimulationDay
    market_snapshot: MarketSnapshot
    trend_state: TrendState
    steps: tuple[AdvanceDayStep, ...] = ()


@dataclass(frozen=True, slots=True)
class ControlApiConfig:
    base_url: str
    api_key: str | None = None
    bearer_token: str | None = None
    timeout_seconds: float = 30.0
    extra_headers: Mapping[str, str] = field(default_factory=dict)


def _format_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("Bearer "):
        return value
    return f"Bearer {value}"


def _resolve_control_base_url(
    *,
    base_url: str | None,
    core_base_url: str | None,
    env: Mapping[str, str | None],
) -> str | None:
    explicit = base_url or env.get("BOTIQUE_CONTROL_BASE_URL")
    if explicit:
        return explicit.rstrip("/")

    candidate = core_base_url or env.get("BOTIQUE_CORE_BASE_URL")
    if not candidate:
        return None

    normalized = candidate.rstrip("/")
    if normalized.endswith("/v3/application"):
        normalized = normalized[: -len("/v3/application")]
    return f"{normalized}/control"


class ControlApiClient:
    def __init__(
        self,
        config: ControlApiConfig,
        transport: HttpTransport | None = None,
    ) -> None:
        self.config = config
        self.transport = transport or HttpTransport(timeout_seconds=config.timeout_seconds)

    @classmethod
    def maybe_from_env(
        cls,
        *,
        base_url: str | None = None,
        core_base_url: str | None = None,
        api_key: str | None = None,
        bearer_token: str | None = None,
        timeout_seconds: float | None = None,
        extra_headers: Mapping[str, str] | None = None,
        env: Mapping[str, str | None] | None = None,
    ) -> ControlApiClient | None:
        active_env = env or os.environ
        resolved_base_url = _resolve_control_base_url(
            base_url=base_url,
            core_base_url=core_base_url,
            env=active_env,
        )
        if resolved_base_url is None:
            return None

        configured_timeout = timeout_seconds
        if configured_timeout is None:
            raw_timeout = active_env.get("BOTIQUE_CONTROL_TIMEOUT_SECONDS") or active_env.get(
                "BOTIQUE_CORE_TIMEOUT_SECONDS"
            )
            configured_timeout = 30.0 if raw_timeout is None else float(raw_timeout)

        config = ControlApiConfig(
            base_url=resolved_base_url,
            api_key=(
                api_key
                or active_env.get("BOTIQUE_CONTROL_API_KEY")
                or active_env.get("BOTIQUE_CORE_API_KEY")
            ),
            bearer_token=(
                bearer_token
                or active_env.get("BOTIQUE_CONTROL_BEARER_TOKEN")
                or active_env.get("BOTIQUE_CORE_BEARER_TOKEN")
            ),
            timeout_seconds=configured_timeout,
            extra_headers=extra_headers or {},
        )
        return cls(config=config)

    def get_global_market_state(self) -> GlobalMarketState:
        return GlobalMarketState(
            current_day=_parse_simulation_day(
                self._request("get_current_day", "GET", "/simulation/day")
            ),
            market_snapshot=_parse_market_snapshot(
                self._request(
                    "get_market_snapshot",
                    "GET",
                    "/simulation/market-snapshot",
                )
            ),
            trend_state=_parse_trend_state(
                self._request(
                    "get_trend_state",
                    "GET",
                    "/simulation/trend-state",
                )
            ),
        )

    def get_world_state(self) -> ControlWorldState:
        return _parse_control_world_state(
            self._request("get_world_state", "GET", "/world-state")
        )

    def replace_world_state(self, state: ControlWorldState) -> ControlWorldState:
        return _parse_control_world_state(
            self._request(
                "replace_world_state",
                "POST",
                "/world-state",
                body=state,
                body_encoding=BodyEncoding.JSON,
            )
        )

    def advance_day(self) -> AdvanceDayResult:
        payload = self._request("advance_day", "POST", "/simulation/advance-day")
        return _parse_advance_day_result(payload)

    def reset_world(self) -> None:
        self._request("reset_world", "POST", "/world/reset")

    def _request(
        self,
        endpoint_name: str,
        method: str,
        path: str,
        body: Any = None,
        body_encoding: BodyEncoding = BodyEncoding.NONE,
    ) -> Any:
        response = self.transport.send(
            RequestPlan(
                tool_name=endpoint_name,
                operation_id=endpoint_name,
                method=method,
                url=f"{self.config.base_url}{path}",
                headers=self._build_headers(),
                body=body,
                body_encoding=body_encoding,
            )
        )
        return response.data

    def _build_headers(self) -> dict[str, str]:
        headers = dict(self.config.extra_headers)
        if self.config.api_key:
            headers.setdefault("x-api-key", self.config.api_key)
        formatted_token = _format_bearer_token(self.config.bearer_token)
        if formatted_token:
            headers.setdefault("Authorization", formatted_token)
        headers.setdefault("Accept", "application/json")
        return headers


def _parse_global_market_state(payload: Any) -> GlobalMarketState:
    value = _mapping(payload, "global_market_state")
    return GlobalMarketState(
        current_day=_parse_simulation_day(value.get("current_day")),
        market_snapshot=_parse_market_snapshot(value.get("market_snapshot")),
        trend_state=_parse_trend_state(value.get("trend_state")),
    )


def _parse_control_world_state(payload: Any) -> ControlWorldState:
    return dict(_mapping(payload, "world_state"))


def _parse_advance_day_result(payload: Any) -> AdvanceDayResult:
    value = _mapping(payload, "advance_day")
    market_snapshot_payload = value.get("market_snapshot")
    trend_state_payload = value.get("trend_state")
    if market_snapshot_payload is None or trend_state_payload is None:
        world = _mapping(value.get("world"), "advance_day.world")
        simulation = _mapping(world.get("simulation"), "advance_day.world.simulation")
        market_snapshot_payload = simulation.get("market_snapshot")
        trend_state_payload = simulation.get("trend_state")
    return AdvanceDayResult(
        previous_day=_parse_simulation_day(value.get("previous_day")),
        current_day=_parse_simulation_day(value.get("current_day")),
        market_snapshot=_parse_market_snapshot(market_snapshot_payload),
        trend_state=_parse_trend_state(trend_state_payload),
        steps=tuple(_parse_advance_day_step(item) for item in value.get("steps", ())),
    )


def _parse_advance_day_step(payload: Any) -> AdvanceDayStep:
    value = _mapping(payload, "advance_day_step")
    return AdvanceDayStep(
        name=str(value["name"]),
        description=str(value["description"]),
    )


def _parse_simulation_day(payload: Any) -> SimulationDay:
    value = _mapping(payload, "simulation_day")
    return SimulationDay(
        day=int(value["day"]),
        date=str(value["date"]),
        advanced_at=None if value.get("advanced_at") is None else str(value["advanced_at"]),
    )


def _parse_market_trend(payload: Any) -> MarketTrend:
    value = _mapping(payload, "market_trend")
    taxonomy_id = value.get("taxonomy_id")
    return MarketTrend(
        trend_id=str(value["trend_id"]),
        label=str(value["label"]),
        taxonomy_id=None if taxonomy_id is None else int(taxonomy_id),
        tags=tuple(str(item) for item in value.get("tags", ())),
        demand_multiplier=float(value.get("demand_multiplier", 1.0)),
    )


def _parse_trend_state(payload: Any) -> TrendState:
    value = _mapping(payload, "trend_state")
    return TrendState(
        generated_at=str(value["generated_at"]),
        baseline_multiplier=float(value.get("baseline_multiplier", 1.0)),
        active_trends=tuple(
            _parse_market_trend(item) for item in value.get("active_trends", ())
        ),
    )


def _parse_taxonomy_market_snapshot(payload: Any) -> TaxonomyMarketSnapshot:
    value = _mapping(payload, "taxonomy_market_snapshot")
    return TaxonomyMarketSnapshot(
        taxonomy_id=int(value["taxonomy_id"]),
        listing_count=int(value.get("listing_count", 0)),
        average_price=float(value.get("average_price", 0.0)),
        demand_multiplier=float(value.get("demand_multiplier", 1.0)),
    )


def _parse_market_snapshot(payload: Any) -> MarketSnapshot:
    value = _mapping(payload, "market_snapshot")
    return MarketSnapshot(
        generated_at=str(value["generated_at"]),
        active_listing_count=int(value.get("active_listing_count", 0)),
        active_shop_count=int(value.get("active_shop_count", 0)),
        average_active_price=float(value.get("average_active_price", 0.0)),
        taxonomy=tuple(
            _parse_taxonomy_market_snapshot(item) for item in value.get("taxonomy", ())
        ),
    )


def _mapping(value: Any, field_name: str) -> Mapping[str, JSONValue]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field_name} must be a JSON object.")
    return value
