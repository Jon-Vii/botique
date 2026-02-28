from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Iterable, Mapping

from .client import SellerCoreClient, ToolValidationError
from .transport import HttpError


def _normalize_headers(raw_headers: Iterable[str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for item in raw_headers:
        name, separator, value = item.partition(":")
        if not separator:
            raise ToolValidationError(
                f"Invalid --header value {item!r}; expected 'Name: Value'."
            )
        normalized[name.strip()] = value.strip()
    return normalized


def _load_json_args(json_string: str | None, json_file: str | None) -> dict[str, Any]:
    if json_string and json_file:
        raise ToolValidationError("Pass either --args or --args-file, not both.")

    raw = "{}"
    if json_file:
        if json_file == "-":
            raw = sys.stdin.read()
        else:
            with open(json_file, "r", encoding="utf-8") as handle:
                raw = handle.read()
    elif json_string:
        raw = json_string

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ToolValidationError(f"Invalid JSON arguments: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ToolValidationError("Tool arguments must decode to a JSON object.")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="botique-agent-tools-core")
    subparsers = parser.add_subparsers(dest="command", required=True)

    manifest_parser = subparsers.add_parser(
        "manifest", help="Print the supported core tool manifest."
    )
    manifest_parser.add_argument("--pretty", action="store_true")

    for name in ("prepare", "call"):
        subparser = subparsers.add_parser(
            name,
            help=(
                "Compile a tool request without sending it."
                if name == "prepare"
                else "Invoke a core tool against the configured HTTP backend."
            ),
        )
        subparser.add_argument("tool_name")
        subparser.add_argument("--args", help="Inline JSON object with tool arguments.")
        subparser.add_argument(
            "--args-file",
            help="Path to a JSON file containing tool arguments, or '-' for stdin.",
        )
        subparser.add_argument("--base-url")
        subparser.add_argument("--api-key")
        subparser.add_argument("--bearer-token")
        subparser.add_argument("--timeout", type=float)
        subparser.add_argument(
            "--header",
            action="append",
            default=[],
            help="Additional request header in 'Name: Value' format. Repeatable.",
        )
        subparser.add_argument("--pretty", action="store_true")

    return parser


def _print_json(payload: Mapping[str, Any], *, pretty: bool) -> None:
    if pretty:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    namespace = parser.parse_args(argv)

    try:
        if namespace.command == "manifest":
            client = SellerCoreClient.from_env()
            _print_json({"ok": True, "tools": client.manifest()}, pretty=namespace.pretty)
            return 0

        arguments = _load_json_args(namespace.args, namespace.args_file)
        client = SellerCoreClient.from_env(
            base_url=namespace.base_url,
            api_key=namespace.api_key,
            bearer_token=namespace.bearer_token,
            timeout_seconds=namespace.timeout,
            extra_headers=_normalize_headers(namespace.header),
        )

        if namespace.command == "prepare":
            plan = client.prepare(namespace.tool_name, arguments)
            _print_json(
                {
                    "ok": True,
                    "request": {
                        "tool_name": plan.tool_name,
                        "operation_id": plan.operation_id,
                        "method": plan.method,
                        "url": plan.url,
                        "headers": plan.headers,
                        "query": plan.query,
                        "body": plan.body,
                        "body_encoding": plan.body_encoding.value,
                    },
                },
                pretty=namespace.pretty,
            )
            return 0

        result = client.call(namespace.tool_name, arguments)
        _print_json(
            {
                "ok": True,
                "tool_name": namespace.tool_name,
                "result": result,
            },
            pretty=namespace.pretty,
        )
        return 0
    except (ToolValidationError, HttpError) as exc:
        payload = {
            "ok": False,
            "error": {
                "type": exc.__class__.__name__,
                "message": str(exc),
            },
        }
        if isinstance(exc, HttpError):
            payload["error"]["status_code"] = exc.status_code
            payload["error"]["payload"] = exc.payload
        _print_json(payload, pretty=getattr(namespace, "pretty", False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
