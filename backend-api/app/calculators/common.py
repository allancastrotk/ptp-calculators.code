def percent_diff(new_value: float, base_value: float) -> float:
    return (new_value - base_value) / base_value * 100.0


def absolute_diff(new_value: float, base_value: float) -> float:
    return new_value - base_value
