import pytest
from fastapi import HTTPException

from app.core.security import require_internal_key


def test_internal_auth_accepts_custom_header(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "secret")
    require_internal_key(x_ptp_internal_key="secret", authorization=None)


def test_internal_auth_accepts_bearer_header(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "secret")
    require_internal_key(x_ptp_internal_key=None, authorization="Bearer secret")


def test_internal_auth_missing_headers(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "secret")
    with pytest.raises(HTTPException) as excinfo:
        require_internal_key(x_ptp_internal_key=None, authorization=None)
    assert excinfo.value.status_code == 401
    assert excinfo.value.detail["error_code"] == "unauthorized"


def test_internal_auth_rejects_invalid_token(monkeypatch):
    monkeypatch.setenv("PTP_INTERNAL_KEY", "secret")
    with pytest.raises(HTTPException) as excinfo:
        require_internal_key(x_ptp_internal_key="wrong", authorization=None)
    assert excinfo.value.status_code == 401
    assert excinfo.value.detail["error_code"] == "unauthorized"