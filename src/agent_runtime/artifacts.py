from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from seller_core.models import JSONValue

from .briefing import MorningBriefing, ShopStateSnapshot
from .events import RuntimeEvent
from .loop import DayRunResult, TurnRecord
from .memory import (
    ReminderRecord,
    ShopId,
    WorkspaceEntryRecord,
    WorkspaceRecord,
)
from .runner import LiveDayRunResult, MultiDayRunResult
from .serialization import jsonify


ArtifactResult = DayRunResult | LiveDayRunResult | MultiDayRunResult


@dataclass(frozen=True, slots=True)
class RunArtifactBundle:
    output_dir: str
    manifest_path: str
    readme_path: str
    summary_markdown_path: str
    summary_json_path: str
    result_json_path: str
    events_jsonl_path: str

    def to_payload(self) -> dict[str, str]:
        return {
            "output_dir": self.output_dir,
            "manifest_path": self.manifest_path,
            "readme_path": self.readme_path,
            "summary_markdown_path": self.summary_markdown_path,
            "summary_json_path": self.summary_json_path,
            "result_json_path": self.result_json_path,
            "events_jsonl_path": self.events_jsonl_path,
        }


@dataclass(frozen=True, slots=True)
class _NormalizedDayArtifact:
    day: int
    run_id: str
    shop_id: ShopId
    briefing: MorningBriefing
    day_result: DayRunResult
    raw_result: ArtifactResult | DayRunResult
    events: tuple[RuntimeEvent, ...]
    state_before: ShopStateSnapshot | None = None
    state_after: ShopStateSnapshot | None = None
    state_next_day: ShopStateSnapshot | None = None
    market_state_before: Any = None
    advancement: Any = None


@dataclass(frozen=True, slots=True)
class _NormalizedRunArtifact:
    run_id: str
    shop_id: ShopId
    days: tuple[_NormalizedDayArtifact, ...]
    events: tuple[RuntimeEvent, ...]
    workspace_entries: tuple[WorkspaceEntryRecord, ...]
    reminders: tuple[ReminderRecord, ...]
    workspace: WorkspaceRecord | None
    workspace_revisions: tuple[WorkspaceRecord, ...]
    is_live: bool


def supports_run_artifacts(result: object) -> bool:
    return isinstance(result, (DayRunResult, LiveDayRunResult, MultiDayRunResult))


def persist_run_artifacts(
    result: ArtifactResult,
    *,
    output_dir: str | Path | None = None,
    invocation: Mapping[str, Any] | None = None,
) -> RunArtifactBundle:
    normalized = _normalize_result(result)
    created_at = _utcnow()
    root_dir = _prepare_output_dir(
        output_dir=output_dir,
        run_id=normalized.run_id,
        shop_id=normalized.shop_id,
        created_at=created_at,
    )

    manifest_path = root_dir / "manifest.json"
    readme_path = root_dir / "README.md"
    summary_markdown_path = root_dir / "summary.md"
    summary_json_path = root_dir / "summary.json"
    result_json_path = root_dir / "result.json"
    events_jsonl_path = root_dir / "events.jsonl"

    summary_payload = _build_run_summary(normalized, created_at=created_at)
    manifest_payload = _build_manifest(
        normalized,
        summary_payload=summary_payload,
        created_at=created_at,
        invocation=invocation,
    )

    _write_json(manifest_path, manifest_payload)
    _write_text(readme_path, _render_readme(normalized))
    _write_json(summary_json_path, summary_payload)
    _write_text(summary_markdown_path, _render_run_summary(normalized, summary_payload))
    _write_json(result_json_path, jsonify(result))
    _write_jsonl(events_jsonl_path, (event.to_payload() for event in normalized.events))

    memory_dir = root_dir / "memory"
    memory_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        memory_dir / "workspace_entries.json",
        [entry.to_payload() for entry in normalized.workspace_entries],
    )
    _write_json(
        memory_dir / "reminders.json",
        [reminder.to_payload() for reminder in normalized.reminders],
    )
    _write_json(
        memory_dir / "workspace.json",
        None if normalized.workspace is None else normalized.workspace.to_payload(),
    )
    _write_json(
        memory_dir / "workspace_revisions.json",
        [entry.to_payload() for entry in normalized.workspace_revisions],
    )

    days_dir = root_dir / "days"
    days_dir.mkdir(parents=True, exist_ok=True)
    for day in normalized.days:
        _write_day_artifacts(days_dir, day)

    return RunArtifactBundle(
        output_dir=str(root_dir),
        manifest_path=str(manifest_path),
        readme_path=str(readme_path),
        summary_markdown_path=str(summary_markdown_path),
        summary_json_path=str(summary_json_path),
        result_json_path=str(result_json_path),
        events_jsonl_path=str(events_jsonl_path),
    )


