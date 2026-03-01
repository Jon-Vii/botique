from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence, TypeVar
from uuid import uuid4

from control_api import AdvanceDayResult, ControlApiClient
from seller_core.client import SellerCoreClient

from .briefing import ShopStateSnapshot
from .events import InMemoryEventLog
from .memory import InMemoryAgentMemory, ReminderStatus, ShopId
from .providers import (
    DEFAULT_SYSTEM_PROMPT,
    MistralProviderConfig,
    MistralToolCallingProvider,
    ProviderPolicyConfig,
)
from .runner import LiveDayRunResult, OwnerAgentRunner, OwnerAgentRunnerConfig


T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class TournamentEntrant:
    entrant_id: str
    display_name: str
    provider: str
    model: str

    def __post_init__(self) -> None:
        if not self.entrant_id.strip():
            raise ValueError("entrant_id must be non-empty.")
        if not self.display_name.strip():
            raise ValueError("display_name must be non-empty.")
        if not self.provider.strip():
            raise ValueError("provider must be non-empty.")
        if not self.model.strip():
            raise ValueError("model must be non-empty.")


@dataclass(frozen=True, slots=True)
class TournamentEntrantConfig:
    entrant: TournamentEntrant
    api_key: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    system_prompt: str | None = None


@dataclass(frozen=True, slots=True)
class TournamentConfig:
    days_per_round: int
    rounds: int = 1
    rotate_shop_assignments: bool = True
    rotate_turn_order: bool = True

    def __post_init__(self) -> None:
        if self.days_per_round < 1:
            raise ValueError("days_per_round must be at least 1.")
        if self.rounds < 1:
            raise ValueError("rounds must be at least 1.")


@dataclass(frozen=True, slots=True)
class TournamentShopAssignment:
    entrant_id: str
    shop_id: ShopId


@dataclass(frozen=True, slots=True)
class TournamentEntrantDayResult:
    entrant: TournamentEntrant
    live_day: LiveDayRunResult


@dataclass(frozen=True, slots=True)
class TournamentRoundDayResult:
    day: int
    simulation_date: str
    turn_order: tuple[str, ...]
    entrant_results: tuple[TournamentEntrantDayResult, ...]
    advancement: AdvanceDayResult | None = None


@dataclass(frozen=True, slots=True)
class TournamentScorecard:
    primary_score_name: str
    primary_score: float
    available_cash: float
    pending_cash: float
    total_sales_count: int
    review_average: float | None
    review_count: int
    active_listing_count: int
    draft_listing_count: int
    workspace_entries_written: int
    open_reminders: int
    final_day: int
    final_simulation_date: str


@dataclass(frozen=True, slots=True)
class TournamentStanding:
    rank: int
    entrant: TournamentEntrant
    shop_id: ShopId
    shop_name: str
    round_index: int
    scorecard: TournamentScorecard


@dataclass(frozen=True, slots=True)
class TournamentAggregateStanding:
    rank: int
    entrant: TournamentEntrant
    rounds_played: int
    primary_score_name: str
    average_primary_score: float
    round_scores: tuple[float, ...]
    round_wins: int
    average_total_sales_count: float
    average_review_average: float | None


@dataclass(frozen=True, slots=True)
class TournamentRoundResult:
    round_index: int
    run_id: str
    shop_assignments: tuple[TournamentShopAssignment, ...]
    days: tuple[TournamentRoundDayResult, ...]
    standings: tuple[TournamentStanding, ...]


@dataclass(frozen=True, slots=True)
class TournamentResult:
    run_id: str
    days_per_round: int
    round_count: int
    entrants: tuple[TournamentEntrant, ...]
    shop_ids: tuple[ShopId, ...]
    rounds: tuple[TournamentRoundResult, ...]
    standings: tuple[TournamentAggregateStanding, ...]


class TournamentEntrantRunnerFactory(Protocol):
    def __call__(self, entrant: TournamentEntrantConfig) -> OwnerAgentRunner: ...


