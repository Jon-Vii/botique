from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Mapping

from control_api import ControlApiClient, GlobalMarketState
from seller_core.client import SellerCoreClient

from .memory import (
    AgentMemoryStore,
    ReminderBackend,
    ReminderRecord,
    ReminderStatus,
    ShopId,
)
from .serialization import jsonify


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_PRIORITIES_PROMPT = (
    "Set the highest-leverage priorities for this workday, use today's limited work slots "
    "carefully, use notes or reminders when they genuinely help, and stop once the "
    "important work is done."
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

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]

    def to_prompt_payload(self) -> dict[str, object]:
        return self.to_payload()

    def render_for_agent(self) -> str:
        lines = [
            f"# {self.shop_name} workday",
            f"- Day: {self.day}",
            f"- Objective: {self.objective_progress.primary_objective}",
            f"- Current status: {self.objective_progress.status_summary or 'No objective update provided.'}",
            "",
            "## Morning brief",
            f"- Cash: {_format_balance_summary(self.balance_summary)}",
            f"- Yesterday: {_format_order_summary(self.yesterday_orders)}",
        ]

        if self.objective_progress.supporting_diagnostics:
            lines.append(
                f"- Key diagnostics: {', '.join(self.objective_progress.supporting_diagnostics)}"
            )

        if self.listing_changes:
            lines.append("- Listing movement:")
            lines.extend(
                f"  - {_format_listing_change(change)}" for change in self.listing_changes
            )

        if self.new_reviews:
            lines.append("- New reviews:")
            lines.extend(
                f"  - {_format_review_summary(review)}" for review in self.new_reviews
            )

        if self.new_customer_messages:
            lines.append("- Customer messages:")
            lines.extend(
                f"  - {_format_customer_message(message)}"
                for message in self.new_customer_messages
            )

        if self.due_reminders:
            lines.append("- Reminders due:")
            lines.extend(
                f"  - [{reminder.reminder_id}] {reminder.content} (due day {reminder.due_day})"
                for reminder in self.due_reminders
            )

        if self.market_movements:
            lines.append("- Market watch:")
            lines.extend(
                f"  - {_format_market_movement(movement)}"
                for movement in self.market_movements
            )

        if self.notes:
            lines.append("- Relevant notes:")
            lines.extend(f"  - {note}" for note in self.notes)

        lines.extend(
            [
                "",
                "## Today",
                f"- {self.priorities_prompt}",
            ]
        )
        return "\n".join(lines)


@dataclass(frozen=True, slots=True)
class ListingSnapshot:
    listing_id: int
    title: str
    state: str
    price: float
    quantity: int
    views: int
    favorites: int
    updated_at: str


@dataclass(frozen=True, slots=True)
class ShopStateSnapshot:
    shop_id: ShopId
    shop_name: str
    day: int
    simulation_date: str
    captured_at: datetime = field(default_factory=_utcnow)
    balance_summary: BalanceSummary = field(default_factory=lambda: BalanceSummary(None))
    total_sales_count: int = 0
    review_count: int = 0
    review_average: float | None = None
    active_listing_count: int = 0
    draft_listing_count: int = 0
    listings: tuple[ListingSnapshot, ...] = ()

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]


@dataclass(frozen=True, slots=True)
class LiveBriefingBuildResult:
    briefing: MorningBriefing
    shop_state: ShopStateSnapshot
    market_state: GlobalMarketState


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


