import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.calculators.rl import calculate_rl_ratio, calculate_rod_stroke_ratio, classify_smoothness
from app.main import app
from app.schemas.rl import RLResults, RLInputs


def test_rl_ratios():
    stroke_mm = 50.0
    rod_length_mm = 100.0
    rl_ratio = calculate_rl_ratio(stroke_mm, rod_length_mm)
    rod_stroke_ratio = calculate_rod_stroke_ratio(stroke_mm, rod_length_mm)
    assert round(rl_ratio, 2) == 0.25
    assert round(rod_stroke_ratio, 2) == 2.0


def test_rl_results_shape():
    results = RLResults(
        rl_ratio=0.25,
        rod_stroke_ratio=2.0,
        displacement_cc=132.1,
        geometry="oversquare",
        smoothness="normal",
    )
    assert results.model_dump().keys() == {
        "rl_ratio",
        "rod_stroke_ratio",
        "displacement_cc",
        "geometry",
        "smoothness",
        "diff_rl_percent",
        "diff_displacement_percent",
    }


def test_rl_validation_errors():
    with pytest.raises(ValidationError):
        RLInputs(bore=58.0, stroke=0, rod_length=100.0)


def test_smoothness_classification():
    assert classify_smoothness(0.31) == "rough"
    assert classify_smoothness(0.26) == "normal"
    assert classify_smoothness(0.2) == "smooth"


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "test-key")
    return TestClient(app)


def test_rl_diff_percent(client):
    headers = {"X-PTP-Internal-Key": "test-key"}
    payload = {
        "unit_system": "metric",
        "inputs": {
            "bore": 58,
            "stroke": 50,
            "rod_length": 90,
            "baseline": {"bore": 58, "stroke": 50, "rod_length": 100},
        },
    }
    response = client.post("/v1/calc/rl", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["results"]["diff_rl_percent"] == 11.11