def _normalize_result(result: ArtifactResult) -> _NormalizedRunArtifact:
    if isinstance(result, MultiDayRunResult):
        days_list = list(result.days)
        days = tuple(
            _NormalizedDayArtifact(
                day=live_day.day,
                run_id=live_day.run_id,
                shop_id=live_day.shop_id,
                briefing=live_day.day_result.briefing,
                day_result=live_day.day_result,
                raw_result=live_day,
                events=getattr(live_day, "events", ()) or live_day.day_result.events,
                state_before=live_day.state_before,
                state_after=live_day.state_after,
                state_next_day=(
                    getattr(live_day, "state_next_day", None)
                    or (
                        days_list[index + 1].state_before
                        if index + 1 < len(days_list)
                        else None
                    )
                ),
                market_state_before=live_day.market_state_before,
                advancement=live_day.advancement,
            )
            for index, live_day in enumerate(days_list)
        )
        return _NormalizedRunArtifact(
            run_id=result.run_id,
            shop_id=result.shop_id,
            days=days,
            events=result.events,
            workspace_entries=result.workspace_entries,
            reminders=result.reminders,
            workspace=getattr(result, "workspace", None),
            workspace_revisions=tuple(getattr(result, "workspace_revisions", ())),
            is_live=True,
        )

    if isinstance(result, LiveDayRunResult):
        day = _NormalizedDayArtifact(
            day=result.day,
            run_id=result.run_id,
            shop_id=result.shop_id,
            briefing=result.day_result.briefing,
            day_result=result.day_result,
            raw_result=result,
            events=getattr(result, "events", ()) or result.day_result.events,
            state_before=result.state_before,
            state_after=result.state_after,
            state_next_day=getattr(result, "state_next_day", None),
            market_state_before=result.market_state_before,
            advancement=result.advancement,
        )
        return _NormalizedRunArtifact(
            run_id=result.run_id,
            shop_id=result.shop_id,
            days=(day,),
            events=day.events,
            workspace_entries=getattr(result, "workspace_entries", ()),
            reminders=getattr(result, "reminders", ()),
            workspace=getattr(result, "workspace", None),
            workspace_revisions=tuple(getattr(result, "workspace_revisions", ())),
            is_live=True,
        )

    day = _NormalizedDayArtifact(
        day=result.day,
        run_id=result.run_id,
        shop_id=result.shop_id,
        briefing=result.briefing,
        day_result=result,
        raw_result=result,
        events=result.events,
    )
    return _NormalizedRunArtifact(
        run_id=result.run_id,
        shop_id=result.shop_id,
        days=(day,),
        events=result.events,
        workspace_entries=(),
        reminders=(),
        workspace=None,
        workspace_revisions=(),
        is_live=False,
    )


def _prepare_output_dir(
    *,
    output_dir: str | Path | None,
    run_id: str,
    shop_id: ShopId,
    created_at: datetime,
) -> Path:
    if output_dir is None:
        timestamp = created_at.strftime("%Y%m%dT%H%M%SZ")
        output_path = (
            Path.cwd()
            / "artifacts"
            / "agent-runtime"
            / f"{timestamp}__shop-{_slugify(shop_id)}__{_slugify(run_id)}"
        )
    else:
        output_path = Path(output_dir).expanduser()
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_path

    if output_path.exists():
        if not output_path.is_dir():
            raise ValueError(f"Artifact output path {output_path} is not a directory.")
        if any(output_path.iterdir()):
            raise ValueError(f"Artifact output directory {output_path} is not empty.")
    else:
        output_path.mkdir(parents=True, exist_ok=False)
    return output_path.resolve()


