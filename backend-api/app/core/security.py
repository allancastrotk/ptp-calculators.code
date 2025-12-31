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


def require_internal_key(
    x_ptp_internal_key: Optional[str] = Header(None, convert_underscores=False),
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
    if not x_ptp_internal_key:
        raise _unauthorized("Missing internal authentication header.")
    if x_ptp_internal_key != expected:
        raise _unauthorized("Invalid internal authentication header.")
