from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.calculators.displacement import classify_geometry, calculate_displacement_cc
from app.calculators.rl import calculate_rl_ratio, calculate_rod_stroke_ratio
from app.calculators.sprocket import (
    calculate_center_distance_mm,
    calculate_chain_length_mm,
    calculate_ratio,
    chain_pitch_to_mm,
)
from app.core.security import require_internal_key
from app.core.units import cc_to_cuin, cc_to_liters, inches_to_mm, mm_to_inches
from app.schemas.common import ErrorResponse
from app.schemas.displacement import (
    DisplacementRequest,
    DisplacementResponse,
    DisplacementNormalizedInputs,
    DisplacementResults,
)
from app.schemas.rl import RLRequest, RLResponse, RLNormalizedInputs, RLResults
from app.schemas.sprocket import (
    SprocketRequest,
    SprocketResponse,
    SprocketNormalizedInputs,
    SprocketResults,
)

app = FastAPI(title="PowerTunePro Calculators - Backend")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_errors = []
    for error in exc.errors():
        loc = ".".join(str(item) for item in error.get("loc", []) if item != "body")
        field_errors.append(
            {
                "field": loc.replace("inputs.", "inputs."),
                "reason": error.get("msg", "invalid value"),
            }
        )
    response = ErrorResponse(
        error_code="validation_error",
        message="Invalid request payload.",
        field_errors=field_errors,
    )
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())


@app.post(
    "/v1/calc/displacement",
    response_model=DisplacementResponse,
    dependencies=[Depends(require_internal_key)],
)
def calc_displacement(payload: DisplacementRequest):
    warnings: list[str] = []
    resolved_unit_system = payload.unit_system
    if payload.unit_system == "auto":
        resolved_unit_system = "metric"
        warnings.append("unit_system set to auto; assuming metric inputs.")

    bore = payload.inputs.bore
    stroke = payload.inputs.stroke
    cylinders = payload.inputs.cylinders
    baseline_cc = payload.inputs.baseline_cc

    if resolved_unit_system == "imperial":
        bore_mm = inches_to_mm(bore)
        stroke_mm = inches_to_mm(stroke)
    else:
        bore_mm = bore
        stroke_mm = stroke

    displacement_cc_raw = calculate_displacement_cc(bore_mm, stroke_mm, cylinders)
    geometry = classify_geometry(bore_mm, stroke_mm)

    diff_percent = None
    if baseline_cc is not None:
        diff_percent = (displacement_cc_raw - baseline_cc) / baseline_cc * 100.0

    results = DisplacementResults(
        displacement_cc=round(displacement_cc_raw, 2),
        displacement_l=round(cc_to_liters(displacement_cc_raw), 2),
        displacement_ci=round(cc_to_cuin(displacement_cc_raw), 2),
        geometry=geometry,
        diff_percent=round(diff_percent, 2) if diff_percent is not None else None,
    )

    normalized_inputs = DisplacementNormalizedInputs(
        bore_mm=bore_mm,
        stroke_mm=stroke_mm,
        cylinders=cylinders,
        baseline_cc=baseline_cc,
    )

    return DisplacementResponse(
        calculator="displacement",
        unit_system="imperial" if resolved_unit_system == "imperial" else "metric",
        normalized_inputs=normalized_inputs,
        results=results,
        warnings=warnings,
    )


@app.post(
    "/v1/calc/rl",
    response_model=RLResponse,
    dependencies=[Depends(require_internal_key)],
)
def calc_rl(payload: RLRequest):
    warnings: list[str] = []
    resolved_unit_system = payload.unit_system
    if payload.unit_system == "auto":
        resolved_unit_system = "metric"
        warnings.append("unit_system set to auto; assuming metric inputs.")

    stroke = payload.inputs.stroke
    rod_length = payload.inputs.rod_length
    bore = payload.inputs.bore

    if resolved_unit_system == "imperial":
        stroke_mm = inches_to_mm(stroke)
        rod_length_mm = inches_to_mm(rod_length)
        bore_mm = inches_to_mm(bore) if bore is not None else None
    else:
        stroke_mm = stroke
        rod_length_mm = rod_length
        bore_mm = bore

    rl_ratio = calculate_rl_ratio(stroke_mm, rod_length_mm)
    rod_stroke_ratio = calculate_rod_stroke_ratio(stroke_mm, rod_length_mm)

    results = RLResults(
        rl_ratio=round(rl_ratio, 2),
        rod_stroke_ratio=round(rod_stroke_ratio, 2),
    )

    normalized_inputs = RLNormalizedInputs(
        stroke_mm=stroke_mm,
        rod_length_mm=rod_length_mm,
        bore_mm=bore_mm,
    )

    return RLResponse(
        calculator="rl",
        unit_system="imperial" if resolved_unit_system == "imperial" else "metric",
        normalized_inputs=normalized_inputs,
        results=results,
        warnings=warnings,
    )


