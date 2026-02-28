from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

from .memory import ReminderBackend, ReminderRecord, ReminderStatus, ShopId
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


def morning_briefing_from_payload(payload: Mapping[str, Any]) -> MorningBriefing:
    return MorningBriefing(
        run_id=str(payload["run_id"]),
        shop_id=_parse_shop_id(payload["shop_id"]),
        shop_name=str(payload["shop_name"]),
        day=int(payload["day"]),
        generated_at=_parse_datetime(payload.get("generated_at")),
        balance_summary=_parse_balance_summary(payload.get("balance_summary", {})),
        yesterday_orders=_parse_order_summary(payload.get("yesterday_orders", {})),
        listing_changes=tuple(
            _parse_listing_change(item) for item in payload.get("listing_changes", [])
        ),
        new_reviews=tuple(
            _parse_review_summary(item) for item in payload.get("new_reviews", [])
        ),
        new_customer_messages=tuple(
            _parse_customer_message(item)
            for item in payload.get("new_customer_messages", [])
        ),
        due_reminders=tuple(
            _parse_reminder(item) for item in payload.get("due_reminders", [])
        ),
        market_movements=tuple(
            _parse_market_movement(item)
            for item in payload.get("market_movements", [])
        ),
        objective_progress=_parse_objective_progress(payload.get("objective_progress", {})),
        notes=tuple(str(item) for item in payload.get("notes", [])),
        priorities_prompt=str(
            payload.get("priorities_prompt", DEFAULT_PRIORITIES_PROMPT)
        ),
    )


def _parse_balance_summary(payload: Any) -> BalanceSummary:
    value = _mapping(payload, "balance_summary")
    available = value.get("available")
    pending = value.get("pending")
    return BalanceSummary(
        available=None if available is None else float(available),
        pending=None if pending is None else float(pending),
        currency_code=str(value.get("currency_code", "USD")),
    )


def _parse_order_summary(payload: Any) -> OrderSummary:
    value = _mapping(payload, "yesterday_orders")
    average_order_value = value.get("average_order_value")
    return OrderSummary(
        order_count=int(value.get("order_count", 0)),
        revenue=float(value.get("revenue", 0.0)),
        average_order_value=(
            None if average_order_value is None else float(average_order_value)
        ),
        refunded_order_count=int(value.get("refunded_order_count", 0)),
    )


def _parse_listing_change(payload: Any) -> ListingPerformanceChange:
    value = _mapping(payload, "listing_changes")
    return ListingPerformanceChange(
        listing_id=int(value["listing_id"]),
        title=str(value["title"]),
        state=str(value["state"]),
        views_delta=int(value.get("views_delta", 0)),
        favorites_delta=int(value.get("favorites_delta", 0)),
        orders_delta=int(value.get("orders_delta", 0)),
        revenue_delta=float(value.get("revenue_delta", 0.0)),
    )


def _parse_review_summary(payload: Any) -> ReviewSummary:
    value = _mapping(payload, "new_reviews")
    listing_id = value.get("listing_id")
    buyer_name = value.get("buyer_name")
    return ReviewSummary(
        review_id=_parse_identifier(value["review_id"]),
        listing_id=None if listing_id is None else int(listing_id),
        rating=float(value["rating"]),
        excerpt=str(value["excerpt"]),
        buyer_name=None if buyer_name is None else str(buyer_name),
    )


def _parse_customer_message(payload: Any) -> CustomerMessageSummary:
    value = _mapping(payload, "new_customer_messages")
    return CustomerMessageSummary(
        message_id=_parse_identifier(value["message_id"]),
        subject=str(value["subject"]),
        excerpt=str(value["excerpt"]),
        priority=str(value.get("priority", "normal")),
    )


def _parse_market_movement(payload: Any) -> MarketMovement:
    value = _mapping(payload, "market_movements")
    return MarketMovement(
        headline=str(value["headline"]),
        summary=str(value["summary"]),
        urgency=str(value.get("urgency", "watch")),
    )


def _parse_objective_progress(payload: Any) -> ObjectiveProgress:
    value = _mapping(payload, "objective_progress")
    target_value = value.get("target_value")
    return ObjectiveProgress(
        primary_objective=str(
            value.get("primary_objective", "Grow the shop sustainably.")
        ),
        metric_name=str(value.get("metric_name", "ending_balance")),
        current_value=float(value.get("current_value", 0.0)),
        target_value=None if target_value is None else float(target_value),
        supporting_diagnostics=tuple(
            str(item) for item in value.get("supporting_diagnostics", [])
        ),
        status_summary=str(value.get("status_summary", "")),
    )


def _parse_reminder(payload: Any) -> ReminderRecord:
    value = _mapping(payload, "due_reminders")
    note_id = value.get("note_id")
    status = value.get("status", ReminderStatus.PENDING.value)
    return ReminderRecord(
        reminder_id=str(value["reminder_id"]),
        shop_id=_parse_shop_id(value["shop_id"]),
        content=str(value["content"]),
        due_day=int(value["due_day"]),
        status=ReminderStatus(status),
        note_id=None if note_id is None else str(note_id),
        created_day=None if value.get("created_day") is None else int(value["created_day"]),
        created_at=_parse_datetime(value.get("created_at")),
    )


def _parse_datetime(value: Any) -> datetime:
    if value is None:
        return _utcnow()
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValueError("datetime values must be ISO strings.")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _mapping(value: Any, field_name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field_name} must be a JSON object.")
    return value


def _parse_identifier(value: Any) -> int | str:
    if isinstance(value, (int, str)):
        return value
    raise ValueError("identifier values must be strings or integers.")


def _parse_shop_id(value: Any) -> ShopId:
    if isinstance(value, (int, str)):
        return value
    raise ValueError("shop_id must be a string or integer.")