def _build_manifest(
    normalized: _NormalizedRunArtifact,
    *,
    summary_payload: dict[str, JSONValue],
    created_at: datetime,
    invocation: Mapping[str, Any] | None,
) -> dict[str, JSONValue]:
    return {
        "artifact_version": 1,
        "generated_at": created_at.isoformat(),
        "run_id": normalized.run_id,
        "shop_id": jsonify(normalized.shop_id),
        "day_count": len(normalized.days),
        "mode": "live" if normalized.is_live else "briefing_only",
        "invocation": jsonify(dict(invocation or {})),
        "layout": {
            "summary_markdown": "summary.md",
            "summary_json": "summary.json",
            "result_json": "result.json",
            "events_jsonl": "events.jsonl",
            "memory_workspace_entries": "memory/workspace_entries.json",
            "memory_reminders": "memory/reminders.json",
            "memory_workspace": "memory/workspace.json",
            "memory_workspace_revisions": "memory/workspace_revisions.json",
            "day_directories": "days/day-####/",
        },
        "summary": summary_payload,
    }


def _build_run_summary(
    normalized: _NormalizedRunArtifact,
    *,
    created_at: datetime,
) -> dict[str, JSONValue]:
    tool_counter: Counter[str] = Counter()
    surface_counter: Counter[str] = Counter()
    total_turns = 0
    yesterday_order_total = 0
    yesterday_revenue_total = 0.0
    day_summaries: list[dict[str, JSONValue]] = []

    for day in normalized.days:
        total_turns += len(day.day_result.turns)
        yesterday_order_total += day.briefing.yesterday_orders.order_count
        yesterday_revenue_total += day.briefing.yesterday_orders.revenue
        tool_names: list[str] = []

        for turn in day.day_result.turns:
            if turn.tool_result is None:
                continue
            tool_counter[turn.tool_result.tool_name] += 1
            surface_counter[turn.tool_result.tool.surface.value] += 1
            tool_names.append(turn.tool_result.tool_name)

        day_summaries.append(
            {
                "day": day.day,
                "simulation_date": _day_simulation_date(day),
                "turn_count": len(day.day_result.turns),
                "end_reason": day.day_result.end_reason.value,
                "tool_calls": tool_names,
                "yesterday_order_count": day.briefing.yesterday_orders.order_count,
                "yesterday_revenue": day.briefing.yesterday_orders.revenue,
                "objective_status": day.briefing.objective_progress.status_summary,
                "state_before": _shop_state_summary(day.state_before),
                "state_after": _shop_state_summary(day.state_after),
                "state_next_day": _shop_state_summary(day.state_next_day),
                "advanced_to_day": (
                    None
                    if day.advancement is None
                    else day.advancement.current_day.day
                ),
            }
        )

    event_kinds = Counter(event.kind.value for event in normalized.events)
    starting_state = _shop_state_summary(normalized.days[0].state_before)
    ending_state = _shop_state_summary(
        normalized.days[-1].state_next_day or normalized.days[-1].state_after
    )

    return {
        "generated_at": created_at.isoformat(),
        "run_id": normalized.run_id,
        "shop_id": jsonify(normalized.shop_id),
        "mode": "live" if normalized.is_live else "briefing_only",
        "day_count": len(normalized.days),
        "start_day": normalized.days[0].day,
        "end_day": normalized.days[-1].day,
        "start_simulation_date": _day_simulation_date(normalized.days[0]),
        "end_simulation_date": _day_simulation_date(normalized.days[-1]),
        "totals": {
            "turn_count": total_turns,
            "tool_call_count": sum(tool_counter.values()),
            "tool_calls_by_name": dict(sorted(tool_counter.items())),
            "tool_calls_by_surface": dict(sorted(surface_counter.items())),
            "workspace_entries_added": event_kinds.get("workspace_entry_added", 0),
            "workspace_updates": event_kinds.get("workspace_updated", 0),
            "reminders_set": event_kinds.get("reminder_set", 0),
            "reminders_completed": event_kinds.get("reminder_completed", 0),
            "simulation_advances": event_kinds.get("simulation_advanced", 0),
            "yesterday_order_count": yesterday_order_total,
            "yesterday_revenue": round(yesterday_revenue_total, 2),
        },
        "memory": {
            "workspace_entry_count": len(normalized.workspace_entries),
            "reminder_count": len(normalized.reminders),
            "pending_reminder_count": sum(
                1 for reminder in normalized.reminders if reminder.status.value == "pending"
            ),
            "workspace_revision_count": len(normalized.workspace_revisions),
            "workspace_has_content": bool(
                normalized.workspace is not None and normalized.workspace.content
            ),
        },
        "starting_state": starting_state,
        "ending_state": ending_state,
        "days": day_summaries,
    }


