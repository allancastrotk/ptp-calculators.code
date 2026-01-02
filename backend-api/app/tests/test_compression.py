import math

import pytest
from fastapi.testclient import TestClient

from app.calculators.compression import (
    clearance_volume_cc,
    compression_ratio,
    deck_volume_cc,
    gasket_volume_cc,
    swept_volume_cc,
    trapped_swept_volume_cc,
)
from app.main import app


def test_compression_helpers():
    swept = swept_volume_cc(100.0, 100.0)
    gasket = gasket_volume_cc(100.0, 1.0)
    deck = deck_volume_cc(100.0, 0.0)
    clearance = clearance_volume_cc(50.0, gasket, deck, 0.0)
    ratio = compression_ratio(swept, clearance)
    trapped = trapped_swept_volume_cc(100.0, 100.0, 40.0)

    assert round(swept, 2) == 785.4
    assert round(gasket, 2) == 7.85
    assert round(clearance, 2) == 57.85
    assert round(ratio, 2) == 14.58
    assert round(trapped, 2) == 471.24


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "test-key")
    return TestClient(app)


def test_displacement_compression_four_stroke(client):
    headers = {"X-PTP-Internal-Key": "test-key", "Authorization": "Bearer test-key"}
    payload = {
        "unit_system": "metric",
        "inputs": {
            "bore": 100,
            "stroke": 100,
            "cylinders": 1,
            "compression": {
                "chamber_volume": 50,
                "gasket_thickness": 1,
                "gasket_bore": 100,
                "deck_height": 0,
                "piston_volume": 0,
            },
        },
    }
    response = client.post("/v1/calc/displacement", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["results"]["compression"]["compression_mode"] == "four_stroke"
    assert data["results"]["compression"]["compression_ratio"] == 14.58


def test_displacement_compression_two_stroke(client):
    headers = {"X-PTP-Internal-Key": "test-key", "Authorization": "Bearer test-key"}
    payload = {
        "unit_system": "metric",
        "inputs": {
            "bore": 100,
            "stroke": 100,
            "cylinders": 1,
            "compression": {
                "chamber_volume": 50,
                "gasket_thickness": 1,
                "gasket_bore": 100,
                "deck_height": 0,
                "piston_volume": 0,
                "exhaust_port_height": 40,
                "transfer_port_height": 50,
                "crankcase_volume": 800,
            },
        },
    }
    response = client.post("/v1/calc/displacement", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["results"]["compression"]["compression_mode"] == "two_stroke"
    assert math.isclose(data["results"]["compression"]["trapped_volume"], 471.24, rel_tol=1e-2)