@app.post(
    "/v1/calc/sprocket",
    response_model=SprocketResponse,
    dependencies=[Depends(require_internal_key)],
)
def calc_sprocket(payload: SprocketRequest):
    warnings: list[str] = []
    resolved_unit_system = payload.unit_system
    if payload.unit_system == "auto":
        resolved_unit_system = "metric"
        warnings.append("unit_system set to auto; assuming metric inputs.")

    sprocket_teeth = payload.inputs.sprocket_teeth
    crown_teeth = payload.inputs.crown_teeth
    chain_pitch = payload.inputs.chain_pitch
    chain_links = payload.inputs.chain_links
    baseline = payload.inputs.baseline

    errors = []
    if chain_pitch is not None and chain_pitch_to_mm(chain_pitch) is None:
        errors.append({"field": "inputs.chain_pitch", "reason": "invalid chain pitch"})
    if chain_links is not None and chain_links % 2 != 0:
        errors.append({"field": "inputs.chain_links", "reason": "must be an even integer"})
    if errors:
        response = ErrorResponse(
            error_code="validation_error",
            message="Invalid request payload.",
            field_errors=errors,
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

    ratio = calculate_ratio(crown_teeth, sprocket_teeth)

    chain_length_mm = None
    center_distance_mm = None
    if chain_pitch and chain_links:
        pitch_mm = chain_pitch_to_mm(chain_pitch)
        if pitch_mm:
            chain_length_mm = calculate_chain_length_mm(chain_links, pitch_mm)
            wear_factor = 0.98 if baseline else 1.0
            center_distance_mm = calculate_center_distance_mm(
                sprocket_teeth, crown_teeth, pitch_mm, chain_links, wear_factor
            )

    diff_ratio_percent = None
    diff_ratio_absolute = None
    diff_chain_length_percent = None
    diff_chain_length_absolute = None
    diff_center_distance_percent = None
    diff_center_distance_absolute = None
    baseline_normalized = None
    if baseline is not None:
        baseline_ratio = calculate_ratio(baseline.crown_teeth, baseline.sprocket_teeth)
        diff_ratio_absolute = ratio - baseline_ratio
        diff_ratio_percent = (diff_ratio_absolute / baseline_ratio) * 100.0

        baseline_chain_length_mm = None
        baseline_center_distance_mm = None
        if baseline.chain_pitch and baseline.chain_links:
            baseline_pitch_mm = chain_pitch_to_mm(baseline.chain_pitch)
            if baseline_pitch_mm:
                baseline_chain_length_mm = calculate_chain_length_mm(
                    baseline.chain_links, baseline_pitch_mm
                )
                baseline_center_distance_mm = calculate_center_distance_mm(
                    baseline.sprocket_teeth,
                    baseline.crown_teeth,
                    baseline_pitch_mm,
                    baseline.chain_links,
                    1.0,
                )

        if chain_length_mm and baseline_chain_length_mm:
            diff_chain_length_absolute = chain_length_mm - baseline_chain_length_mm
            diff_chain_length_percent = (
                diff_chain_length_absolute / baseline_chain_length_mm * 100.0
            )
        if center_distance_mm and baseline_center_distance_mm:
            diff_center_distance_absolute = center_distance_mm - baseline_center_distance_mm
            diff_center_distance_percent = (
                diff_center_distance_absolute / baseline_center_distance_mm * 100.0
            )

        baseline_normalized = SprocketNormalizedInputs(
            sprocket_teeth=baseline.sprocket_teeth,
            crown_teeth=baseline.crown_teeth,
            chain_pitch=baseline.chain_pitch,
            chain_links=baseline.chain_links,
            baseline=None,
        )

    results = SprocketResults(
        ratio=round(ratio, 2),
        chain_length_mm=round(chain_length_mm, 2) if chain_length_mm is not None else None,
        chain_length_in=round(mm_to_inches(chain_length_mm), 2)
        if chain_length_mm is not None
        else None,
        center_distance_mm=round(center_distance_mm, 2)
        if center_distance_mm is not None
        else None,
        center_distance_in=round(mm_to_inches(center_distance_mm), 2)
        if center_distance_mm is not None
        else None,
        diff_ratio_percent=round(diff_ratio_percent, 2) if diff_ratio_percent is not None else None,
        diff_ratio_absolute=round(diff_ratio_absolute, 2)
        if diff_ratio_absolute is not None
        else None,
        diff_chain_length_percent=round(diff_chain_length_percent, 2)
        if diff_chain_length_percent is not None
        else None,
        diff_chain_length_absolute=round(diff_chain_length_absolute, 2)
        if diff_chain_length_absolute is not None
        else None,
        diff_center_distance_percent=round(diff_center_distance_percent, 2)
        if diff_center_distance_percent is not None
        else None,
        diff_center_distance_absolute=round(diff_center_distance_absolute, 2)
        if diff_center_distance_absolute is not None
        else None,
    )

    normalized_inputs = SprocketNormalizedInputs(
        sprocket_teeth=sprocket_teeth,
        crown_teeth=crown_teeth,
        chain_pitch=chain_pitch,
        chain_links=chain_links,
        baseline=baseline_normalized,
    )

    return SprocketResponse(
        calculator="sprocket",
        unit_system="imperial" if resolved_unit_system == "imperial" else "metric",
        normalized_inputs=normalized_inputs,
        results=results,
        warnings=warnings,
    )
