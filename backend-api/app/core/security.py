import os
from typing import Optional

from fastapi import Header, HTTPException, status


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error_code": "unauthorized",
            "message": detail,
            "field_errors": [],
        },
    )


def _extract_internal_token(
    x_ptp_internal_key: Optional[str],
    authorization: Optional[str],
) -> Optional[str]:
    if x_ptp_internal_key:
        return x_ptp_internal_key
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2:
        return None
    if parts[0].lower() != "bearer":
        return None
    return parts[1] or None


def require_internal_key(
    x_ptp_internal_key: Optional[str] = Header(None, convert_underscores=False),
    authorization: Optional[str] = Header(None),
) -> None:
    expected = os.getenv("PTP_INTERNAL_KEY")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "server_error",
                "message": "Internal auth misconfigured.",
                "field_errors": [],
            },
        )
    token = _extract_internal_token(x_ptp_internal_key, authorization)
    if not token:
        raise _unauthorized("Missing internal authentication header.")
    if token != expected:
        raise _unauthorized("Invalid internal authentication header.")
