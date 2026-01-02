import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.calculators.sprocket import calculate_ratio
from app.main import app
from app.schemas.sprocket import SprocketInputs, SprocketResults


def test_sprocket_ratio():
    assert round(calculate_ratio(38, 14), 2) == 2.71


def test_sprocket_validation_errors():
    with pytest.raises(ValidationError):
        SprocketInputs(sprocket_teeth=0, crown_teeth=38)


def test_sprocket_results_shape():
    results = SprocketResults(ratio=2.71)
    assert results.model_dump().keys() == {
        "ratio",
        "chain_length_mm",
        "chain_length_in",
        "center_distance_mm",
        "center_distance_in",
        "diff_ratio_percent",
        "diff_ratio_absolute",
        "diff_chain_length_percent",
        "diff_chain_length_absolute",
        "diff_center_distance_percent",
        "diff_center_distance_absolute",
    }


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "test-key")
    return TestClient(app)


def test_sprocket_diff_ratio(client):
    headers = {"X-PTP-Internal-Key": "test-key", "Authorization": "Bearer test-key"}
    payload = {
        "unit_system": "metric",
        "inputs": {
            "sprocket_teeth": 15,
            "crown_teeth": 38,
            "baseline": {"sprocket_teeth": 14, "crown_teeth": 38},
        },
    }
    response = client.post("/v1/calc/sprocket", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["results"]["diff_ratio_percent"] == -6.67
