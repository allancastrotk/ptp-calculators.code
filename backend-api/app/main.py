from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.calculators.displacement import classify_geometry, calculate_displacement_cc
from app.core.security import require_internal_key
from app.core.units import cc_to_cuin, cc_to_liters, inches_to_mm
from app.schemas.common import ErrorResponse
from app.schemas.displacement import (
    DisplacementRequest,
    DisplacementResponse,
    DisplacementNormalizedInputs,
    DisplacementResults,
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
