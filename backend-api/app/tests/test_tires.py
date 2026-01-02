import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.calculators.tires import parse_flotation, calculate_diameter_mm
from app.main import app
from app.schemas.tires import TiresInputs, TiresResults


def test_flotation_parse_valid():
    parsed = parse_flotation("31x10.5R15")
    assert parsed == (31.0, 10.5, 15.0)
    parsed_dash = parse_flotation("10x4.50-5")
    assert parsed_dash == (10.0, 4.5, 5.0)


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


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "test-key")
    return TestClient(app)


def test_tires_valid_categories(client):
    headers = {"X-PTP-Internal-Key": "test-key"}
    payloads = [
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Car",
                "rim_in": 16,
                "width_mm": 205,
                "aspect_percent": 55,
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Motorcycle",
                "rim_in": 17,
                "width_mm": 120,
                "aspect_percent": 70,
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "LightTruck",
                "rim_in": 17,
                "width_mm": 265,
                "aspect_percent": 70,
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "LightTruck",
                "rim_in": 17,
                "flotation": "33x12.5R17",
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "TruckCommercial",
                "rim_in": 22.5,
                "width_mm": 295,
                "aspect_percent": 75,
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Kart",
                "rim_in": 5,
                "flotation": "10x4.50-5",
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Kart",
                "rim_in": 5,
                "flotation": "11x7.10-5",
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Kartcross",
                "rim_in": 8,
                "flotation": "18x9.5-8",
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Kartcross",
                "rim_in": 10,
                "flotation": "22x11-10",
            },
        },
    ]
    for payload in payloads:
        response = client.post("/v1/calc/tires", json=payload, headers=headers)
        assert response.status_code == 200


def test_tires_invalid_combinations(client):
    headers = {"X-PTP-Internal-Key": "test-key"}
    invalid_payloads = [
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Car",
                "rim_in": 28,
                "width_mm": 205,
                "aspect_percent": 55,
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "LightTruck",
                "rim_in": 17,
                "width_mm": 195,
                "aspect_percent": 40,
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "LightTruck",
                "rim_in": 17,
                "flotation": "31x10.5R15",
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Kart",
                "rim_in": 6,
                "flotation": "22x11-10",
            },
        },
        {
            "unit_system": "metric",
            "inputs": {
                "vehicle_type": "Kartcross",
                "rim_in": 7,
                "flotation": "10x4.50-5",
            },
        },
    ]
    for payload in invalid_payloads:
        response = client.post("/v1/calc/tires", json=payload, headers=headers)
        assert response.status_code == 400
