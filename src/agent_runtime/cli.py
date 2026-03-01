from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .artifacts import persist_run_artifacts, supports_run_artifacts
from .briefing import morning_briefing_from_payload
from .runner import build_default_owner_agent_runner
from .serialization import jsonify


def _load_json_payload(json_string: str | None, json_file: str | None) -> dict[str, Any]:
    if json_string and json_file:
        raise ValueError("Pass either --briefing or --briefing-file, not both.")

    raw = None
    if json_file:
        if json_file == "-":
            raw = sys.stdin.read()
        else:
            with open(json_file, "r", encoding="utf-8") as handle:
                raw = handle.read()
    elif json_string:
        raw = json_string

    if raw is None:
        raise ValueError("A briefing payload is required.")

    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("Briefing payload must decode to a JSON object.")
    return payload


def _parse_shop_id_argument(raw_value: str) -> int | str:
    if raw_value.isdigit():
        return int(raw_value)
    return raw_value


def _print_json(payload: dict[str, Any], *, pretty: bool) -> None:
    if pretty:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="botique-agent-runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_day = subparsers.add_parser(
        "run-day",
        help="Run one single-shop owner-agent day using the configured provider and seller_core backend.",
    )
    run_day.add_argument("--briefing", help="Inline JSON payload for the morning briefing.")
    run_day.add_argument(
        "--briefing-file",
        help="Path to a JSON file containing the morning briefing, or '-' for stdin.",
    )
    run_day.add_argument(
        "--shop-id",
        help="Live Botique shop id. Use this instead of --briefing/--briefing-file to build the morning briefing from the current server state.",
    )
    run_day.add_argument("--run-id")
    run_day.add_argument("--base-url")
    run_day.add_argument("--control-base-url")
    run_day.add_argument("--api-key")
    run_day.add_argument("--bearer-token")
    run_day.add_argument("--timeout", type=float)
    run_day.add_argument("--mistral-api-key")
    run_day.add_argument("--mistral-model")
    run_day.add_argument("--mistral-temperature", type=float)
    run_day.add_argument("--mistral-top-p", type=float)
    run_day.add_argument("--turns-per-day", type=int, default=5)
    run_day.add_argument("--work-budget", type=int, help=argparse.SUPPRESS)
    run_day.add_argument("--max-turns", type=int, help=argparse.SUPPRESS)
    run_day.add_argument("--reset-world", action="store_true")
    run_day.add_argument("--output-dir")
    run_day.add_argument("--pretty", action="store_true")

    run_days = subparsers.add_parser(
        "run-days",
        help="Build morning briefings from live Botique state and run multiple simulation days in sequence.",
    )
    run_days.add_argument("--shop-id", required=True)
    run_days.add_argument("--days", type=int, required=True)
    run_days.add_argument("--run-id")
    run_days.add_argument("--base-url")
    run_days.add_argument("--control-base-url")
    run_days.add_argument("--api-key")
    run_days.add_argument("--bearer-token")
    run_days.add_argument("--timeout", type=float)
    run_days.add_argument("--mistral-api-key")
    run_days.add_argument("--mistral-model")
    run_days.add_argument("--mistral-temperature", type=float)
    run_days.add_argument("--mistral-top-p", type=float)
    run_days.add_argument("--turns-per-day", type=int, default=5)
    run_days.add_argument("--work-budget", type=int, help=argparse.SUPPRESS)
    run_days.add_argument("--max-turns", type=int, help=argparse.SUPPRESS)
    run_days.add_argument("--reset-world", action="store_true")
    run_days.add_argument("--output-dir")
    run_days.add_argument("--pretty", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    namespace = parser.parse_args(argv)

    try:
        if namespace.command not in {"run-day", "run-days"}:
            raise ValueError(f"Unsupported command {namespace.command!r}.")

        runner = build_default_owner_agent_runner(
            turns_per_day=namespace.turns_per_day,
            work_budget=namespace.work_budget,
            max_turns=namespace.max_turns,
            base_url=namespace.base_url,
            control_base_url=getattr(namespace, "control_base_url", None),
            api_key=namespace.api_key,
            bearer_token=namespace.bearer_token,
            timeout_seconds=namespace.timeout,
            mistral_api_key=namespace.mistral_api_key,
            mistral_model=namespace.mistral_model,
            mistral_temperature=namespace.mistral_temperature,
            mistral_top_p=namespace.mistral_top_p,
        )

        if namespace.command == "run-day":
            if namespace.shop_id and (namespace.briefing or namespace.briefing_file):
                raise ValueError(
                    "Pass either --shop-id or a briefing payload, not both."
                )

            if namespace.shop_id:
                result = runner.run_live_day(
                    shop_id=_parse_shop_id_argument(namespace.shop_id),
                    run_id=namespace.run_id,
                    reset_world=namespace.reset_world,
                )
            else:
                briefing = morning_briefing_from_payload(
                    _load_json_payload(namespace.briefing, namespace.briefing_file)
                )
                result = runner.run_day(briefing)
        else:
            result = runner.run_live_days(
                shop_id=_parse_shop_id_argument(namespace.shop_id),
                days=namespace.days,
                run_id=namespace.run_id,
                reset_world=namespace.reset_world,
            )

        response_payload: dict[str, Any] = {"ok": True, "result": jsonify(result)}
        if supports_run_artifacts(result):
            artifact_bundle = persist_run_artifacts(
                result,
                output_dir=namespace.output_dir,
                invocation={
                    key: value
                    for key, value in vars(namespace).items()
                    if key
                    not in {
                        "pretty",
                    }
                },
            )
            response_payload["artifacts"] = artifact_bundle.to_payload()

        _print_json(response_payload, pretty=namespace.pretty)
        return 0
    except Exception as exc:
        _print_json(
            {
                "ok": False,
                "error": {
                    "type": exc.__class__.__name__,
                    "message": str(exc),
                },
            },
            pretty=getattr(namespace, "pretty", False),
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