class LiveMorningBriefingBuilder:
    def __init__(
        self,
        *,
        seller_client: SellerCoreClient,
        control_client: ControlApiClient,
        memory: AgentMemoryStore,
    ) -> None:
        self._seller_client = seller_client
        self._control_client = control_client
        self._memory = memory
        self._briefing_builder = MorningBriefingBuilder(memory)

    def build(
        self,
        *,
        run_id: str,
        shop_id: ShopId,
        previous_shop_state: ShopStateSnapshot | None = None,
    ) -> LiveBriefingBuildResult:
        market_state = self._control_client.get_global_market_state()
        current_day = market_state.current_day

        shop = _mapping(
            self._seller_client.get_shop_info(shop_id=shop_id),
            "get_shop_info",
        )
        listings = tuple(
            sorted(
                self._collect_paginated(
                    self._seller_client.get_shop_listings,
                    "get_shop_listings",
                    shop_id=shop_id,
                ),
                key=lambda item: int(_mapping(item, "listing")["listing_id"]),
            )
        )
        orders = tuple(
            self._collect_paginated(
                self._seller_client.get_orders,
                "get_orders",
                shop_id=shop_id,
                sort_on="created",
                sort_order="desc",
            )
        )
        reviews = tuple(
            self._collect_paginated(
                self._seller_client.get_reviews,
                "get_reviews",
                shop_id=shop_id,
            )
        )
        payments = tuple(
            _items_from_page(
                self._seller_client.get_payments(shop_id=shop_id),
                "get_payments",
            )
        )

        balance_summary = _build_balance_summary(
            orders=orders,
            payments=payments,
            currency_code=str(shop.get("currency_code", "USD")),
        )
        shop_state = self._build_shop_state_snapshot(
            shop=shop,
            listings=listings,
            current_day=current_day.day,
            current_day_date=current_day.date,
            balance_summary=balance_summary,
        )
        previous_day_window = _previous_day_window(current_day.date)
        yesterday_orders_raw = tuple(
            item
            for item in orders
            if _timestamp_in_range(
                _mapping(item, "order").get("created_at"),
                start=previous_day_window[0],
                end=previous_day_window[1],
            )
        )
        yesterday_orders = _summarize_orders(yesterday_orders_raw)
        new_reviews = tuple(
            _summarize_review(item)
            for item in reviews
            if _timestamp_in_range(
                _mapping(item, "review").get("created_at"),
                start=previous_day_window[0],
                end=previous_day_window[1],
            )
        )
        listing_changes = _build_listing_changes(
            listings=listings,
            previous_shop_state=previous_shop_state,
            yesterday_orders=yesterday_orders_raw,
        )
        objective_progress = _build_objective_progress(
            shop_state=shop_state,
            yesterday_orders=yesterday_orders,
            market_state=market_state,
        )
        briefing = self._briefing_builder.build(
            run_id=run_id,
            shop_id=shop_id,
            shop_name=shop_state.shop_name,
            day=current_day.day,
            balance_summary=balance_summary,
            yesterday_orders=yesterday_orders,
            objective_progress=objective_progress,
            listing_changes=listing_changes,
            new_reviews=new_reviews,
            market_movements=_build_market_movements(market_state),
        )
        return LiveBriefingBuildResult(
            briefing=briefing,
            shop_state=shop_state,
            market_state=market_state,
        )

    def _build_shop_state_snapshot(
        self,
        *,
        shop: Mapping[str, Any],
        listings: tuple[Any, ...],
        current_day: int,
        current_day_date: str,
        balance_summary: BalanceSummary,
    ) -> ShopStateSnapshot:
        listing_snapshots = tuple(
            ListingSnapshot(
                listing_id=int(_mapping(item, "listing")["listing_id"]),
                title=str(_mapping(item, "listing")["title"]),
                state=str(_mapping(item, "listing")["state"]),
                price=float(_mapping(item, "listing").get("price", 0.0)),
                quantity=int(_mapping(item, "listing").get("quantity", 0)),
                views=int(_mapping(item, "listing").get("views", 0)),
                favorites=int(_mapping(item, "listing").get("favorites", 0)),
                updated_at=str(_mapping(item, "listing").get("updated_at", "")),
            )
            for item in listings
        )
        return ShopStateSnapshot(
            shop_id=_parse_shop_id(shop["shop_id"]),
            shop_name=str(shop["shop_name"]),
            day=current_day,
            simulation_date=current_day_date,
            balance_summary=balance_summary,
            total_sales_count=int(shop.get("total_sales_count", 0)),
            review_count=int(shop.get("review_count", 0)),
            review_average=(
                None
                if shop.get("review_average") is None
                else float(shop["review_average"])
            ),
            active_listing_count=int(shop.get("listing_active_count", 0)),
            draft_listing_count=sum(
                1 for snapshot in listing_snapshots if snapshot.state == "draft"
            ),
            listings=listing_snapshots,
        )

    @staticmethod
    def _collect_paginated(
        fetch_page: Callable[..., Any],
        field_name: str,
        **arguments: Any,
    ) -> list[Any]:
        page_size = 100
        offset = 0
        results: list[Any] = []

        while True:
            payload = _mapping(
                fetch_page(limit=page_size, offset=offset, **arguments),
                field_name,
            )
            page_results = list(payload.get("results", ()))
            results.extend(page_results)
            total = int(payload.get("count", len(results)))
            if not page_results or len(results) >= total:
                return results
            offset += len(page_results)


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


