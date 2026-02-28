from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

from .memory import ReminderBackend, ReminderRecord, ShopId
from .serialization import jsonify


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_PRIORITIES_PROMPT = (
    "Choose the highest-leverage priorities for today, then use the available "
    "tools to inspect evidence, adjust the shop, and end the day once the plan is done."
)


@dataclass(frozen=True, slots=True)
class BalanceSummary:
    available: float | None
    pending: float | None = None
    currency_code: str = "USD"


@dataclass(frozen=True, slots=True)
class OrderSummary:
    order_count: int
    revenue: float
    average_order_value: float | None = None
    refunded_order_count: int = 0


@dataclass(frozen=True, slots=True)
class ListingPerformanceChange:
    listing_id: int
    title: str
    state: str
    views_delta: int = 0
    favorites_delta: int = 0
    orders_delta: int = 0
    revenue_delta: float = 0.0


@dataclass(frozen=True, slots=True)
class ReviewSummary:
    review_id: int | str
    listing_id: int | None
    rating: float
    excerpt: str
    buyer_name: str | None = None


@dataclass(frozen=True, slots=True)
class CustomerMessageSummary:
    message_id: int | str
    subject: str
    excerpt: str
    priority: str = "normal"


@dataclass(frozen=True, slots=True)
class MarketMovement:
    headline: str
    summary: str
    urgency: str = "watch"


@dataclass(frozen=True, slots=True)
class ObjectiveProgress:
    primary_objective: str
    metric_name: str
    current_value: float
    target_value: float | None = None
    supporting_diagnostics: tuple[str, ...] = ()
    status_summary: str = ""


@dataclass(frozen=True, slots=True)
class MorningBriefing:
    run_id: str
    shop_id: ShopId
    shop_name: str
    day: int
    generated_at: datetime = field(default_factory=_utcnow)
    balance_summary: BalanceSummary = field(default_factory=lambda: BalanceSummary(None))
    yesterday_orders: OrderSummary = field(default_factory=lambda: OrderSummary(0, 0.0))
    listing_changes: tuple[ListingPerformanceChange, ...] = ()
    new_reviews: tuple[ReviewSummary, ...] = ()
    new_customer_messages: tuple[CustomerMessageSummary, ...] = ()
    due_reminders: tuple[ReminderRecord, ...] = ()
    market_movements: tuple[MarketMovement, ...] = ()
    objective_progress: ObjectiveProgress = field(
        default_factory=lambda: ObjectiveProgress(
            primary_objective="Grow the shop sustainably.",
            metric_name="ending_balance",
            current_value=0.0,
            status_summary="No objective snapshot provided.",
        )
    )
    notes: tuple[str, ...] = ()
    priorities_prompt: str = DEFAULT_PRIORITIES_PROMPT

    def to_prompt_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]


class MorningBriefingBuilder:
    def __init__(self, reminders: ReminderBackend) -> None:
        self._reminders = reminders

    def build(
        self,
        *,
        run_id: str,
        shop_id: ShopId,
        shop_name: str,
        day: int,
        balance_summary: BalanceSummary,
        yesterday_orders: OrderSummary,
        objective_progress: ObjectiveProgress,
        listing_changes: Iterable[ListingPerformanceChange] = (),
        new_reviews: Iterable[ReviewSummary] = (),
        new_customer_messages: Iterable[CustomerMessageSummary] = (),
        market_movements: Iterable[MarketMovement] = (),
        due_reminders: Iterable[ReminderRecord] | None = None,
        notes: Iterable[str] = (),
        priorities_prompt: str = DEFAULT_PRIORITIES_PROMPT,
    ) -> MorningBriefing:
        reminders = (
            tuple(due_reminders)
            if due_reminders is not None
            else tuple(
                self._reminders.get_due_reminders(shop_id=shop_id, current_day=day)
            )
        )
        return MorningBriefing(
            run_id=run_id,
            shop_id=shop_id,
            shop_name=shop_name,
            day=day,
            balance_summary=balance_summary,
            yesterday_orders=yesterday_orders,
            listing_changes=tuple(listing_changes),
            new_reviews=tuple(new_reviews),
            new_customer_messages=tuple(new_customer_messages),
            due_reminders=reminders,
            market_movements=tuple(market_movements),
            objective_progress=objective_progress,
            notes=tuple(notes),
            priorities_prompt=priorities_prompt,
        )
