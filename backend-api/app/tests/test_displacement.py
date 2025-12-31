import math

from app.calculators.displacement import calculate_displacement_cc, classify_geometry
from app.core.units import cc_to_cuin, cc_to_liters, inches_to_mm


def test_displacement_metric_case():
    bore_mm = 58.0
    stroke_mm = 50.0
    cylinders = 4
    cc = calculate_displacement_cc(bore_mm, stroke_mm, cylinders)
    assert round(cc, 2) == 528.42
    assert classify_geometry(bore_mm, stroke_mm) == "oversquare"


def test_displacement_imperial_conversion():
    bore_mm = 58.0
    stroke_mm = 50.0
    bore_in = bore_mm / 25.4
    stroke_in = stroke_mm / 25.4
    cc_from_inches = calculate_displacement_cc(
        inches_to_mm(bore_in), inches_to_mm(stroke_in), 4
    )
    cc_from_mm = calculate_displacement_cc(bore_mm, stroke_mm, 4)
    assert math.isclose(cc_from_inches, cc_from_mm, rel_tol=1e-9)


def test_displacement_baseline_diff_percent():
    cc = calculate_displacement_cc(58.0, 50.0, 4)
    diff_percent = (cc - 500.0) / 500.0 * 100.0
    assert round(diff_percent, 2) == 5.68


def test_unit_conversions():
    cc = 528.4158843338032
    assert round(cc_to_liters(cc), 2) == 0.53
    assert round(cc_to_cuin(cc), 2) == 32.25