def _items_from_page(payload: Any, field_name: str) -> tuple[Any, ...]:
    value = _mapping(payload, field_name)
    results = value.get("results", ())
    if not isinstance(results, (list, tuple)):
        raise ValueError(f"{field_name} results must be iterable.")
    return tuple(results)


def _build_balance_summary(
    *,
    orders: tuple[Any, ...],
    payments: tuple[Any, ...],
    currency_code: str,
) -> BalanceSummary:
    posted_total = sum(
        float(_mapping(item, "payment").get("amount", 0.0)) for item in payments
    )
    posted_receipt_ids = {
        int(_mapping(item, "payment").get("receipt_id", 0)) for item in payments
    }
    pending_total = sum(
        float(_mapping(item, "order").get("total_price", 0.0))
        for item in orders
        if bool(_mapping(item, "order").get("was_paid"))
        and int(_mapping(item, "order").get("receipt_id", 0)) not in posted_receipt_ids
        and str(_mapping(item, "order").get("status", "")) != "refunded"
    )
    return BalanceSummary(
        available=posted_total,
        pending=pending_total,
        currency_code=currency_code,
    )


def _summarize_orders(orders: Iterable[Any]) -> OrderSummary:
    order_values = [
        _mapping(item, "order")
        for item in orders
    ]
    order_count = len(order_values)
    revenue = sum(float(item.get("total_price", 0.0)) for item in order_values)
    refunded_order_count = sum(1 for item in order_values if item.get("status") == "refunded")
    average_order_value = None if order_count == 0 else revenue / order_count
    return OrderSummary(
        order_count=order_count,
        revenue=round(revenue, 2),
        average_order_value=(
            None if average_order_value is None else round(average_order_value, 2)
        ),
        refunded_order_count=refunded_order_count,
    )


def _summarize_review(review: Any) -> ReviewSummary:
    value = _mapping(review, "review")
    return ReviewSummary(
        review_id=_parse_identifier(value["review_id"]),
        listing_id=int(value["listing_id"]),
        rating=float(value["rating"]),
        excerpt=str(value.get("review", "")),
        buyer_name=None if value.get("buyer_name") is None else str(value["buyer_name"]),
    )


def _build_listing_changes(
    *,
    listings: tuple[Any, ...],
    previous_shop_state: ShopStateSnapshot | None,
    yesterday_orders: tuple[Any, ...],
) -> tuple[ListingPerformanceChange, ...]:
    previous_by_id = (
        {}
        if previous_shop_state is None
        else {listing.listing_id: listing for listing in previous_shop_state.listings}
    )
    order_stats_by_listing: dict[int, dict[str, float]] = {}
    for order in yesterday_orders:
        for line_item in _mapping(order, "order").get("line_items", ()):
            value = _mapping(line_item, "order_line_item")
            listing_id = int(value["listing_id"])
            stats = order_stats_by_listing.setdefault(
                listing_id,
                {"orders": 0.0, "revenue": 0.0},
            )
            quantity = int(value.get("quantity", 1))
            stats["orders"] += quantity
            stats["revenue"] += float(value.get("price", 0.0)) * quantity

    changes: list[ListingPerformanceChange] = []
    for item in listings:
        listing = _mapping(item, "listing")
        listing_id = int(listing["listing_id"])
        previous = previous_by_id.get(listing_id)
        views_delta = (
            0
            if previous is None
            else int(listing.get("views", 0)) - previous.views
        )
        favorites_delta = (
            0
            if previous is None
            else int(listing.get("favorites", 0)) - previous.favorites
        )
        orders_delta = int(order_stats_by_listing.get(listing_id, {}).get("orders", 0.0))
        revenue_delta = float(order_stats_by_listing.get(listing_id, {}).get("revenue", 0.0))
        state = str(listing.get("state", "draft"))
        state_changed = previous is not None and previous.state != state
        if not (
            state_changed
            or views_delta
            or favorites_delta
            or orders_delta
            or revenue_delta
        ):
            continue
        changes.append(
            ListingPerformanceChange(
                listing_id=listing_id,
                title=str(listing["title"]),
                state=state,
                views_delta=views_delta,
                favorites_delta=favorites_delta,
                orders_delta=orders_delta,
                revenue_delta=round(revenue_delta, 2),
            )
        )
    return tuple(changes)


