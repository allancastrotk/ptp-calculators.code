import pytest
from pydantic import ValidationError

from app.calculators.tires import parse_flotation, calculate_diameter_mm
from app.schemas.tires import TiresInputs, TiresResults


def test_flotation_parse_valid():
    parsed = parse_flotation("31x10.5R15")
    assert parsed == (31.0, 10.5, 15.0)


def test_flotation_parse_invalid():
    assert parse_flotation("31x10.5-15") is None


def test_tires_metric_calculation():
    diameter_mm = calculate_diameter_mm(17.0, 190.0, 55.0)
    assert round(diameter_mm, 2) == 640.8


def test_tires_validation_errors():
    with pytest.raises(ValidationError):
        TiresInputs(vehicle_type="Car", rim_in=17.0, width_mm=None, aspect_percent=None)


def test_tires_results_shape():
    results = TiresResults(diameter=640.3, width=190.0)
    assert results.model_dump().keys() == {
        "diameter",
        "width",
        "diff_diameter",
        "diff_diameter_percent",
        "diff_width",
        "diff_width_percent",
    }