class ArenaTournamentRunner:
    def __init__(
        self,
        *,
        control_client: ControlApiClient,
        entrant_runner_factory: TournamentEntrantRunnerFactory,
        config: TournamentConfig,
    ) -> None:
        self.control_client = control_client
        self.entrant_runner_factory = entrant_runner_factory
        self.config = config

    def run(
        self,
        *,
        entrants: Sequence[TournamentEntrantConfig],
        shop_ids: Sequence[ShopId],
        run_id: str | None = None,
    ) -> TournamentResult:
        if len(entrants) < 2:
            raise ValueError("Tournament mode requires at least two entrants.")
        if len(shop_ids) != len(entrants):
            raise ValueError("Tournament mode requires exactly one shop id per entrant.")

        normalized_entrants = tuple(entrants)
        normalized_shop_ids = tuple(shop_ids)
        self._validate_unique_ids(normalized_entrants, normalized_shop_ids)

        active_run_id = run_id or f"tournament_{uuid4().hex[:12]}"
        initial_world_state = self.control_client.get_world_state()
        rounds: list[TournamentRoundResult] = []
        standings_by_entrant: dict[str, list[TournamentStanding]] = {
            entrant.entrant.entrant_id: [] for entrant in normalized_entrants
        }

        for round_index in range(1, self.config.rounds + 1):
            if round_index > 1:
                self.control_client.replace_world_state(initial_world_state)

            round_run_id = f"{active_run_id}_round_{round_index:02d}"
            assignments = self._build_shop_assignments(
                entrants=normalized_entrants,
                shop_ids=normalized_shop_ids,
                round_index=round_index,
            )
            runners = {
                entrant.entrant.entrant_id: self.entrant_runner_factory(entrant)
                for entrant in normalized_entrants
            }
            previous_states: dict[str, ShopStateSnapshot | None] = {
                entrant.entrant.entrant_id: None for entrant in normalized_entrants
            }
            round_days: list[TournamentRoundDayResult] = []

            for day_offset in range(self.config.days_per_round):
                ordered_entrants = self._build_turn_order(
                    entrants=normalized_entrants,
                    day_offset=day_offset,
                )
                entrant_results: list[TournamentEntrantDayResult] = []

                for entrant in ordered_entrants:
                    entrant_id = entrant.entrant.entrant_id
                    live_day = runners[entrant_id].run_live_day(
                        shop_id=assignments[entrant_id],
                        run_id=round_run_id,
                        previous_shop_state=previous_states[entrant_id],
                        advance_day=False,
                    )
                    previous_states[entrant_id] = live_day.state_after
                    entrant_results.append(
                        TournamentEntrantDayResult(
                            entrant=entrant.entrant,
                            live_day=live_day,
                        )
                    )

                advancement = None
                if day_offset < self.config.days_per_round - 1:
                    advancement = self.control_client.advance_day(
                        controlled_shop_ids=tuple(
                            int(shop_id) for shop_id in assignments.values()
                        )
                    )

                first_result = entrant_results[0].live_day
                round_days.append(
                    TournamentRoundDayResult(
                        day=first_result.day,
                        simulation_date=first_result.market_state_before.current_day.date,
                        turn_order=tuple(
                            entrant.entrant.entrant_id for entrant in ordered_entrants
                        ),
                        entrant_results=tuple(entrant_results),
                        advancement=advancement,
                    )
                )

            round_standings = self._build_round_standings(
                round_index=round_index,
                entrants=normalized_entrants,
                assignments=assignments,
                round_days=tuple(round_days),
                runners=runners,
            )
            rounds.append(
                TournamentRoundResult(
                    round_index=round_index,
                    run_id=round_run_id,
                    shop_assignments=tuple(
                        TournamentShopAssignment(
                            entrant_id=entrant.entrant.entrant_id,
                            shop_id=assignments[entrant.entrant.entrant_id],
                        )
                        for entrant in normalized_entrants
                    ),
                    days=tuple(round_days),
                    standings=round_standings,
                )
            )
            for standing in round_standings:
                standings_by_entrant[standing.entrant.entrant_id].append(standing)

        return TournamentResult(
            run_id=active_run_id,
            days_per_round=self.config.days_per_round,
            round_count=self.config.rounds,
            entrants=tuple(entrant.entrant for entrant in normalized_entrants),
            shop_ids=normalized_shop_ids,
            rounds=tuple(rounds),
            standings=self._build_aggregate_standings(
                entrants=normalized_entrants,
                standings_by_entrant=standings_by_entrant,
            ),
        )

    @staticmethod
    def _validate_unique_ids(
        entrants: Sequence[TournamentEntrantConfig],
        shop_ids: Sequence[ShopId],
    ) -> None:
        entrant_ids = [entrant.entrant.entrant_id for entrant in entrants]
        if len(set(entrant_ids)) != len(entrant_ids):
            raise ValueError("Tournament entrant ids must be unique.")
        if len(set(shop_ids)) != len(shop_ids):
            raise ValueError("Tournament shop ids must be unique.")

    def _build_shop_assignments(
        self,
        *,
        entrants: Sequence[TournamentEntrantConfig],
        shop_ids: Sequence[ShopId],
        round_index: int,
    ) -> dict[str, ShopId]:
        offset = 0
        if self.config.rotate_shop_assignments and len(shop_ids) > 1:
            offset = (round_index - 1) % len(shop_ids)
        rotated_shop_ids = _rotate_values(shop_ids, offset)
        return {
            entrant.entrant.entrant_id: rotated_shop_ids[index]
            for index, entrant in enumerate(entrants)
        }

    def _build_turn_order(
        self,
        *,
        entrants: Sequence[TournamentEntrantConfig],
        day_offset: int,
    ) -> tuple[TournamentEntrantConfig, ...]:
        if not self.config.rotate_turn_order or len(entrants) <= 1:
            return tuple(entrants)
        return _rotate_values(tuple(entrants), day_offset % len(entrants))

    @staticmethod
    def _build_round_standings(
        *,
        round_index: int,
        entrants: Sequence[TournamentEntrantConfig],
        assignments: Mapping[str, ShopId],
        round_days: tuple[TournamentRoundDayResult, ...],
        runners: Mapping[str, OwnerAgentRunner],
    ) -> tuple[TournamentStanding, ...]:
        final_results = _latest_results_by_entrant(round_days)
        unsorted: list[TournamentStanding] = []

        for entrant in entrants:
            entrant_id = entrant.entrant.entrant_id
            final_result = final_results[entrant_id]
            scorecard = _build_scorecard(
                shop_state=final_result.state_after,
                runner=runners[entrant_id],
            )
            unsorted.append(
                TournamentStanding(
                    rank=0,
                    entrant=entrant.entrant,
                    shop_id=assignments[entrant_id],
                    shop_name=final_result.state_after.shop_name,
                    round_index=round_index,
                    scorecard=scorecard,
                )
            )

        ordered = sorted(
            unsorted,
            key=lambda standing: (
                -standing.scorecard.primary_score,
                -standing.scorecard.total_sales_count,
                -(standing.scorecard.review_average or 0.0),
                -standing.scorecard.active_listing_count,
                standing.entrant.entrant_id,
            ),
        )
        return tuple(
            TournamentStanding(
                rank=index + 1,
                entrant=standing.entrant,
                shop_id=standing.shop_id,
                shop_name=standing.shop_name,
                round_index=standing.round_index,
                scorecard=standing.scorecard,
            )
            for index, standing in enumerate(ordered)
        )

    @staticmethod
    def _build_aggregate_standings(
        *,
        entrants: Sequence[TournamentEntrantConfig],
        standings_by_entrant: Mapping[str, Sequence[TournamentStanding]],
    ) -> tuple[TournamentAggregateStanding, ...]:
        unsorted: list[TournamentAggregateStanding] = []

        for entrant in entrants:
            entrant_id = entrant.entrant.entrant_id
            entrant_rounds = tuple(standings_by_entrant[entrant_id])
            review_values = [
                standing.scorecard.review_average
                for standing in entrant_rounds
                if standing.scorecard.review_average is not None
            ]
            unsorted.append(
                TournamentAggregateStanding(
                    rank=0,
                    entrant=entrant.entrant,
                    rounds_played=len(entrant_rounds),
                    primary_score_name=entrant_rounds[0].scorecard.primary_score_name,
                    average_primary_score=round(
                        sum(
                            standing.scorecard.primary_score
                            for standing in entrant_rounds
                        )
                        / len(entrant_rounds),
                        2,
                    ),
                    round_scores=tuple(
                        standing.scorecard.primary_score for standing in entrant_rounds
                    ),
                    round_wins=sum(1 for standing in entrant_rounds if standing.rank == 1),
                    average_total_sales_count=round(
                        sum(
                            standing.scorecard.total_sales_count
                            for standing in entrant_rounds
                        )
                        / len(entrant_rounds),
                        2,
                    ),
                    average_review_average=(
                        round(sum(review_values) / len(review_values), 2)
                        if review_values
                        else None
                    ),
                )
            )

        ordered = sorted(
            unsorted,
            key=lambda standing: (
                -standing.average_primary_score,
                -standing.round_wins,
                -standing.average_total_sales_count,
                -(standing.average_review_average or 0.0),
                standing.entrant.entrant_id,
            ),
        )
        return tuple(
            TournamentAggregateStanding(
                rank=index + 1,
                entrant=standing.entrant,
                rounds_played=standing.rounds_played,
                primary_score_name=standing.primary_score_name,
                average_primary_score=standing.average_primary_score,
                round_scores=standing.round_scores,
                round_wins=standing.round_wins,
                average_total_sales_count=standing.average_total_sales_count,
                average_review_average=standing.average_review_average,
            )
            for index, standing in enumerate(ordered)
        )