def _build_market_movements(market_state: GlobalMarketState) -> tuple[MarketMovement, ...]:
    taxonomy_by_id = {
        item.taxonomy_id: item for item in market_state.market_snapshot.taxonomy
    }
    movements: list[MarketMovement] = []
    for trend in market_state.trend_state.active_trends:
        details: list[str] = [f"demand x{trend.demand_multiplier:.2f}"]
        taxonomy = (
            None if trend.taxonomy_id is None else taxonomy_by_id.get(trend.taxonomy_id)
        )
        if taxonomy is not None:
            details.append(
                f"{taxonomy.listing_count} active listings avg ${taxonomy.average_price:.2f}"
            )
        if trend.tags:
            details.append(f"tags: {', '.join(trend.tags[:3])}")
        movements.append(
            MarketMovement(
                headline=f"Trend watch: {trend.label}",
                summary="; ".join(details),
                urgency="high" if trend.demand_multiplier >= 1.25 else "watch",
            )
        )
    return tuple(movements)


def _build_objective_progress(
    *,
    shop_state: ShopStateSnapshot,
    yesterday_orders: OrderSummary,
    market_state: GlobalMarketState,
) -> ObjectiveProgress:
    balance = 0.0 if shop_state.balance_summary.available is None else shop_state.balance_summary.available
    diagnostics = [
        f"active_listings={shop_state.active_listing_count}",
        f"draft_listings={shop_state.draft_listing_count}",
        (
            "review_average=n/a"
            if shop_state.review_average is None
            else f"review_average={shop_state.review_average:.2f}"
        ),
        f"yesterday_orders={yesterday_orders.order_count}",
    ]
    top_trend = market_state.trend_state.active_trends[0].label if market_state.trend_state.active_trends else None
    status_summary = (
        f"Available balance is ${balance:.2f}; "
        f"{yesterday_orders.order_count} orders brought in ${yesterday_orders.revenue:.2f} yesterday."
    )
    if top_trend:
        status_summary = f"{status_summary} Top market watch: {top_trend}."
    return ObjectiveProgress(
        primary_objective="Grow ending balance",
        metric_name="available_balance",
        current_value=round(balance, 2),
        supporting_diagnostics=tuple(diagnostics),
        status_summary=status_summary,
    )


def _format_balance_summary(summary: BalanceSummary) -> str:
    currency = summary.currency_code
    available = _format_money(summary.available, currency)
    pending = _format_money(summary.pending, currency)
    if summary.pending is None:
        return f"{available} available"
    return f"{available} available, {pending} pending"


def _format_order_summary(summary: OrderSummary) -> str:
    parts = [f"{summary.order_count} orders", f"${summary.revenue:.2f} revenue"]
    if summary.average_order_value is not None:
        parts.append(f"${summary.average_order_value:.2f} average order value")
    if summary.refunded_order_count:
        parts.append(f"{summary.refunded_order_count} refunded")
    return ", ".join(parts)


def _format_listing_change(change: ListingPerformanceChange) -> str:
    metrics: list[str] = []
    if change.views_delta:
        metrics.append(f"{change.views_delta:+d} views")
    if change.favorites_delta:
        metrics.append(f"{change.favorites_delta:+d} favorites")
    if change.orders_delta:
        metrics.append(f"{change.orders_delta:+d} orders")
    if change.revenue_delta:
        metrics.append(f"{change.revenue_delta:+.2f} revenue")
    metric_summary = ", ".join(metrics) if metrics else "no measurable change"
    return f"{change.title} ({change.state}): {metric_summary}"


def _format_review_summary(review: ReviewSummary) -> str:
    buyer = "" if review.buyer_name is None else f" from {review.buyer_name}"
    return f"{review.rating:.1f} stars{buyer}: {review.excerpt}"


def _format_customer_message(message: CustomerMessageSummary) -> str:
    return f"{message.subject} [{message.priority}]: {message.excerpt}"


def _format_market_movement(movement: MarketMovement) -> str:
    return f"{movement.headline} [{movement.urgency}]: {movement.summary}"


def _format_money(value: float | None, currency_code: str) -> str:
    if value is None:
        return f"{currency_code} n/a"
    if currency_code == "USD":
        return f"${value:.2f}"
    return f"{currency_code} {value:.2f}"


def _previous_day_window(current_day_date: str) -> tuple[datetime, datetime]:
    current_day = _parse_datetime(current_day_date)
    return current_day - timedelta(days=1), current_day


def _timestamp_in_range(
    value: Any,
    *,
    start: datetime,
    end: datetime,
) -> bool:
    if value is None:
        return False
    timestamp = _parse_datetime(value)
    return start <= timestamp < end
