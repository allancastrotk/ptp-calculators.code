from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

UnitSystem = Literal["metric", "imperial", "auto"]
ResolvedUnitSystem = Literal["metric", "imperial"]
Language = Literal["pt_BR", "en_US", "es_ES"]


class FieldError(BaseModel):
    field: str
    reason: str


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    field_errors: list[FieldError] = Field(default_factory=list)


class Meta(BaseModel):
    version: str = "v1"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source: str = "legacy-compatible"


class RequestBase(BaseModel):
    unit_system: UnitSystem
    language: Optional[Language] = None


class ResponseBase(BaseModel):
    calculator: str
    unit_system: ResolvedUnitSystem
    warnings: list[str] = Field(default_factory=list)
    meta: Meta = Field(default_factory=Meta)
