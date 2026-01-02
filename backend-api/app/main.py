from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.calculators.common import percent_diff
from app.calculators.compression import (
    swept_volume_cc,
    gasket_volume_cc,
    deck_volume_cc,
    clearance_volume_cc,
    compression_ratio,
    trapped_swept_volume_cc,
)
from app.calculators.displacement import classify_geometry, calculate_displacement_cc
from app.calculators.rl import (
    calculate_rl_ratio,
    calculate_rod_stroke_ratio,
    classify_smoothness,
)
from app.calculators.sprocket import (
    calculate_center_distance_mm,
    calculate_chain_length_mm,
    calculate_ratio,
    chain_pitch_to_mm,
)
from app.calculators.tires import (
    calculate_assembly_width_mm,
    calculate_diameter_mm,
    parse_flotation,
    parse_motorcycle_flotation,
)
from app.data.tires_db import TIRES_DB
from app.core.security import require_internal_key
from app.core.units import (
    cc_to_cuin,
    cc_to_liters,
    inches_to_mm,
    mm_to_inches,
    resolve_unit_system,
    cuin_to_cc,
)
from app.schemas.common import ErrorResponse
from app.schemas.displacement import (
    DisplacementRequest,
    DisplacementResponse,
    DisplacementNormalizedInputs,
    DisplacementResults,
)
from app.schemas.compression import CompressionNormalizedInputs, CompressionResults
from app.schemas.rl import RLRequest, RLResponse, RLNormalizedInputs, RLResults
from app.schemas.sprocket import (
    SprocketRequest,
    SprocketResponse,
    SprocketNormalizedInputs,
    SprocketResults,
)
from app.schemas.tires import TiresRequest, TiresResponse, TiresNormalizedInputs, TiresResults

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
    resolved_unit_system, warnings = resolve_unit_system(payload.unit_system)

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
        diff_percent = percent_diff(displacement_cc_raw, baseline_cc)

    compression_results = None
    if payload.inputs.compression:
        compression = payload.inputs.compression
        mode = compression.mode
        has_advanced_fields = any(
            value is not None
            for value in [
                compression.gasket_thickness,
                compression.gasket_bore,
                compression.deck_height,
                compression.piston_volume,
            ]
        )
        if mode is None:
            mode = "advanced" if has_advanced_fields else "simple"
        chamber_cc = compression.chamber_volume
        gasket_thickness_mm = compression.gasket_thickness
        gasket_bore_mm = compression.gasket_bore
        deck_height_mm = compression.deck_height
        piston_volume_cc = compression.piston_volume
        exhaust_height_mm = compression.exhaust_port_height
        transfer_height_mm = compression.transfer_port_height
        crankcase_volume_cc = compression.crankcase_volume

        if resolved_unit_system == "imperial":
            chamber_cc = cuin_to_cc(chamber_cc)
            if piston_volume_cc is not None:
                piston_volume_cc = cuin_to_cc(piston_volume_cc)
            if mode == "advanced":
                if gasket_thickness_mm is not None:
                    gasket_thickness_mm = inches_to_mm(gasket_thickness_mm)
                if gasket_bore_mm is not None:
                    gasket_bore_mm = inches_to_mm(gasket_bore_mm)
                if deck_height_mm is not None:
                    deck_height_mm = inches_to_mm(deck_height_mm)
            if exhaust_height_mm is not None:
                exhaust_height_mm = inches_to_mm(exhaust_height_mm)
            if transfer_height_mm is not None:
                transfer_height_mm = inches_to_mm(transfer_height_mm)
            if crankcase_volume_cc is not None:
                crankcase_volume_cc = cuin_to_cc(crankcase_volume_cc)

        if mode == "simple":
            gasket_thickness_mm = 0.0
            gasket_bore_mm = bore_mm
            deck_height_mm = 0.0
            piston_volume_cc = 0.0

        if chamber_cc <= 0:
            response = ErrorResponse(
                error_code="validation_error",
                message="Invalid request payload.",
                field_errors=[
                    {"field": "inputs.compression", "reason": "invalid compression inputs"}
                ],
            )
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

        if mode == "advanced":
            if (
                gasket_thickness_mm is None
                or gasket_bore_mm is None
                or deck_height_mm is None
                or piston_volume_cc is None
            ):
                response = ErrorResponse(
                    error_code="validation_error",
                    message="Invalid request payload.",
                    field_errors=[
                        {"field": "inputs.compression", "reason": "missing advanced inputs"}
                    ],
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump()
                )
            if gasket_thickness_mm <= 0 or gasket_bore_mm <= 0:
                response = ErrorResponse(
                    error_code="validation_error",
                    message="Invalid request payload.",
                    field_errors=[
                        {
                            "field": "inputs.compression",
                            "reason": "invalid compression inputs",
                        }
                    ],
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump()
                )

        gasket_thickness_mm = gasket_thickness_mm or 0.0
        gasket_bore_mm = gasket_bore_mm or bore_mm
        deck_height_mm = deck_height_mm or 0.0
        piston_volume_cc = piston_volume_cc or 0.0

        gasket_cc = gasket_volume_cc(gasket_bore_mm, gasket_thickness_mm)
        deck_cc = deck_volume_cc(bore_mm, deck_height_mm)
        clearance_cc = clearance_volume_cc(chamber_cc, gasket_cc, deck_cc, piston_volume_cc)
        if clearance_cc <= 0:
            response = ErrorResponse(
                error_code="validation_error",
                message="Invalid request payload.",
                field_errors=[
                    {"field": "inputs.compression", "reason": "clearance volume must be positive"}
                ],
            )
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

        swept_cc = swept_volume_cc(bore_mm, stroke_mm)
        compression_mode = "four_stroke"
        trapped_cc = None

        port_heights = [value for value in [exhaust_height_mm, transfer_height_mm] if value]
        if port_heights:
            port_height_mm = min(port_heights)
            if port_height_mm <= 0 or port_height_mm >= stroke_mm:
                response = ErrorResponse(
                    error_code="validation_error",
                    message="Invalid request payload.",
                    field_errors=[
                        {
                            "field": "inputs.compression",
                            "reason": "invalid port height for 2T compression",
                        }
                    ],
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump()
                )
            compression_mode = "two_stroke"
            trapped_cc = trapped_swept_volume_cc(bore_mm, stroke_mm, port_height_mm)
            swept_for_ratio = trapped_cc
        else:
            swept_for_ratio = swept_cc

        ratio = compression_ratio(swept_for_ratio, clearance_cc)
        crankcase_ratio = None
        if compression_mode == "two_stroke" and crankcase_volume_cc:
            crankcase_ratio = compression_ratio(swept_cc, crankcase_volume_cc)

        if resolved_unit_system == "imperial":
            swept_out = cc_to_cuin(swept_cc)
            clearance_out = cc_to_cuin(clearance_cc)
            trapped_out = cc_to_cuin(trapped_cc) if trapped_cc is not None else None
        else:
            swept_out = swept_cc
            clearance_out = clearance_cc
            trapped_out = trapped_cc

        compression_results = CompressionResults(
            compression_ratio=round(ratio, 2),
            clearance_volume=round(clearance_out, 2),
            swept_volume=round(swept_out, 2),
            trapped_volume=round(trapped_out, 2) if trapped_out is not None else None,
            crankcase_compression_ratio=round(crankcase_ratio, 2)
            if crankcase_ratio is not None
            else None,
            compression_mode=compression_mode,
        )

    results = DisplacementResults(
        displacement_cc=round(displacement_cc_raw, 2),
        displacement_l=round(cc_to_liters(displacement_cc_raw), 2),
        displacement_ci=round(cc_to_cuin(displacement_cc_raw), 2),
        geometry=geometry,
        diff_percent=round(diff_percent, 2) if diff_percent is not None else None,
        compression=compression_results,
    )

    compression_normalized = None
    if payload.inputs.compression:
        compression = payload.inputs.compression
        mode = compression.mode
        has_advanced_fields = any(
            value is not None
            for value in [
                compression.gasket_thickness,
                compression.gasket_bore,
                compression.deck_height,
                compression.piston_volume,
            ]
        )
        if mode is None:
            mode = "advanced" if has_advanced_fields else "simple"
        chamber_cc = compression.chamber_volume
        gasket_thickness_mm = compression.gasket_thickness
        gasket_bore_mm = compression.gasket_bore
        deck_height_mm = compression.deck_height
        piston_volume_cc = compression.piston_volume
        exhaust_height_mm = compression.exhaust_port_height
        transfer_height_mm = compression.transfer_port_height
        crankcase_volume_cc = compression.crankcase_volume

        if resolved_unit_system == "imperial":
            chamber_cc = cuin_to_cc(chamber_cc)
            if piston_volume_cc is not None:
                piston_volume_cc = cuin_to_cc(piston_volume_cc)
            if mode == "advanced":
                if gasket_thickness_mm is not None:
                    gasket_thickness_mm = inches_to_mm(gasket_thickness_mm)
                if gasket_bore_mm is not None:
                    gasket_bore_mm = inches_to_mm(gasket_bore_mm)
                if deck_height_mm is not None:
                    deck_height_mm = inches_to_mm(deck_height_mm)
            if exhaust_height_mm is not None:
                exhaust_height_mm = inches_to_mm(exhaust_height_mm)
            if transfer_height_mm is not None:
                transfer_height_mm = inches_to_mm(transfer_height_mm)
            if crankcase_volume_cc is not None:
                crankcase_volume_cc = cuin_to_cc(crankcase_volume_cc)

        if mode == "simple":
            gasket_thickness_mm = 0.0
            gasket_bore_mm = bore_mm
            deck_height_mm = 0.0
            piston_volume_cc = 0.0

        compression_normalized = CompressionNormalizedInputs(
            mode=mode,
            chamber_volume=chamber_cc,
            gasket_thickness=gasket_thickness_mm or 0.0,
            gasket_bore=gasket_bore_mm or bore_mm,
            deck_height=deck_height_mm or 0.0,
            piston_volume=piston_volume_cc or 0.0,
            exhaust_port_height=exhaust_height_mm,
            transfer_port_height=transfer_height_mm,
            crankcase_volume=crankcase_volume_cc,
        )

    normalized_inputs = DisplacementNormalizedInputs(
        bore_mm=bore_mm,
        stroke_mm=stroke_mm,
        cylinders=cylinders,
        baseline_cc=baseline_cc,
        compression=compression_normalized,
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
    resolved_unit_system, warnings = resolve_unit_system(payload.unit_system)

    stroke = payload.inputs.stroke
    rod_length = payload.inputs.rod_length
    bore = payload.inputs.bore
    baseline = payload.inputs.baseline

    if resolved_unit_system == "imperial":
        stroke_mm = inches_to_mm(stroke)
        rod_length_mm = inches_to_mm(rod_length)
        bore_mm = inches_to_mm(bore)
    else:
        stroke_mm = stroke
        rod_length_mm = rod_length
        bore_mm = bore

    rl_ratio = calculate_rl_ratio(stroke_mm, rod_length_mm)
    rod_stroke_ratio = calculate_rod_stroke_ratio(stroke_mm, rod_length_mm)
    displacement_cc_raw = calculate_displacement_cc(bore_mm, stroke_mm, 1)
    geometry = classify_geometry(bore_mm, stroke_mm)
    smoothness = classify_smoothness(rl_ratio)

    diff_rl_percent = None
    diff_displacement_percent = None
    baseline_normalized = None
    if baseline is not None:
        if resolved_unit_system == "imperial":
            baseline_bore_mm = inches_to_mm(baseline.bore)
            baseline_stroke_mm = inches_to_mm(baseline.stroke)
            baseline_rod_mm = inches_to_mm(baseline.rod_length)
        else:
            baseline_bore_mm = baseline.bore
            baseline_stroke_mm = baseline.stroke
            baseline_rod_mm = baseline.rod_length

        baseline_rl = calculate_rl_ratio(baseline_stroke_mm, baseline_rod_mm)
        baseline_displacement_cc = calculate_displacement_cc(
            baseline_bore_mm, baseline_stroke_mm, 1
        )
        diff_rl_percent = percent_diff(rl_ratio, baseline_rl)
        diff_displacement_percent = percent_diff(displacement_cc_raw, baseline_displacement_cc)

        baseline_normalized = RLNormalizedInputs(
            bore_mm=baseline_bore_mm,
            stroke_mm=baseline_stroke_mm,
            rod_length_mm=baseline_rod_mm,
            baseline=None,
        )

    compression_results = None
    if payload.inputs.compression:
        compression = payload.inputs.compression
        mode = compression.mode
        has_advanced_fields = any(
            value is not None
            for value in [
                compression.gasket_thickness,
                compression.gasket_bore,
                compression.deck_height,
                compression.piston_volume,
            ]
        )
        if mode is None:
            mode = "advanced" if has_advanced_fields else "simple"
        chamber_cc = compression.chamber_volume
        gasket_thickness_mm = compression.gasket_thickness
        gasket_bore_mm = compression.gasket_bore
        deck_height_mm = compression.deck_height
        piston_volume_cc = compression.piston_volume
        exhaust_height_mm = compression.exhaust_port_height
        transfer_height_mm = compression.transfer_port_height
        crankcase_volume_cc = compression.crankcase_volume

        if resolved_unit_system == "imperial":
            chamber_cc = cuin_to_cc(chamber_cc)
            if piston_volume_cc is not None:
                piston_volume_cc = cuin_to_cc(piston_volume_cc)
            if mode == "advanced":
                if gasket_thickness_mm is not None:
                    gasket_thickness_mm = inches_to_mm(gasket_thickness_mm)
                if gasket_bore_mm is not None:
                    gasket_bore_mm = inches_to_mm(gasket_bore_mm)
                if deck_height_mm is not None:
                    deck_height_mm = inches_to_mm(deck_height_mm)
            if exhaust_height_mm is not None:
                exhaust_height_mm = inches_to_mm(exhaust_height_mm)
            if transfer_height_mm is not None:
                transfer_height_mm = inches_to_mm(transfer_height_mm)
            if crankcase_volume_cc is not None:
                crankcase_volume_cc = cuin_to_cc(crankcase_volume_cc)

        if mode == "simple":
            gasket_thickness_mm = 0.0
            gasket_bore_mm = bore_mm
            deck_height_mm = 0.0
            piston_volume_cc = 0.0

        if chamber_cc <= 0:
            response = ErrorResponse(
                error_code="validation_error",
                message="Invalid request payload.",
                field_errors=[
                    {"field": "inputs.compression", "reason": "invalid compression inputs"}
                ],
            )
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

        if mode == "advanced":
            if (
                gasket_thickness_mm is None
                or gasket_bore_mm is None
                or deck_height_mm is None
                or piston_volume_cc is None
            ):
                response = ErrorResponse(
                    error_code="validation_error",
                    message="Invalid request payload.",
                    field_errors=[
                        {"field": "inputs.compression", "reason": "missing advanced inputs"}
                    ],
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump()
                )
            if gasket_thickness_mm <= 0 or gasket_bore_mm <= 0:
                response = ErrorResponse(
                    error_code="validation_error",
                    message="Invalid request payload.",
                    field_errors=[
                        {
                            "field": "inputs.compression",
                            "reason": "invalid compression inputs",
                        }
                    ],
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump()
                )

        gasket_thickness_mm = gasket_thickness_mm or 0.0
        gasket_bore_mm = gasket_bore_mm or bore_mm
        deck_height_mm = deck_height_mm or 0.0
        piston_volume_cc = piston_volume_cc or 0.0

        gasket_cc = gasket_volume_cc(gasket_bore_mm, gasket_thickness_mm)
        deck_cc = deck_volume_cc(bore_mm, deck_height_mm)
        clearance_cc = clearance_volume_cc(chamber_cc, gasket_cc, deck_cc, piston_volume_cc)
        if clearance_cc <= 0:
            response = ErrorResponse(
                error_code="validation_error",
                message="Invalid request payload.",
                field_errors=[
                    {"field": "inputs.compression", "reason": "clearance volume must be positive"}
                ],
            )
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

        swept_cc = swept_volume_cc(bore_mm, stroke_mm)
        compression_mode = "four_stroke"
        trapped_cc = None

        port_heights = [value for value in [exhaust_height_mm, transfer_height_mm] if value]
        if port_heights:
            port_height_mm = min(port_heights)
            if port_height_mm <= 0 or port_height_mm >= stroke_mm:
                response = ErrorResponse(
                    error_code="validation_error",
                    message="Invalid request payload.",
                    field_errors=[
                        {
                            "field": "inputs.compression",
                            "reason": "invalid port height for 2T compression",
                        }
                    ],
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump()
                )
            compression_mode = "two_stroke"
            trapped_cc = trapped_swept_volume_cc(bore_mm, stroke_mm, port_height_mm)
            swept_for_ratio = trapped_cc
        else:
            swept_for_ratio = swept_cc

        ratio = compression_ratio(swept_for_ratio, clearance_cc)
        crankcase_ratio = None
        if compression_mode == "two_stroke" and crankcase_volume_cc:
            crankcase_ratio = compression_ratio(swept_cc, crankcase_volume_cc)

        if resolved_unit_system == "imperial":
            swept_out = cc_to_cuin(swept_cc)
            clearance_out = cc_to_cuin(clearance_cc)
            trapped_out = cc_to_cuin(trapped_cc) if trapped_cc is not None else None
        else:
            swept_out = swept_cc
            clearance_out = clearance_cc
            trapped_out = trapped_cc

        compression_results = CompressionResults(
            compression_ratio=round(ratio, 2),
            clearance_volume=round(clearance_out, 2),
            swept_volume=round(swept_out, 2),
            trapped_volume=round(trapped_out, 2) if trapped_out is not None else None,
            crankcase_compression_ratio=round(crankcase_ratio, 2)
            if crankcase_ratio is not None
            else None,
            compression_mode=compression_mode,
        )

    results = RLResults(
        rl_ratio=round(rl_ratio, 2),
        rod_stroke_ratio=round(rod_stroke_ratio, 2),
        displacement_cc=round(displacement_cc_raw, 2),
        geometry=geometry,
        smoothness=smoothness,
        diff_rl_percent=round(diff_rl_percent, 2) if diff_rl_percent is not None else None,
        diff_displacement_percent=round(diff_displacement_percent, 2)
        if diff_displacement_percent is not None
        else None,
        compression=compression_results,
    )

    compression_normalized = None
    if payload.inputs.compression:
        compression = payload.inputs.compression
        mode = compression.mode
        has_advanced_fields = any(
            value is not None
            for value in [
                compression.gasket_thickness,
                compression.gasket_bore,
                compression.deck_height,
                compression.piston_volume,
            ]
        )
        if mode is None:
            mode = "advanced" if has_advanced_fields else "simple"
        chamber_cc = compression.chamber_volume
        gasket_thickness_mm = compression.gasket_thickness
        gasket_bore_mm = compression.gasket_bore
        deck_height_mm = compression.deck_height
        piston_volume_cc = compression.piston_volume
        exhaust_height_mm = compression.exhaust_port_height
        transfer_height_mm = compression.transfer_port_height
        crankcase_volume_cc = compression.crankcase_volume

        if resolved_unit_system == "imperial":
            chamber_cc = cuin_to_cc(chamber_cc)
            if piston_volume_cc is not None:
                piston_volume_cc = cuin_to_cc(piston_volume_cc)
            if mode == "advanced":
                if gasket_thickness_mm is not None:
                    gasket_thickness_mm = inches_to_mm(gasket_thickness_mm)
                if gasket_bore_mm is not None:
                    gasket_bore_mm = inches_to_mm(gasket_bore_mm)
                if deck_height_mm is not None:
                    deck_height_mm = inches_to_mm(deck_height_mm)
            if exhaust_height_mm is not None:
                exhaust_height_mm = inches_to_mm(exhaust_height_mm)
            if transfer_height_mm is not None:
                transfer_height_mm = inches_to_mm(transfer_height_mm)
            if crankcase_volume_cc is not None:
                crankcase_volume_cc = cuin_to_cc(crankcase_volume_cc)

        if mode == "simple":
            gasket_thickness_mm = 0.0
            gasket_bore_mm = bore_mm
            deck_height_mm = 0.0
            piston_volume_cc = 0.0

        compression_normalized = CompressionNormalizedInputs(
            mode=mode,
            chamber_volume=chamber_cc,
            gasket_thickness=gasket_thickness_mm or 0.0,
            gasket_bore=gasket_bore_mm or bore_mm,
            deck_height=deck_height_mm or 0.0,
            piston_volume=piston_volume_cc or 0.0,
            exhaust_port_height=exhaust_height_mm,
            transfer_port_height=transfer_height_mm,
            crankcase_volume=crankcase_volume_cc,
        )

    normalized_inputs = RLNormalizedInputs(
        bore_mm=bore_mm,
        stroke_mm=stroke_mm,
        rod_length_mm=rod_length_mm,
        baseline=baseline_normalized,
        compression=compression_normalized,
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
    resolved_unit_system, warnings = resolve_unit_system(payload.unit_system)

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
        diff_ratio_percent = percent_diff(ratio, baseline_ratio)

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
            diff_chain_length_percent = percent_diff(
                chain_length_mm, baseline_chain_length_mm
            )
        if center_distance_mm and baseline_center_distance_mm:
            diff_center_distance_absolute = center_distance_mm - baseline_center_distance_mm
            diff_center_distance_percent = percent_diff(
                center_distance_mm, baseline_center_distance_mm
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


@app.post(
    "/v1/calc/tires",
    response_model=TiresResponse,
    dependencies=[Depends(require_internal_key)],
)
def calc_tires(payload: TiresRequest):
    resolved_unit_system, warnings = resolve_unit_system(payload.unit_system)

    inputs = payload.inputs
    errors = []

    def rim_key(value: float) -> str:
        return str(int(value)) if float(value).is_integer() else str(value)

    def width_key(value: float) -> str:
        return str(int(value)) if float(value).is_integer() else str(value)

    def validate_against_db(source, prefix: str) -> list[dict]:
        issues: list[dict] = []
        vehicle_db = TIRES_DB.get(source.vehicle_type)
        if not vehicle_db:
            issues.append({"field": f"{prefix}vehicle_type", "reason": "invalid vehicle type"})
            return issues

        rim_str = rim_key(source.rim_in)
        if rim_str not in vehicle_db:
            issues.append({"field": f"{prefix}rim_in", "reason": "invalid rim"})
            return issues

        if source.flotation:
            flotation_options: list[str] = []
            for width in vehicle_db[rim_str]["widths"]:
                flotation_options.extend(vehicle_db[rim_str].get(width, {}).get("flotation", []))
            if source.flotation not in flotation_options:
                issues.append({"field": f"{prefix}flotation", "reason": "invalid flotation option"})
            return issues

        width_str = width_key(source.width_mm)  # type: ignore[arg-type]
        if width_str not in vehicle_db[rim_str]["widths"]:
            issues.append({"field": f"{prefix}width_mm", "reason": "invalid width"})
            return issues

        aspects = vehicle_db[rim_str].get(width_str, {}).get("aspects", [])
        if source.aspect_percent not in aspects:
            issues.append({"field": f"{prefix}aspect_percent", "reason": "invalid aspect"})
        return issues

    if inputs.flotation and inputs.vehicle_type not in {"LightTruck", "Kart", "Kartcross", "Motorcycle"}:
        errors.append(
            {
                "field": "inputs.flotation",
                "reason": "flotation allowed only for LightTruck/Kart/Kartcross/Motorcycle",
            }
        )

    if inputs.flotation:
        if inputs.vehicle_type == "Motorcycle":
            parsed = parse_motorcycle_flotation(inputs.flotation)
            if not parsed:
                errors.append({"field": "inputs.flotation", "reason": "invalid flotation format"})
        else:
            parsed = parse_flotation(inputs.flotation)
            if not parsed:
                errors.append({"field": "inputs.flotation", "reason": "invalid flotation format"})

    errors.extend(validate_against_db(inputs, "inputs."))

    if inputs.rim_width_in is not None and inputs.rim_width_in <= 0:
        errors.append({"field": "inputs.rim_width_in", "reason": "must be greater than zero"})

    if errors:
        response = ErrorResponse(
            error_code="validation_error",
            message="Invalid request payload.",
            field_errors=errors,
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

    if inputs.flotation:
        if inputs.vehicle_type == "Motorcycle":
            width_in, rim_in = parse_motorcycle_flotation(inputs.flotation)  # type: ignore[misc]
            width_mm = inches_to_mm(width_in)
            diameter_mm = calculate_diameter_mm(rim_in, width_mm, 100.0)
        else:
            overall_in, width_in, _rim_in = parse_flotation(inputs.flotation)  # type: ignore[misc]
            diameter_mm = inches_to_mm(overall_in)
            width_mm = inches_to_mm(width_in)
    else:
        diameter_mm = calculate_diameter_mm(inputs.rim_in, inputs.width_mm, inputs.aspect_percent)  # type: ignore[arg-type]
        width_mm = inputs.width_mm  # type: ignore[assignment]

    assembly_width_mm = calculate_assembly_width_mm(width_mm, inputs.rim_width_in)

    diff_diameter = None
    diff_diameter_percent = None
    diff_width = None
    diff_width_percent = None
    baseline_normalized = None
    if inputs.baseline:
        base_inputs = inputs.baseline
        base_errors = []
        if base_inputs.flotation and base_inputs.vehicle_type not in {
            "LightTruck",
            "Kart",
            "Kartcross",
            "Motorcycle",
        }:
            base_errors.append(
                {
                    "field": "inputs.baseline.flotation",
                    "reason": "flotation allowed only for LightTruck/Kart/Kartcross/Motorcycle",
                }
            )
        if base_inputs.flotation:
            if base_inputs.vehicle_type == "Motorcycle":
                base_parsed = parse_motorcycle_flotation(base_inputs.flotation)
                if not base_parsed:
                    base_errors.append(
                        {"field": "inputs.baseline.flotation", "reason": "invalid flotation format"}
                    )
            else:
                base_parsed = parse_flotation(base_inputs.flotation)
                if not base_parsed:
                    base_errors.append(
                        {"field": "inputs.baseline.flotation", "reason": "invalid flotation format"}
                    )

        base_errors.extend(validate_against_db(base_inputs, "inputs.baseline."))

        if base_errors:
            response = ErrorResponse(
                error_code="validation_error",
                message="Invalid request payload.",
                field_errors=base_errors,
            )
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

        if base_inputs.flotation:
            if base_inputs.vehicle_type == "Motorcycle":
                width_in, rim_in = parse_motorcycle_flotation(base_inputs.flotation)  # type: ignore[misc]
                baseline_width_mm = inches_to_mm(width_in)
                baseline_diameter_mm = calculate_diameter_mm(rim_in, baseline_width_mm, 100.0)
            else:
                overall_in, width_in, _rim_in = parse_flotation(base_inputs.flotation)  # type: ignore[misc]
                baseline_diameter_mm = inches_to_mm(overall_in)
                baseline_width_mm = inches_to_mm(width_in)
        else:
            baseline_diameter_mm = calculate_diameter_mm(
                base_inputs.rim_in, base_inputs.width_mm, base_inputs.aspect_percent  # type: ignore[arg-type]
            )
            baseline_width_mm = base_inputs.width_mm  # type: ignore[assignment]

        baseline_assembly_width_mm = calculate_assembly_width_mm(
            baseline_width_mm, base_inputs.rim_width_in
        )

        diff_diameter = diameter_mm - baseline_diameter_mm
        diff_diameter_percent = percent_diff(diameter_mm, baseline_diameter_mm)
        diff_width = assembly_width_mm - baseline_assembly_width_mm
        diff_width_percent = percent_diff(assembly_width_mm, baseline_assembly_width_mm)

        baseline_normalized = TiresNormalizedInputs(
            vehicle_type=base_inputs.vehicle_type,
            rim_in=base_inputs.rim_in,
            width_mm=base_inputs.width_mm,
            aspect_percent=base_inputs.aspect_percent,
            flotation=base_inputs.flotation,
            rim_width_in=base_inputs.rim_width_in,
            baseline=None,
        )

    if resolved_unit_system == "imperial":
        diameter_out = round(mm_to_inches(diameter_mm), 2)
        width_out = round(mm_to_inches(assembly_width_mm), 2)
        diff_diameter_out = round(mm_to_inches(diff_diameter), 2) if diff_diameter is not None else None
        diff_width_out = round(mm_to_inches(diff_width), 2) if diff_width is not None else None
    else:
        diameter_out = round(diameter_mm, 2)
        width_out = round(assembly_width_mm, 2)
        diff_diameter_out = round(diff_diameter, 2) if diff_diameter is not None else None
        diff_width_out = round(diff_width, 2) if diff_width is not None else None

    results = TiresResults(
        diameter=diameter_out,
        width=width_out,
        diff_diameter=diff_diameter_out,
        diff_diameter_percent=round(diff_diameter_percent, 2)
        if diff_diameter_percent is not None
        else None,
        diff_width=diff_width_out,
        diff_width_percent=round(diff_width_percent, 2) if diff_width_percent is not None else None,
    )

    normalized_inputs = TiresNormalizedInputs(
        vehicle_type=inputs.vehicle_type,
        rim_in=inputs.rim_in,
        width_mm=inputs.width_mm,
        aspect_percent=inputs.aspect_percent,
        flotation=inputs.flotation,
        rim_width_in=inputs.rim_width_in,
        baseline=baseline_normalized,
    )

    return TiresResponse(
        calculator="tires",
        unit_system="imperial" if resolved_unit_system == "imperial" else "metric",
        normalized_inputs=normalized_inputs,
        results=results,
        warnings=warnings,
    )