def load_tournament_entrants_from_payload(
    payload: Any,
    *,
    default_provider: str = "mistral",
    default_model: str | None = None,
    default_temperature: float | None = None,
    default_top_p: float | None = None,
) -> tuple[TournamentEntrantConfig, ...]:
    raw_entrants = payload
    if isinstance(payload, Mapping):
        raw_entrants = payload.get("entrants")
        if raw_entrants is None:
            raise ValueError("Tournament entrant payload must include an 'entrants' array.")

    if not isinstance(raw_entrants, list):
        raise ValueError("Tournament entrants must decode to an array.")

    entrants: list[TournamentEntrantConfig] = []
    for index, raw_entrant in enumerate(raw_entrants):
        value = _mapping(raw_entrant, f"entrant[{index}]")
        entrant_id = str(value["entrant_id"]).strip()
        display_name = str(value.get("display_name") or entrant_id).strip()
        provider = str(value.get("provider") or default_provider).strip()
        model = str(
            value.get("model")
            or default_model
            or "mistral-medium-latest"
        ).strip()
        entrants.append(
            TournamentEntrantConfig(
                entrant=TournamentEntrant(
                    entrant_id=entrant_id,
                    display_name=display_name,
                    provider=provider,
                    model=model,
                ),
                api_key=_optional_string(value.get("api_key")),
                temperature=_optional_float(
                    value.get("temperature"), default_temperature
                ),
                top_p=_optional_float(value.get("top_p"), default_top_p),
                system_prompt=_optional_string(value.get("system_prompt")),
            )
        )

    return tuple(entrants)


