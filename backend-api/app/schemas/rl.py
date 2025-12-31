from typing import Optional

from pydantic import BaseModel, confloat

from app.schemas.common import RequestBase, ResponseBase


class RLBaselineInputs(BaseModel):
    bore: confloat(gt=0)
    stroke: confloat(gt=0)
    rod_length: confloat(gt=0)


class RLInputs(BaseModel):
    bore: confloat(gt=0)
    stroke: confloat(gt=0)
    rod_length: confloat(gt=0)
    baseline: Optional[RLBaselineInputs] = None


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
    diff_percent_rl: Optional[float] = None
    diff_percent_displacement: Optional[float] = None


class RLResponse(ResponseBase):
    normalized_inputs: RLNormalizedInputs
    results: RLResults


RLNormalizedInputs.model_rebuild()
