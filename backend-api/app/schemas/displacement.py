from typing import Optional

from pydantic import BaseModel, Field, conint, confloat

from app.schemas.common import RequestBase, ResponseBase
from app.schemas.compression import CompressionInputs, CompressionNormalizedInputs, CompressionResults


class DisplacementInputs(BaseModel):
    bore: confloat(gt=0)
    stroke: confloat(gt=0)
    cylinders: conint(gt=0)
    baseline_cc: Optional[confloat(gt=0)] = None
    compression: Optional[CompressionInputs] = None


class DisplacementRequest(RequestBase):
    inputs: DisplacementInputs


class DisplacementNormalizedInputs(BaseModel):
    bore_mm: float
    stroke_mm: float
    cylinders: int
    baseline_cc: Optional[float] = None
    compression: Optional[CompressionNormalizedInputs] = None


class DisplacementResults(BaseModel):
    displacement_cc: float
    displacement_l: float
    displacement_ci: float
    geometry: str
    diff_percent: Optional[float] = None
    compression: Optional[CompressionResults] = None


class DisplacementResponse(ResponseBase):
    normalized_inputs: DisplacementNormalizedInputs
    results: DisplacementResults
