from typing import Optional

from pydantic import BaseModel, confloat

from app.schemas.common import RequestBase, ResponseBase


class RLInputs(BaseModel):
    stroke: confloat(gt=0)
    rod_length: confloat(gt=0)
    bore: Optional[confloat(gt=0)] = None


class RLRequest(RequestBase):
    inputs: RLInputs


class RLNormalizedInputs(BaseModel):
    stroke_mm: float
    rod_length_mm: float
    bore_mm: Optional[float] = None


class RLResults(BaseModel):
    rl_ratio: float
    rod_stroke_ratio: float


class RLResponse(ResponseBase):
    normalized_inputs: RLNormalizedInputs
    results: RLResults