def build_default_tournament_runner(
    *,
    days_per_round: int,
    rounds: int = 1,
    turns_per_day: int = 5,
    base_url: str | None = None,
    control_base_url: str | None = None,
    api_key: str | None = None,
    bearer_token: str | None = None,
    timeout_seconds: float | None = None,
    mistral_api_key: str | None = None,
    mistral_model: str | None = None,
    mistral_temperature: float | None = None,
    mistral_top_p: float | None = None,
    rotate_shop_assignments: bool = True,
    rotate_turn_order: bool = True,
) -> ArenaTournamentRunner:
    seller_client = SellerCoreClient.from_env(
        base_url=base_url,
        api_key=api_key,
        bearer_token=bearer_token,
        timeout_seconds=timeout_seconds,
    )
    control_client = ControlApiClient.maybe_from_env(
        base_url=control_base_url,
        core_base_url=base_url,
        api_key=api_key,
        bearer_token=bearer_token,
        timeout_seconds=timeout_seconds,
    )
    if control_client is None:
        raise ValueError("Tournament mode requires a configured control API client.")

    def entrant_runner_factory(entrant: TournamentEntrantConfig) -> OwnerAgentRunner:
        provider_name = entrant.entrant.provider.lower()
        if provider_name != "mistral":
            raise ValueError(
                f"Unsupported tournament provider {entrant.entrant.provider!r}. "
                "Only 'mistral' is currently implemented."
            )

        provider = MistralToolCallingProvider(
            MistralProviderConfig.from_env(
                api_key=entrant.api_key or mistral_api_key,
                model=entrant.entrant.model or mistral_model,
                temperature=(
                    entrant.temperature
                    if entrant.temperature is not None
                    else mistral_temperature
                ),
                top_p=entrant.top_p if entrant.top_p is not None else mistral_top_p,
            )
        )
        policy_config = ProviderPolicyConfig(
            system_prompt=entrant.system_prompt or DEFAULT_SYSTEM_PROMPT
        )
        return OwnerAgentRunner(
            provider=provider,
            seller_client=seller_client,
            control_client=control_client,
            memory=InMemoryAgentMemory(),
            event_log=InMemoryEventLog(),
            config=OwnerAgentRunnerConfig(turns_per_day=turns_per_day),
            policy_config=policy_config,
        )

    return ArenaTournamentRunner(
        control_client=control_client,
        entrant_runner_factory=entrant_runner_factory,
        config=TournamentConfig(
            days_per_round=days_per_round,
            rounds=rounds,
            rotate_shop_assignments=rotate_shop_assignments,
            rotate_turn_order=rotate_turn_order,
        ),
    )


