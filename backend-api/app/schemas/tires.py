from typing import Optional, Literal

from pydantic import BaseModel, confloat, model_validator

from app.schemas.common import RequestBase, ResponseBase

VehicleType = Literal["Car", "Motorcycle", "LightTruck", "TruckCommercial"]


class TiresBaselineInputs(BaseModel):
    vehicle_type: VehicleType
    rim_in: confloat(gt=0)
    width_mm: Optional[confloat(gt=0)] = None
    aspect_percent: Optional[confloat(ge=10, le=100)] = None
    flotation: Optional[str] = None
    rim_width_in: Optional[confloat(gt=0)] = None

    @model_validator(mode="after")
    def validate_required_fields(self):
        if not self.flotation:
            if self.width_mm is None:
                raise ValueError("width_mm required when flotation is not provided")
            if self.aspect_percent is None:
                raise ValueError("aspect_percent required when flotation is not provided")
        return self


class TiresInputs(BaseModel):
    vehicle_type: VehicleType
    rim_in: confloat(gt=0)
    width_mm: Optional[confloat(gt=0)] = None
    aspect_percent: Optional[confloat(ge=10, le=100)] = None
    flotation: Optional[str] = None
    rim_width_in: Optional[confloat(gt=0)] = None
    baseline: Optional[TiresBaselineInputs] = None

    @model_validator(mode="after")
    def validate_required_fields(self):
        if not self.flotation:
            if self.width_mm is None:
                raise ValueError("width_mm required when flotation is not provided")
            if self.aspect_percent is None:
                raise ValueError("aspect_percent required when flotation is not provided")
        return self


class TiresRequest(RequestBase):
    inputs: TiresInputs


class TiresNormalizedInputs(BaseModel):
    vehicle_type: VehicleType
    rim_in: float
    width_mm: Optional[float] = None
    aspect_percent: Optional[float] = None
    flotation: Optional[str] = None
    rim_width_in: Optional[float] = None
    baseline: Optional["TiresNormalizedInputs"] = None


class TiresResults(BaseModel):
    diameter: float
    width: float
    diff_diameter: Optional[float] = None
    diff_diameter_percent: Optional[float] = None
    diff_width: Optional[float] = None
    diff_width_percent: Optional[float] = None


class TiresResponse(ResponseBase):
    normalized_inputs: TiresNormalizedInputs
    results: TiresResults


TiresNormalizedInputs.model_rebuild()
