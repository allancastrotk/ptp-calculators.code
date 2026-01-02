import math

from app.calculators.common import percent_diff

TOLERANCE = 0.03


def classify_geometry(bore_mm: float, stroke_mm: float) -> str:
    ratio = abs(bore_mm - stroke_mm) / stroke_mm
    if ratio <= TOLERANCE:
        return "square"
    if bore_mm > stroke_mm:
        return "oversquare"
    return "undersquare"


def calculate_displacement_cc(bore_mm: float, stroke_mm: float, cylinders: int) -> float:
    return (math.pi * (bore_mm**2) / 4.0) * stroke_mm * cylinders / 1000.0


def displacement_results(
    bore_mm: float,
    stroke_mm: float,
    cylinders: int,
    baseline_cc: float | None,
) -> dict:
    displacement_cc = calculate_displacement_cc(bore_mm, stroke_mm, cylinders)
    geometry = classify_geometry(bore_mm, stroke_mm)
    results = {
        "displacement_cc": round(displacement_cc, 2),
        "geometry": geometry,
    }
    if baseline_cc:
        diff_percent = percent_diff(displacement_cc, baseline_cc)
        results["diff_percent"] = round(diff_percent, 2)
    return results