def _build_scorecard(
    *,
    shop_state: ShopStateSnapshot,
    runner: OwnerAgentRunner,
) -> TournamentScorecard:
    available_cash = shop_state.balance_summary.available or 0.0
    pending_cash = shop_state.balance_summary.pending or 0.0
    workspace_entries_written = len(
        runner.memory.list_workspace_entries(shop_id=shop_state.shop_id)
    )
    open_reminders = len(
        runner.memory.list_reminders(
            shop_id=shop_state.shop_id,
            status=ReminderStatus.PENDING,
        )
    )
    return TournamentScorecard(
        primary_score_name="available_cash",
        primary_score=round(available_cash, 2),
        available_cash=round(available_cash, 2),
        pending_cash=round(pending_cash, 2),
        total_sales_count=shop_state.total_sales_count,
        review_average=shop_state.review_average,
        review_count=shop_state.review_count,
        active_listing_count=shop_state.active_listing_count,
        draft_listing_count=shop_state.draft_listing_count,
        workspace_entries_written=workspace_entries_written,
        open_reminders=open_reminders,
        final_day=shop_state.day,
        final_simulation_date=shop_state.simulation_date,
    )


def _latest_results_by_entrant(
    round_days: Sequence[TournamentRoundDayResult],
) -> dict[str, LiveDayRunResult]:
    latest: dict[str, LiveDayRunResult] = {}
    for day in round_days:
        for entrant_result in day.entrant_results:
            latest[entrant_result.entrant.entrant_id] = entrant_result.live_day
    return latest


def _rotate_values(values: Sequence[T], offset: int) -> tuple[T, ...]:
    if not values:
        return ()
    normalized_offset = offset % len(values)
    return tuple(values[normalized_offset:]) + tuple(values[:normalized_offset])


def _mapping(value: Any, field_name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field_name} must be a JSON object.")
    return value


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    resolved = str(value).strip()
    return resolved or None


def _optional_float(value: Any, default: float | None = None) -> float | None:
    if value is None:
        return default
    return float(value)
