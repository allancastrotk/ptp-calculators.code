from typing import Optional

from pydantic import BaseModel, conint

from app.schemas.common import RequestBase, ResponseBase


class SprocketBaselineInputs(BaseModel):
    sprocket_teeth: conint(gt=0)
    crown_teeth: conint(gt=0)
    chain_pitch: Optional[str] = None
    chain_links: Optional[conint(gt=0)] = None


class SprocketInputs(BaseModel):
    sprocket_teeth: conint(gt=0)
    crown_teeth: conint(gt=0)
    chain_pitch: Optional[str] = None
    chain_links: Optional[conint(gt=0)] = None
    baseline: Optional[SprocketBaselineInputs] = None


class SprocketRequest(RequestBase):
    inputs: SprocketInputs


class SprocketNormalizedInputs(BaseModel):
    sprocket_teeth: int
    crown_teeth: int
    chain_pitch: Optional[str] = None
    chain_links: Optional[int] = None
    baseline: Optional["SprocketNormalizedInputs"] = None


class SprocketResults(BaseModel):
    ratio: float
    chain_length_mm: Optional[float] = None
    chain_length_in: Optional[float] = None
    center_distance_mm: Optional[float] = None
    center_distance_in: Optional[float] = None
    diff_ratio_percent: Optional[float] = None
    diff_ratio_absolute: Optional[float] = None
    diff_chain_length_percent: Optional[float] = None
    diff_chain_length_absolute: Optional[float] = None
    diff_center_distance_percent: Optional[float] = None
    diff_center_distance_absolute: Optional[float] = None


class SprocketResponse(ResponseBase):
    normalized_inputs: SprocketNormalizedInputs
    results: SprocketResults


SprocketNormalizedInputs.model_rebuild()
