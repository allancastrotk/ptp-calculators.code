import re

from app.core.units import inches_to_mm

FLOTATION_PATTERN = re.compile(r"^([0-9.]+)x([0-9.]+)(?:R|-)([0-9.]+)$", re.IGNORECASE)


def parse_flotation(value: str) -> tuple[float, float, float] | None:
    match = FLOTATION_PATTERN.match(value.strip())
    if not match:
        return None
    overall_in = float(match.group(1))
    width_in = float(match.group(2))
    rim_in = float(match.group(3))
    return overall_in, width_in, rim_in


def calculate_diameter_mm(rim_in: float, width_mm: float, aspect_percent: float) -> float:
    return rim_in * 25.4 + 2 * width_mm * (aspect_percent / 100.0)


def calculate_assembly_width_mm(width_mm: float, rim_width_in: float | None) -> float:
    if rim_width_in is None:
        return width_mm
    rim_width_mm = inches_to_mm(rim_width_in)
    return max(width_mm, rim_width_mm)