def _write_day_artifacts(days_dir: Path, day: _NormalizedDayArtifact) -> None:
    day_dir = days_dir / f"day-{day.day:04d}"
    day_dir.mkdir(parents=True, exist_ok=True)

    _write_json(day_dir / "record.json", jsonify(day.raw_result))
    _write_json(day_dir / "briefing.json", day.briefing.to_prompt_payload())
    _write_text(day_dir / "briefing.md", _render_briefing(day.briefing))
    _write_json(day_dir / "turns.json", [_turn_payload(turn) for turn in day.day_result.turns])
    _write_text(day_dir / "summary.md", _render_day_summary(day))
    _write_jsonl(day_dir / "events.jsonl", (event.to_payload() for event in day.events))

    if day.market_state_before is not None:
        _write_json(day_dir / "market_state_before.json", jsonify(day.market_state_before))
    if day.state_before is not None:
        _write_json(day_dir / "state_before.json", day.state_before.to_payload())
    if day.state_after is not None:
        _write_json(day_dir / "state_after.json", day.state_after.to_payload())
    if day.state_next_day is not None:
        _write_json(day_dir / "state_next_day.json", day.state_next_day.to_payload())
    if day.advancement is not None:
        _write_json(day_dir / "advancement.json", jsonify(day.advancement))


def _render_readme(normalized: _NormalizedRunArtifact) -> str:
    return "\n".join(
        [
            "# Botique Runtime Artifacts",
            "",
            f"- `summary.md`: human-readable run summary for `{normalized.run_id}`.",
            "- `summary.json`: comparison-friendly aggregate metrics for the run.",
            "- `result.json`: full serialized runtime result payload.",
            "- `events.jsonl`: complete event stream across the run.",
            "- `memory/workspace_entries.json`: final journal-entry snapshot after the run.",
            "- `memory/reminders.json`: final reminder snapshot after the run.",
            "- `memory/workspace.json`: final current scratchpad text after the run.",
            "- `memory/workspace_revisions.json`: scratchpad revision history across the run.",
            "- `days/day-####/briefing.md`: rendered morning briefing for a specific day.",
            "- `days/day-####/briefing.json`: structured briefing payload.",
            "- `days/day-####/summary.md`: day-level narrative with turn decisions, assistant output, and tool outputs.",
            "- `days/day-####/turns.json`: comparison-friendly turn records including assistant text and provider tool calls.",
            "- `days/day-####/record.json`: full structured record for that day.",
            "- `days/day-####/state_before.json` and `state_after.json`: live shop snapshots when available.",
            "- `days/day-####/state_next_day.json`: next-morning shop snapshot after day settlement when available.",
            "- `days/day-####/advancement.json`: control-plane day advancement record when the simulation advanced after that day.",
        ]
    ) + "\n"


