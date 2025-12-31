import pytest
from pydantic import ValidationError

from app.calculators.rl import (
    calculate_rl_ratio,
    calculate_rod_stroke_ratio,
    classify_smoothness,
)
from app.schemas.rl import RLInputs


def test_rl_ratios():
    stroke_mm = 50.0
    rod_length_mm = 100.0
    rl_ratio = calculate_rl_ratio(stroke_mm, rod_length_mm)
    rod_stroke_ratio = calculate_rod_stroke_ratio(stroke_mm, rod_length_mm)
    assert round(rl_ratio, 2) == 0.25
    assert round(rod_stroke_ratio, 2) == 2.0
    assert classify_smoothness(rl_ratio) == "normal"


def test_rl_validation_errors():
    with pytest.raises(ValidationError):
        RLInputs(bore=0, stroke=50.0, rod_length=100.0)
