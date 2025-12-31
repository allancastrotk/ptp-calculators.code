from typing import Iterable


def ensure_positive(value: float, field: str, errors: list[dict]) -> None:
    if value is None or value <= 0:
        errors.append({"field": field, "reason": "must be greater than zero"})


def ensure_integer(value: float, field: str, errors: list[dict]) -> None:
    if value is None or int(value) != value:
        errors.append({"field": field, "reason": "must be an integer"})


def raise_if_errors(errors: Iterable[dict]) -> None:
    if errors:
        raise ValueError(errors)