def _render_run_summary(
    normalized: _NormalizedRunArtifact,
    summary_payload: Mapping[str, JSONValue],
) -> str:
    lines = [
        "# Reference Run Summary",
        "",
        f"- Run ID: `{normalized.run_id}`",
        f"- Shop ID: `{normalized.shop_id}`",
        f"- Days captured: {summary_payload['day_count']}",
        f"- Mode: `{summary_payload['mode']}`",
        "",
        "## Totals",
        "",
    ]

    totals = _mapping(summary_payload.get("totals"), "summary.totals")
    lines.extend(
        [
            f"- Turns executed: {totals.get('turn_count', 0)}",
            f"- Tool calls: {totals.get('tool_call_count', 0)}",
            f"- Journal entries added: {totals.get('workspace_entries_added', 0)}",
            f"- Scratchpad updates: {totals.get('workspace_updates', 0)}",
            f"- Reminders set/completed: {totals.get('reminders_set', 0)}/{totals.get('reminders_completed', 0)}",
            f"- Simulation advances: {totals.get('simulation_advances', 0)}",
            f"- Yesterday-order count across briefings: {totals.get('yesterday_order_count', 0)}",
            f"- Yesterday-briefing revenue across run: {_format_money(totals.get('yesterday_revenue'), None)}",
            "",
            "## Memory",
            "",
            f"- Journal entries saved: {_mapping(summary_payload.get('memory'), 'summary.memory').get('workspace_entry_count', 0)}",
            f"- Pending reminders: {_mapping(summary_payload.get('memory'), 'summary.memory').get('pending_reminder_count', 0)}",
            f"- Scratchpad revisions: {_mapping(summary_payload.get('memory'), 'summary.memory').get('workspace_revision_count', 0)}",
            f"- Scratchpad has content: {_mapping(summary_payload.get('memory'), 'summary.memory').get('workspace_has_content', False)}",
            "",
            "## Shop State",
            "",
            f"- Starting state: {_render_shop_state_line(summary_payload.get('starting_state'))}",
            f"- Ending state: {_render_shop_state_line(summary_payload.get('ending_state'))}",
            "",
            "## Tool Mix",
            "",
        ]
    )

    tool_calls_by_name = _mapping(totals.get("tool_calls_by_name"), "summary.tool_calls_by_name")
    if tool_calls_by_name:
        for tool_name, count in tool_calls_by_name.items():
            lines.append(f"- `{tool_name}`: {count}")
    else:
        lines.append("- No tool calls captured.")

    lines.extend(["", "## Day Timeline", ""])

    for day in normalized.days:
        lines.extend(
            [
                f"### Day {day.day}",
                "",
                f"- Simulation date: `{_day_simulation_date(day) or 'unknown'}`",
                f"- End reason: `{day.day_result.end_reason.value}`",
                f"- Turns: {len(day.day_result.turns)}",
                f"- Yesterday orders/revenue: {day.briefing.yesterday_orders.order_count} / {_format_money(day.briefing.yesterday_orders.revenue, day.briefing.balance_summary.currency_code)}",
                f"- Objective: {day.briefing.objective_progress.status_summary or 'No objective status provided.'}",
                f"- Files: `days/day-{day.day:04d}/briefing.md`, `days/day-{day.day:04d}/summary.md`, `days/day-{day.day:04d}/turns.json`",
                "",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"


def _render_day_summary(day: _NormalizedDayArtifact) -> str:
    lines = [
        f"# Day {day.day} Summary",
        "",
        f"- Run ID: `{day.run_id}`",
        f"- Shop ID: `{day.shop_id}`",
        f"- Simulation date: `{_day_simulation_date(day) or 'unknown'}`",
        f"- End reason: `{day.day_result.end_reason.value}`",
        "",
        "## Shop State",
        "",
        f"- Before: {_render_shop_state_line(_shop_state_summary(day.state_before))}",
        f"- After: {_render_shop_state_line(_shop_state_summary(day.state_after))}",
        f"- Next day: {_render_shop_state_line(_shop_state_summary(day.state_next_day))}",
        "",
        "## Turns",
        "",
    ]

    if not day.day_result.turns:
        lines.append("- No turns were executed.")
    else:
        for turn in day.day_result.turns:
            lines.extend(_render_turn(turn))

    if day.advancement is not None:
        lines.extend(
            [
                "",
                "## Simulation Advance",
                "",
                f"- Advanced from day {day.advancement.previous_day.day} to day {day.advancement.current_day.day}.",
            ]
        )
        for step in day.advancement.steps:
            lines.append(f"- `{step.name}`: {step.description}")

    return "\n".join(lines).rstrip() + "\n"


def _render_briefing(briefing: MorningBriefing) -> str:
    lines = [
        f"# Morning Briefing: Day {briefing.day}",
        "",
        f"- Run ID: `{briefing.run_id}`",
        f"- Shop: `{briefing.shop_name}` (`{briefing.shop_id}`)",
        f"- Simulation date: `{briefing.simulation_date or 'unknown'}`",
        f"- Generated at: `{briefing.generated_at.isoformat()}`",
        "",
        "## Balance",
        "",
        f"- Available: {_format_money(briefing.balance_summary.available, briefing.balance_summary.currency_code)}",
        f"- Pending: {_format_money(briefing.balance_summary.pending, briefing.balance_summary.currency_code)}",
        "",
        "## Yesterday",
        "",
        f"- Orders: {briefing.yesterday_orders.order_count}",
        f"- Revenue: {_format_money(briefing.yesterday_orders.revenue, briefing.balance_summary.currency_code)}",
        f"- Average order value: {_format_money(briefing.yesterday_orders.average_order_value, briefing.balance_summary.currency_code)}",
        "",
        "## Objective",
        "",
        f"- Primary objective: {briefing.objective_progress.primary_objective}",
        f"- Metric: `{briefing.objective_progress.metric_name}` = {briefing.objective_progress.current_value}",
        f"- Status: {briefing.objective_progress.status_summary or 'No objective status provided.'}",
        "",
        "## Market Movements",
        "",
    ]

    if briefing.market_movements:
        for movement in briefing.market_movements:
            lines.append(f"- `{movement.urgency}` {movement.headline}: {movement.summary}")
    else:
        lines.append("- No market movements captured.")

    lines.extend(["", "## Production Focus", ""])
    if briefing.production_focus:
        for item in briefing.production_focus:
            lines.append(f"- {item}")
    else:
        lines.append("- No production-specific focus captured.")

    lines.extend(["", "## Listing Changes", ""])
    if briefing.listing_changes:
        for change in briefing.listing_changes:
            lines.append(
                "- "
                f"`{change.listing_id}` {change.title}: "
                f"views {change.views_delta:+d}, favorites {change.favorites_delta:+d}, "
                f"orders {change.orders_delta:+d}, revenue {change.revenue_delta:+.2f}"
            )
    else:
        lines.append("- No listing deltas captured.")

    lines.extend(["", "## Reviews", ""])
    if briefing.new_reviews:
        for review in briefing.new_reviews:
            lines.append(f"- {review.rating:.1f} stars: {review.excerpt}")
    else:
        lines.append("- No new reviews in the briefing window.")

    lines.extend(["", "## Reminders", ""])
    if briefing.due_reminders:
        for reminder in briefing.due_reminders:
            lines.append(
                f"- `{reminder.reminder_id}` due day {reminder.due_day}: {reminder.content}"
            )
    else:
        lines.append("- No reminders due today.")

    lines.extend(["", "## Scratchpad", ""])
    if briefing.workspace is not None and briefing.workspace.content:
        details = [f"revision {briefing.workspace.revision}"]
        if briefing.workspace.updated_day is not None:
            details.append(f"updated day {briefing.workspace.updated_day}")
        if briefing.workspace.is_truncated:
            details.append("truncated to fit briefing")
        lines.extend(
            [
                f"- Current scratchpad ({', '.join(details)}):",
                "```text",
                briefing.workspace.content,
                "```",
            ]
        )
    else:
        lines.append("- No current scratchpad text saved.")

    lines.extend(["", "## Recent Journal Entries", ""])
    if briefing.recent_workspace_entries:
        for entry in briefing.recent_workspace_entries:
            details = [entry.entry_id]
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
    else:
        lines.append("- No recent journal entries attached.")

    lines.extend(["", "## Priorities Prompt", "", briefing.priorities_prompt])
    return "\n".join(lines).rstrip() + "\n"


def _render_turn(turn: TurnRecord) -> list[str]:
    assistant_text = getattr(turn, "assistant_text", None)
    provider_tool_calls = getattr(turn, "provider_tool_calls", None)
    lines = [
        f"### Turn {turn.turn_index}",
        "",
        f"- Decision: {turn.decision_summary}",
        f"- Started: `{turn.started_at.isoformat()}`",
        f"- Completed: `{turn.completed_at.isoformat()}`",
    ]
    if assistant_text:
        lines.extend(
            [
                "",
                "Assistant output:",
                "```text",
                assistant_text,
                "```",
            ]
        )
    if provider_tool_calls:
        lines.extend(
            [
                "",
                "Provider tool calls:",
                "```json",
                _dump_json(jsonify(provider_tool_calls)),
                "```",
            ]
        )
    if turn.tool_call is None:
        lines.extend(["- Tool: none", ""])
        return lines

    lines.extend(
        [
            f"- Tool: `{turn.tool_call.name}`",
            "",
            "Arguments:",
            "```json",
            _dump_json(jsonify(turn.tool_call.arguments)),
            "```",
        ]
    )

    if turn.tool_result is not None:
        lines.extend(
            [
                "",
                "Result:",
                "```json",
                _dump_json(_tool_result_payload(turn)),
                "```",
            ]
        )

    lines.append("")
    return lines


def _turn_payload(turn: TurnRecord) -> dict[str, JSONValue]:
    return {
        "turn_index": turn.turn_index,
        "decision_summary": turn.decision_summary,
        "started_at": turn.started_at.isoformat(),
        "completed_at": turn.completed_at.isoformat(),
        "assistant_text": getattr(turn, "assistant_text", None),
        "provider_tool_calls": jsonify(getattr(turn, "provider_tool_calls", None)),
        "tool_call": (
            None
            if turn.tool_call is None
            else {
                "name": turn.tool_call.name,
                "arguments": jsonify(turn.tool_call.arguments),
            }
        ),
        "tool_result": (
            None
            if turn.tool_result is None
            else _tool_result_payload(turn)
        ),
        "state_changes": jsonify(turn.state_changes),
    }


def _tool_result_payload(turn: TurnRecord) -> dict[str, JSONValue]:
    if turn.tool_result is None:
        return {}
    return {
        "tool_name": turn.tool_result.tool_name,
        "surface": turn.tool_result.tool.surface.value,
        "arguments": jsonify(turn.tool_result.arguments),
        "output": jsonify(turn.tool_result.output),
    }


def _shop_state_summary(state: ShopStateSnapshot | None) -> dict[str, JSONValue] | None:
    if state is None:
        return None
    return {
        "day": state.day,
        "simulation_date": state.simulation_date,
        "available_balance": state.balance_summary.available,
        "currency_code": state.balance_summary.currency_code,
        "active_listing_count": state.active_listing_count,
        "draft_listing_count": state.draft_listing_count,
        "total_sales_count": state.total_sales_count,
        "review_count": state.review_count,
        "review_average": state.review_average,
    }


def _render_shop_state_line(value: JSONValue) -> str:
    if not isinstance(value, dict):
        return "No live state snapshot."

    balance = _format_money(value.get("available_balance"), value.get("currency_code"))
    return (
        f"day {value.get('day', 'n/a')}, balance {balance}, "
        f"active listings {value.get('active_listing_count', 0)}, "
        f"draft listings {value.get('draft_listing_count', 0)}, "
        f"sales {value.get('total_sales_count', 0)}, "
        f"reviews {value.get('review_count', 0)}"
    )


def _day_simulation_date(day: _NormalizedDayArtifact) -> str | None:
    if day.market_state_before is not None:
        return day.market_state_before.current_day.date
    if day.state_before is not None:
        return day.state_before.simulation_date
    return None


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _write_jsonl(path: Path, rows: Any) -> None:
    lines = [json.dumps(row, sort_keys=True) for row in rows]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def _dump_json(value: JSONValue) -> str:
    return json.dumps(value, indent=2, sort_keys=True)


def _format_money(amount: Any, currency_code: Any) -> str:
    if amount is None:
        return "n/a"
    code = currency_code if isinstance(currency_code, str) and currency_code else "USD"
    return f"{code} {float(amount):.2f}"


def _mapping(value: Any, field_name: str) -> Mapping[str, JSONValue]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field_name} must be a JSON object.")
    return value


def _slugify(value: Any) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value)).strip("-_.")
    return slug or "value"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
