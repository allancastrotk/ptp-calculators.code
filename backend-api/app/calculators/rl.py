def calculate_rl_ratio(stroke_mm: float, rod_length_mm: float) -> float:
    return (stroke_mm / 2.0) / rod_length_mm


def calculate_rod_stroke_ratio(stroke_mm: float, rod_length_mm: float) -> float:
    return rod_length_mm / stroke_mm
