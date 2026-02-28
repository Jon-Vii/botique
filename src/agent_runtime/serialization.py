from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping

from seller_core.models import JSONValue


def jsonify(value: Any) -> JSONValue:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Enum):
        return str(value.value)
    if isinstance(value, datetime):
        return value.isoformat()
    if is_dataclass(value):
        return jsonify(asdict(value))
    if isinstance(value, Mapping):
        return {
            str(key): jsonify(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set, frozenset)):
        return [jsonify(item) for item in value]
    return str(value)
