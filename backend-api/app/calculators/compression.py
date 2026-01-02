import math


def swept_volume_cc(bore_mm: float, stroke_mm: float) -> float:
    return math.pi * (bore_mm ** 2) / 4.0 * stroke_mm / 1000.0


def gasket_volume_cc(gasket_bore_mm: float, gasket_thickness_mm: float) -> float:
    return math.pi * (gasket_bore_mm ** 2) / 4.0 * gasket_thickness_mm / 1000.0


def deck_volume_cc(bore_mm: float, deck_height_mm: float) -> float:
    return math.pi * (bore_mm ** 2) / 4.0 * deck_height_mm / 1000.0


def clearance_volume_cc(
    chamber_cc: float,
    gasket_cc: float,
    deck_cc: float,
    piston_volume_cc: float,
) -> float:
    return chamber_cc + gasket_cc + deck_cc + piston_volume_cc


def compression_ratio(swept_cc: float, clearance_cc: float) -> float:
    return (swept_cc + clearance_cc) / clearance_cc


def trapped_swept_volume_cc(
    bore_mm: float,
    stroke_mm: float,
    port_height_mm: float,
) -> float:
    effective_stroke = stroke_mm - port_height_mm
    return swept_volume_cc(bore_mm, effective_stroke)
