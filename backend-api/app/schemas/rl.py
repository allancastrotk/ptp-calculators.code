from typing import Optional

from pydantic import BaseModel, confloat

from app.schemas.common import RequestBase, ResponseBase


class RLInputs(BaseModel):
    bore: confloat(gt=0)
    stroke: confloat(gt=0)
    rod_length: confloat(gt=0)
    baseline: Optional["RLBaselineInputs"] = None


class RLBaselineInputs(BaseModel):
    bore: confloat(gt=0)
    stroke: confloat(gt=0)
    rod_length: confloat(gt=0)


class RLRequest(RequestBase):
    inputs: RLInputs


class RLNormalizedInputs(BaseModel):
    bore_mm: float
    stroke_mm: float
    rod_length_mm: float
    baseline: Optional["RLNormalizedInputs"] = None


class RLResults(BaseModel):
    rl_ratio: float
    rod_stroke_ratio: float
    displacement_cc: float
    geometry: str
    smoothness: str
    diff_rl_percent: Optional[float] = None
    diff_displacement_percent: Optional[float] = None


class RLResponse(ResponseBase):
    normalized_inputs: RLNormalizedInputs
    results: RLResults


RLNormalizedInputs.model_rebuild()
