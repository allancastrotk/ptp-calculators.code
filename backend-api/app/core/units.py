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
