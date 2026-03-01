from __future__ import annotations

import os
from typing import Any, Mapping

from .compat.botique import BOTIQUE_EXTENSION_TOOL_INDEX, BOTIQUE_EXTENSION_TOOL_SPECS
from .compat.etsy_v3 import CORE_TOOL_INDEX, CORE_TOOL_SPECS, ETSY_V3_BASE_URL
from .models import (
    BodyEncoding,
    ClientConfig,
    EndpointSpec,
    RequestPlan,
    SellerToolSurface,
)
from .transport import HttpTransport


class ToolValidationError(ValueError):
    """Raised when tool arguments do not satisfy the contract."""


def _coerce_body_map(value: Any) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ToolValidationError("payload must be a JSON object.")
    return value


def _format_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("Bearer "):
        return value
    return f"Bearer {value}"


class SellerCoreClient:
    def __init__(
        self,
        config: ClientConfig,
        transport: HttpTransport | None = None,
    ) -> None:
        self.config = config
        self.transport = transport or HttpTransport(timeout_seconds=config.timeout_seconds)

    @classmethod
    def from_env(
        cls,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        bearer_token: str | None = None,
        timeout_seconds: float | None = None,
        extra_headers: Mapping[str, str] | None = None,
    ) -> "SellerCoreClient":
        config = ClientConfig(
            base_url=(
                base_url
                or os.getenv("BOTIQUE_CORE_BASE_URL")
                or os.getenv("ETSY_OPEN_API_BASE_URL")
                or ETSY_V3_BASE_URL
            ),
            api_key=(
                api_key
                or os.getenv("BOTIQUE_CORE_API_KEY")
                or os.getenv("ETSY_OPEN_API_KEY")
            ),
            bearer_token=(
                bearer_token
                or os.getenv("BOTIQUE_CORE_BEARER_TOKEN")
                or os.getenv("ETSY_OPEN_API_BEARER_TOKEN")
            ),
            timeout_seconds=float(
                timeout_seconds
                or os.getenv("BOTIQUE_CORE_TIMEOUT_SECONDS")
                or os.getenv("ETSY_OPEN_API_TIMEOUT_SECONDS")
                or 30.0
            ),
            extra_headers=extra_headers or {},
        )
        return cls(config=config)

    def manifest(self) -> list[dict[str, Any]]:
        return self.tool_manifest(surfaces=(SellerToolSurface.CORE,))

    def tool_manifest(
        self,
        *,
        surfaces: tuple[SellerToolSurface, ...] | None = None,
    ) -> list[dict[str, Any]]:
        selected_surfaces = (
            set(surfaces)
            if surfaces is not None
            else {SellerToolSurface.CORE, SellerToolSurface.EXTENSION}
        )
        specs = [
            spec
            for spec in (*CORE_TOOL_SPECS, *BOTIQUE_EXTENSION_TOOL_SPECS)
            if spec.surface in selected_surfaces
        ]
        return [self._serialize_spec(spec) for spec in specs]

    def prepare(self, tool_name: str, arguments: Mapping[str, Any]) -> RequestPlan:
        spec = self._get_spec(tool_name)
        request_arguments = dict(arguments)
        path_values = self._extract_path_params(spec, request_arguments)
        query_values = self._extract_query_params(spec, request_arguments)
        body_value = self._extract_body(spec, request_arguments)
        self._validate_body(spec, body_value)

        path = spec.path_template.format(**path_values)
        return RequestPlan(
            tool_name=spec.tool_name,
            operation_id=spec.operation_id,
            method=spec.method,
            url=f"{self.config.base_url.rstrip('/')}{path}",
            headers=self._build_headers(),
            query=query_values,
            body=body_value,
            body_encoding=spec.body_encoding,
        )

    def call(self, tool_name: str, arguments: Mapping[str, Any]) -> Any:
        plan = self.prepare(tool_name, arguments)
        response = self.transport.send(plan)
        return response.data

    def create_draft_listing(self, **arguments: Any) -> Any:
        return self.call("create_draft_listing", arguments)

    def update_listing(self, **arguments: Any) -> Any:
        return self.call("update_listing", arguments)

    def get_listing(self, **arguments: Any) -> Any:
        return self.call("get_listing", arguments)

    def delete_listing(self, **arguments: Any) -> Any:
        return self.call("delete_listing", arguments)

    def get_shop_listings(self, **arguments: Any) -> Any:
        return self.call("get_shop_listings", arguments)

    def search_marketplace(self, **arguments: Any) -> Any:
        return self.call("search_marketplace", arguments)

    def get_listing_inventory(self, **arguments: Any) -> Any:
        return self.call("get_listing_inventory", arguments)

    def update_listing_inventory(self, **arguments: Any) -> Any:
        return self.call("update_listing_inventory", arguments)

    def get_shop_info(self, **arguments: Any) -> Any:
        return self.call("get_shop_info", arguments)

    def update_shop(self, **arguments: Any) -> Any:
        return self.call("update_shop", arguments)

    def get_orders(self, **arguments: Any) -> Any:
        return self.call("get_orders", arguments)

    def get_order_details(self, **arguments: Any) -> Any:
        return self.call("get_order_details", arguments)

    def get_payments(self, **arguments: Any) -> Any:
        return self.call("get_payments", arguments)

    def get_reviews(self, **arguments: Any) -> Any:
        return self.call("get_reviews", arguments)

    def get_taxonomy_nodes(self, **arguments: Any) -> Any:
        return self.call("get_taxonomy_nodes", arguments)

    def queue_production(self, **arguments: Any) -> Any:
        return self.call("queue_production", arguments)

    def get_capacity_status(self, **arguments: Any) -> Any:
        return self.call("get_capacity_status", arguments)

    @staticmethod
    def _get_spec(tool_name: str) -> EndpointSpec:
        try:
            return CORE_TOOL_INDEX[tool_name]
        except KeyError:
            try:
                return BOTIQUE_EXTENSION_TOOL_INDEX[tool_name]
            except KeyError as exc:
                raise ToolValidationError(f"Unknown seller tool {tool_name!r}.") from exc

    @staticmethod
    def _serialize_spec(spec: EndpointSpec) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "tool_name": spec.tool_name,
            "operation_id": spec.operation_id,
            "method": spec.method,
            "path_template": spec.path_template,
            "description": spec.description,
            "surface": spec.surface.value,
            "path_params": list(spec.path_params),
            "query_params": list(spec.query_params),
            "required_body_fields": list(spec.required_body_fields),
            "body_encoding": spec.body_encoding.value,
            "scopes": list(spec.scopes),
            "notes": list(spec.notes),
        }
        if spec.parameters_schema is not None:
            payload["parameters_schema"] = spec.parameters_schema
        return payload

    def _build_headers(self) -> dict[str, str]:
        headers = dict(self.config.extra_headers)
        if self.config.api_key:
            headers.setdefault("x-api-key", self.config.api_key)
        formatted_token = _format_bearer_token(self.config.bearer_token)
        if formatted_token:
            headers.setdefault("Authorization", formatted_token)
        headers.setdefault("Accept", "application/json")
        return headers

    @staticmethod
    def _extract_path_params(
        spec: EndpointSpec, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        missing = [name for name in spec.path_params if name not in arguments]
        if missing:
            raise ToolValidationError(
                f"{spec.tool_name} is missing required path params: {', '.join(missing)}."
            )
        return {name: arguments.pop(name) for name in spec.path_params}

    @staticmethod
    def _extract_query_params(
        spec: EndpointSpec, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        explicit_query = arguments.pop("query", None)
        if explicit_query is not None:
            if not isinstance(explicit_query, Mapping):
                raise ToolValidationError("query must be a JSON object.")
            query = dict(explicit_query)
        else:
            query = {}

        for name in spec.query_params:
            if name in arguments:
                query[name] = arguments.pop(name)

        if spec.body_encoding == BodyEncoding.NONE:
            query.update(arguments)
            arguments.clear()

        return query

    @staticmethod
    def _extract_body(spec: EndpointSpec, arguments: dict[str, Any]) -> Any:
        if spec.body_encoding == BodyEncoding.NONE:
            if arguments:
                unexpected = ", ".join(sorted(arguments))
                raise ToolValidationError(
                    f"{spec.tool_name} does not accept a request body; unexpected keys: {unexpected}."
                )
            return None

        payload = arguments.pop("payload", None)
        if payload is not None:
            if arguments:
                unexpected = ", ".join(sorted(arguments))
                raise ToolValidationError(
                    f"When payload is provided, all body fields must be nested inside it. Unexpected keys: {unexpected}."
                )
            return dict(_coerce_body_map(payload))

        return dict(arguments)

    @staticmethod
    def _validate_body(spec: EndpointSpec, body: Any) -> None:
        if spec.body_encoding == BodyEncoding.NONE:
            return
        if not isinstance(body, Mapping):
            raise ToolValidationError(f"{spec.tool_name} requires a JSON object payload.")

        missing = [field for field in spec.required_body_fields if field not in body]
        if missing:
            raise ToolValidationError(
                f"{spec.tool_name} is missing required body fields: {', '.join(missing)}."
            )


CoreToolsClient = SellerCoreClient
