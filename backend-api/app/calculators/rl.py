import math

from app.calculators.displacement import classify_geometry


def calculate_rl_ratio(stroke_mm: float, rod_length_mm: float) -> float:
    return (stroke_mm / 2.0) / rod_length_mm


def calculate_rod_stroke_ratio(stroke_mm: float, rod_length_mm: float) -> float:
    return rod_length_mm / stroke_mm


def calculate_displacement_cc(bore_mm: float, stroke_mm: float) -> float:
    return (math.pi * (bore_mm**2) / 4.0) * stroke_mm / 1000.0


def classify_smoothness(rl_ratio: float) -> str:
    if rl_ratio >= 0.30:
        return "rough"
    if rl_ratio >= 0.25:
        return "normal"
    return "smooth"
