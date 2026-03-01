from __future__ import annotations

from dataclasses import dataclass, field, replace
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
    WorkspaceEntryRecord,
    WorkspaceRecord,
)
from .serialization import jsonify


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_PRIORITIES_PROMPT = (
    "Set the highest-leverage priorities for this workday, use today's limited work slots "
    "carefully, act on inventory, backlog, production, and market signals when they "
    "matter, use the journal or reminders when they genuinely help, and stop once the "
    "important work is done."
)
DEFAULT_WORKSPACE_TEXT_MAX_CHARS = 4000
DEFAULT_WORKSPACE_ENTRY_MAX_CHARS = 1200
DEFAULT_RECENT_WORKSPACE_ENTRY_LIMIT = 3
_BRIEFING_TRUNCATION_SUFFIX = "\n\n[truncated for briefing]"


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
    simulation_date: str | None = None
    generated_at: datetime = field(default_factory=_utcnow)
    balance_summary: BalanceSummary = field(default_factory=lambda: BalanceSummary(None))
    yesterday_orders: OrderSummary = field(default_factory=lambda: OrderSummary(0, 0.0))
    listing_changes: tuple[ListingPerformanceChange, ...] = ()
    new_reviews: tuple[ReviewSummary, ...] = ()
    new_customer_messages: tuple[CustomerMessageSummary, ...] = ()
    due_reminders: tuple[ReminderRecord, ...] = ()
    market_movements: tuple[MarketMovement, ...] = ()
    production_focus: tuple[str, ...] = ()
    workspace: WorkspaceRecord | None = None
    recent_workspace_entries: tuple[WorkspaceEntryRecord, ...] = ()
    objective_progress: ObjectiveProgress = field(
        default_factory=lambda: ObjectiveProgress(
            primary_objective="Grow the shop sustainably.",
            metric_name="ending_balance",
            current_value=0.0,
            status_summary="No objective snapshot provided.",
        )
    )
    priorities_prompt: str = DEFAULT_PRIORITIES_PROMPT

    def to_payload(self) -> dict[str, object]:
        return jsonify(self)  # type: ignore[return-value]

    def to_prompt_payload(self) -> dict[str, object]:
        return self.to_payload()

    def render_for_agent(self) -> str:
        lines = [
            f"# {self.shop_name} workday",
            f"- Date: {self.simulation_date or 'unknown'}",
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

        if self.production_focus:
            lines.append("- Production watch:")
            lines.extend(f"  - {item}" for item in self.production_focus)

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
            for reminder in self.due_reminders:
                details = [f"due day {reminder.due_day}"]
                if reminder.tags:
                    details.append(f"tags: {', '.join(reminder.tags)}")
                lines.append(
                    f"  - [{reminder.reminder_id}] {reminder.content} ({'; '.join(details)})"
                )

        if self.market_movements:
            lines.append("- Market watch:")
            lines.extend(
                f"  - {_format_market_movement(movement)}"
                for movement in self.market_movements
            )

        if self.workspace is not None and self.workspace.content:
            workspace_details = [f"revision {self.workspace.revision}"]
            if self.workspace.updated_day is not None:
                workspace_details.append(f"updated day {self.workspace.updated_day}")
            if self.workspace.is_truncated:
                workspace_details.append("truncated to fit briefing")
            lines.extend(
                [
                    "",
                    "## Scratchpad",
                    f"- Current scratchpad ({', '.join(workspace_details)}):",
                    "```text",
                    self.workspace.content,
                    "```",
                ]
            )

        if self.recent_workspace_entries:
            lines.extend(["", "## Recent journal entries"])
            for entry in self.recent_workspace_entries:
                details: list[str] = [entry.entry_id]
                if entry.created_day is not None:
                    details.append(f"day {entry.created_day}")
                if entry.tags:
                    details.append(f"tags: {', '.join(entry.tags)}")
                if entry.is_truncated:
                    details.append("truncated")
                lines.extend(
                    [
                        f"- {' | '.join(details)}",
                        "```text",
                        entry.content,
                        "```",
                    ]
                )

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
        simulation_date: str | None = None,
        balance_summary: BalanceSummary,
        yesterday_orders: OrderSummary,
        objective_progress: ObjectiveProgress,
        listing_changes: Iterable[ListingPerformanceChange] = (),
        new_reviews: Iterable[ReviewSummary] = (),
        new_customer_messages: Iterable[CustomerMessageSummary] = (),
        market_movements: Iterable[MarketMovement] = (),
        production_focus: Iterable[str] = (),
        workspace: WorkspaceRecord | None = None,
        recent_workspace_entries: Iterable[WorkspaceEntryRecord] = (),
        due_reminders: Iterable[ReminderRecord] | None = None,
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
            simulation_date=simulation_date,
            balance_summary=balance_summary,
            yesterday_orders=yesterday_orders,
            listing_changes=tuple(listing_changes),
            new_reviews=tuple(new_reviews),
            new_customer_messages=tuple(new_customer_messages),
            due_reminders=reminders,
            market_movements=tuple(market_movements),
            production_focus=tuple(production_focus),
            workspace=_bounded_workspace(workspace),
            recent_workspace_entries=_bounded_workspace_entries(
                recent_workspace_entries
            ),
            objective_progress=objective_progress,
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
        capacity_status = _mapping(
            self._seller_client.get_capacity_status(shop_id=shop_id),
            "get_capacity_status",
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
            seed_capital=float(shop.get("seed_capital", 0)),
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
            capacity_status=capacity_status,
            listings=listings,
        )
        workspace = self._memory.read_workspace(shop_id=shop_id)

        is_bootstrap_start = (
            shop_state.active_listing_count == 0
            and shop_state.draft_listing_count == 0
            and shop_state.total_sales_count == 0
        )
        priorities_prompt = (
            "Your shop is brand new with zero listings. Study the marketplace, "
            "decide your niche, and create your first product listings. Focus on "
            "getting active listings generating traffic."
            if is_bootstrap_start
            else DEFAULT_PRIORITIES_PROMPT
        )

        briefing = self._briefing_builder.build(
            run_id=run_id,
            shop_id=shop_id,
            shop_name=shop_state.shop_name,
            day=current_day.day,
            simulation_date=current_day.date,
            balance_summary=balance_summary,
            yesterday_orders=yesterday_orders,
            objective_progress=objective_progress,
            listing_changes=listing_changes,
            new_reviews=new_reviews,
            market_movements=_build_market_movements(market_state),
            production_focus=_build_production_focus(
                listings=listings,
                capacity_status=capacity_status,
            ),
            workspace=workspace,
            recent_workspace_entries=self._memory.read_workspace_entries(
                shop_id=shop_id,
                limit=DEFAULT_RECENT_WORKSPACE_ENTRY_LIMIT,
            ),
            priorities_prompt=priorities_prompt,
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


def _bounded_workspace(workspace: WorkspaceRecord | None) -> WorkspaceRecord | None:
    if workspace is None or not workspace.content:
        return workspace

    content, is_truncated = _truncate_for_briefing(
        workspace.content,
        max_chars=DEFAULT_WORKSPACE_TEXT_MAX_CHARS,
    )
    if not is_truncated:
        return workspace
    return replace(workspace, content=content, is_truncated=True)


def _bounded_workspace_entries(
    entries: Iterable[WorkspaceEntryRecord],
) -> tuple[WorkspaceEntryRecord, ...]:
    bounded_entries: list[WorkspaceEntryRecord] = []
    for entry in list(entries)[:DEFAULT_RECENT_WORKSPACE_ENTRY_LIMIT]:
        content, is_truncated = _truncate_for_briefing(
            entry.content,
            max_chars=DEFAULT_WORKSPACE_ENTRY_MAX_CHARS,
        )
        bounded_entries.append(
            entry
            if not is_truncated
            else replace(entry, content=content, is_truncated=True)
        )
    return tuple(bounded_entries)


def _truncate_for_briefing(text: str, *, max_chars: int) -> tuple[str, bool]:
    if len(text) <= max_chars:
        return text, False

    if max_chars <= len(_BRIEFING_TRUNCATION_SUFFIX):
        return text[:max_chars], True

    return (
        text[: max_chars - len(_BRIEFING_TRUNCATION_SUFFIX)]
        + _BRIEFING_TRUNCATION_SUFFIX,
        True,
    )


def morning_briefing_from_payload(payload: Mapping[str, Any]) -> MorningBriefing:
    return MorningBriefing(
        run_id=str(payload["run_id"]),
        shop_id=_parse_shop_id(payload["shop_id"]),
        shop_name=str(payload["shop_name"]),
        day=int(payload["day"]),
        simulation_date=(
            None
            if payload.get("simulation_date") is None
            else str(payload.get("simulation_date"))
        ),
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
        production_focus=tuple(
            str(item) for item in payload.get("production_focus", [])
        ),
        workspace=(
            None
            if payload.get("workspace") is None
            else _parse_workspace(payload.get("workspace"))
        ),
        recent_workspace_entries=tuple(
            _parse_workspace_entry(item)
            for item in payload.get("recent_workspace_entries", [])
        ),
        objective_progress=_parse_objective_progress(payload.get("objective_progress", {})),
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


def _parse_workspace(payload: Any) -> WorkspaceRecord:
    value = _mapping(payload, "workspace")
    return WorkspaceRecord(
        shop_id=_parse_shop_id(value["shop_id"]),
        content=str(value.get("content", "")),
        revision=int(value.get("revision", 0)),
        updated_day=(
            None if value.get("updated_day") is None else int(value["updated_day"])
        ),
        is_truncated=bool(value.get("is_truncated", False)),
        updated_at=_parse_datetime(value.get("updated_at")),
    )


def _parse_workspace_entry(payload: Any) -> WorkspaceEntryRecord:
    value = _mapping(payload, "recent_workspace_entries")
    return WorkspaceEntryRecord(
        entry_id=str(value["entry_id"]),
        shop_id=_parse_shop_id(value["shop_id"]),
        content=str(value.get("content", "")),
        tags=tuple(str(item) for item in value.get("tags", [])),
        created_day=(
            None if value.get("created_day") is None else int(value["created_day"])
        ),
        is_truncated=bool(value.get("is_truncated", False)),
        created_at=_parse_datetime(value.get("created_at")),
    )


def _parse_reminder(payload: Any) -> ReminderRecord:
    value = _mapping(payload, "due_reminders")
    workspace_entry_id = value.get("workspace_entry_id")
    status = value.get("status", ReminderStatus.PENDING.value)
    return ReminderRecord(
        reminder_id=str(value["reminder_id"]),
        shop_id=_parse_shop_id(value["shop_id"]),
        content=str(value["content"]),
        due_day=int(value["due_day"]),
        tags=tuple(str(item) for item in value.get("tags", [])),
        status=ReminderStatus(status),
        workspace_entry_id=(
            None if workspace_entry_id is None else str(workspace_entry_id)
        ),
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
    seed_capital: float = 0.0,
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
        available=posted_total + seed_capital,
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
    capacity_status: Mapping[str, Any],
    listings: tuple[Any, ...],
) -> ObjectiveProgress:
    balance = 0.0 if shop_state.balance_summary.available is None else shop_state.balance_summary.available
    backlog_units = int(capacity_status.get("backlog_units", 0))
    queue_depth = int(capacity_status.get("queue_depth", 0))
    low_stock_active_listings = sum(
        1
        for item in listings
        if _mapping(item, "listing").get("state") == "active"
        and _mapping(item, "listing").get("fulfillment_mode") == "stocked"
        and int(
            _mapping(item, "listing").get(
                "quantity_on_hand",
                _mapping(item, "listing").get("quantity", 0),
            )
        )
        <= 2
    )
    diagnostics = [
        f"active_listings={shop_state.active_listing_count}",
        f"draft_listings={shop_state.draft_listing_count}",
        f"backlog_units={backlog_units}",
        f"queue_depth={queue_depth}",
        f"low_stock_active_listings={low_stock_active_listings}",
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
    if backlog_units:
        status_summary = f"{status_summary} Backlog is at {backlog_units} unit(s)."
    elif queue_depth:
        status_summary = f"{status_summary} Production queue depth is {queue_depth}."
    if top_trend:
        status_summary = f"{status_summary} Top market watch: {top_trend}."
    return ObjectiveProgress(
        primary_objective="Grow ending balance",
        metric_name="available_balance",
        current_value=round(balance, 2),
        supporting_diagnostics=tuple(diagnostics),
        status_summary=status_summary,
    )


def _build_production_focus(
    *,
    listings: tuple[Any, ...],
    capacity_status: Mapping[str, Any],
) -> tuple[str, ...]:
    listing_queue = {
        int(_mapping(item, "capacity_listing").get("listing_id", 0)): _mapping(item, "capacity_listing")
        for item in _items_from_page({"results": capacity_status.get("listings", ())}, "capacity_status")
    }
    low_stock_titles: list[str] = []
    backlog_titles: list[str] = []
    for item in listings:
        listing = _mapping(item, "listing")
        if listing.get("state") != "active":
            continue
        listing_id = int(listing.get("listing_id", 0))
        fulfillment_mode = str(listing.get("fulfillment_mode", "stocked"))
        quantity_on_hand = int(listing.get("quantity_on_hand", listing.get("quantity", 0)))
        backlog_units = int(listing.get("backlog_units", 0))
        queue_state = listing_queue.get(listing_id, {})
        queued_stock_units = int(queue_state.get("queued_stock_units", 0))
        if fulfillment_mode == "stocked" and quantity_on_hand <= 2 and queued_stock_units == 0:
            low_stock_titles.append(str(listing.get("title", "")))
        if fulfillment_mode == "made_to_order" and backlog_units > 0:
            backlog_titles.append(str(listing.get("title", "")))

    backlog_units = int(capacity_status.get("backlog_units", 0))
    queue_depth = int(capacity_status.get("queue_depth", 0))
    queued_stock_units = int(capacity_status.get("queued_stock_units", 0))
    queued_customer_units = int(capacity_status.get("queued_customer_order_units", 0))

    focus: list[str] = []
    if low_stock_titles:
        focus.append("Low-stock active listings: " + ", ".join(low_stock_titles[:3]) + ".")
    if backlog_units:
        focus.append(
            f"Backlog is {backlog_units} unit(s); made-to-order demand is consuming future capacity."
        )
    if backlog_titles:
        focus.append(
            "Made-to-order listings carrying backlog: "
            + ", ".join(backlog_titles[:3])
            + "."
        )
    if queue_depth:
        focus.append(
            f"{queue_depth} production job(s) are queued ({queued_customer_units} customer-order unit(s), {queued_stock_units} stock unit(s))."
        )
    if not focus:
        focus.append("No backlog or queued production is blocking today's capacity.")
    return tuple(focus)


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
