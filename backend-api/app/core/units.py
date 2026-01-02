INCH_TO_MM = 25.4
CC_TO_CUIN = 16.387064


def inches_to_mm(value: float) -> float:
    return value * INCH_TO_MM


def mm_to_inches(value: float) -> float:
    return value / INCH_TO_MM


def cc_to_liters(value: float) -> float:
    return value / 1000.0


def cc_to_cuin(value: float) -> float:
    return value / CC_TO_CUIN


def cuin_to_cc(value: float) -> float:
    return value * CC_TO_CUIN


def resolve_unit_system(unit_system: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    resolved = unit_system
    if unit_system == "auto":
        resolved = "metric"
        warnings.append("unit_system set to auto; assuming metric inputs.")
    return resolved, warnings
