import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { ResultPanel } from "../components/ResultPanel";
import { SelectField } from "../components/SelectField";
import { StatusPanel } from "../components/StatusPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { UnitToggleButton } from "../components/UnitToggleButton";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { TIRES_DB, VEHICLE_TYPES, VehicleType, getRimData, getWidthEntry } from "../lib/tiresDb";

type TiresResponse = {
  results: {
    diameter: number;
    width: number;
    diff_diameter?: number | null;
    diff_diameter_percent?: number | null;
    diff_width?: number | null;
    diff_width_percent?: number | null;
  };
};

type TireInputs = {
  vehicleType: VehicleType | "";
  rim: string;
  width: string;
  aspect: string;
  rimWidth: string;
  flotationEnabled: boolean;
  flotation: string;
};

const createEmptyInputs = (): TireInputs => ({
  vehicleType: "",
  rim: "",
  width: "",
  aspect: "",
  rimWidth: "",
  flotationEnabled: false,
  flotation: "",
});

export default function TiresPage() {
  const { t, language } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() =>
    language === "en_US" ? "imperial" : "metric"
  );
  const [originalInputs, setOriginalInputs] = useState<TireInputs>(createEmptyInputs);
  const [newInputs, setNewInputs] = useState<TireInputs>(createEmptyInputs);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);
  const [errorNew, setErrorNew] = useState<string | null>(null);
  const [fieldErrorsOriginal, setFieldErrorsOriginal] = useState<Record<string, string>>({});
  const [fieldErrorsNew, setFieldErrorsNew] = useState<Record<string, string>>({});
  const [originalResult, setOriginalResult] = useState<TiresResponse | null>(null);
  const [newResult, setNewResult] = useState<TiresResponse | null>(null);
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

  const unitLabel = unitSystem === "imperial" ? "in" : "mm";
  const toNumber = (value: string) => Number(value.replace(",", "."));

  const buildOptions = (vehicleType: VehicleType | "") => {
    if (!vehicleType) return { rims: [], widths: [], aspects: [], flotation: [] };
    const vehicle = TIRES_DB[vehicleType];
    return {
      rims: vehicle.rims.map((rim) => String(rim)),
      widths: [],
      aspects: [],
      flotation: [],
    };
  };

  const getWidths = (vehicleType: VehicleType | "", rim: string) => {
    if (!vehicleType || !rim) return [];
    const rimData = getRimData(vehicleType, rim);
    return rimData?.widths || [];
  };

  const getAspects = (vehicleType: VehicleType | "", rim: string, width: string) => {
    if (!vehicleType || !rim || !width) return [];
    const rimData = getRimData(vehicleType, rim);
    const entry = getWidthEntry(rimData, width);
    return entry?.aspects?.map((aspect: number) => String(aspect)) || [];
  };

  const getFlotation = (vehicleType: VehicleType | "", rim: string) => {
    if (!vehicleType || !rim) return [];
    if (!["LightTruck", "Kart", "Kartcross"].includes(vehicleType)) return [];
    const options: string[] = [];
    const rimData = getRimData(vehicleType, rim);
    (rimData?.widths || []).forEach((width: string) => {
      const entry = getWidthEntry(rimData, width);
      const flotation = entry?.flotation || [];
      options.push(...flotation);
    });
    return Array.from(new Set(options));
  };

  const updateOriginal = (next: Partial<TireInputs>) =>
    setOriginalInputs((current) => ({ ...current, ...next }));
  const updateNew = (next: Partial<TireInputs>) =>
    setNewInputs((current) => ({ ...current, ...next }));
  const hasFlotation = (vehicleType: VehicleType | "") =>
    vehicleType === "LightTruck" || vehicleType === "Kart" || vehicleType === "Kartcross";

  const resetDependent = (
    current: TireInputs,
    level: "vehicle" | "rim" | "width"
  ): TireInputs => {
    if (level === "vehicle") {
      return { ...current, rim: "", width: "", aspect: "", flotation: "" };
    }
    if (level === "rim") {
      return { ...current, width: "", aspect: "", flotation: "" };
    }
    return { ...current, aspect: "" };
  };

  const validateInputs = (inputs: TireInputs) => {
    const errors: Record<string, string> = {};
    if (!inputs.vehicleType) errors.vehicle_type = t("required");
    if (!inputs.rim) errors.rim_in = t("required");
    if (inputs.flotationEnabled) {
      if (!inputs.flotation) errors.flotation = t("required");
    } else {
      if (!inputs.width) errors.width_mm = t("required");
      if (!inputs.aspect) errors.aspect_percent = t("required");
    }
    return errors;
  };

  const handleOriginalSubmit = async () => {
    setErrorOriginal(null);
    const errors = validateInputs(originalInputs);
    setFieldErrorsOriginal(errors);
    if (Object.keys(errors).length > 0) return;

    if (abortOriginalRef.current) {
      abortOriginalRef.current.abort();
    }
    const controller = new AbortController();
    abortOriginalRef.current = controller;

    setLoadingOriginal(true);
    try {
      const payload = {
        unit_system: unitSystem,
        inputs: {
          vehicle_type: originalInputs.vehicleType,
          rim_in: toNumber(originalInputs.rim),
          width_mm: originalInputs.flotationEnabled ? undefined : toNumber(originalInputs.width),
          aspect_percent: originalInputs.flotationEnabled ? undefined : toNumber(originalInputs.aspect),
          flotation: originalInputs.flotationEnabled ? originalInputs.flotation : undefined,
          rim_width_in: originalInputs.rimWidth ? toNumber(originalInputs.rimWidth) : undefined,
        },
      };

      const response = await postJson<TiresResponse>(
        "/api/v1/calc/tires",
        payload,
        controller.signal
      );
      setOriginalResult(response);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const apiError = err as ApiError;
      setErrorOriginal(apiError.message || t("errorTitle"));
      if (apiError.field_errors) {
        const mapped: Record<string, string> = {};
        apiError.field_errors.forEach((fieldError) => {
          const key = fieldError.field.replace("inputs.", "");
          mapped[key] = fieldError.reason;
        });
        setFieldErrorsOriginal(mapped);
      }
    } finally {
      setLoadingOriginal(false);
    }
  };

  const handleNewSubmit = async () => {
    setErrorNew(null);
    const errors = validateInputs(newInputs);
    setFieldErrorsNew(errors);
    if (Object.keys(errors).length > 0) return;

    if (abortNewRef.current) {
      abortNewRef.current.abort();
    }
    const controller = new AbortController();
    abortNewRef.current = controller;

    setLoadingNew(true);
    try {
      const payload = {
        unit_system: unitSystem,
        inputs: {
          vehicle_type: newInputs.vehicleType,
          rim_in: toNumber(newInputs.rim),
          width_mm: newInputs.flotationEnabled ? undefined : toNumber(newInputs.width),
          aspect_percent: newInputs.flotationEnabled ? undefined : toNumber(newInputs.aspect),
          flotation: newInputs.flotationEnabled ? newInputs.flotation : undefined,
          rim_width_in: newInputs.rimWidth ? toNumber(newInputs.rimWidth) : undefined,
          baseline: originalResult
            ? {
                vehicle_type: originalInputs.vehicleType,
                rim_in: toNumber(originalInputs.rim),
                width_mm: originalInputs.flotationEnabled ? undefined : toNumber(originalInputs.width),
                aspect_percent: originalInputs.flotationEnabled ? undefined : toNumber(originalInputs.aspect),
                flotation: originalInputs.flotationEnabled ? originalInputs.flotation : undefined,
                rim_width_in: originalInputs.rimWidth
                  ? toNumber(originalInputs.rimWidth)
                  : undefined,
              }
            : undefined,
        },
      };

      const response = await postJson<TiresResponse>(
        "/api/v1/calc/tires",
        payload,
        controller.signal
      );
      setNewResult(response);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const apiError = err as ApiError;
      setErrorNew(apiError.message || t("errorTitle"));
      if (apiError.field_errors) {
        const mapped: Record<string, string> = {};
        apiError.field_errors.forEach((fieldError) => {
          const key = fieldError.field.replace("inputs.", "");
          mapped[key] = fieldError.reason;
        });
        setFieldErrorsNew(mapped);
      }
    } finally {
      setLoadingNew(false);
    }
  };

  const buildResultsList = (result: TiresResponse | null, inputs: TireInputs) => {
    if (!result) return [];
    const items = [
      {
        label: t("tiresDiameterLabel"),
        value: `${result.results.diameter.toFixed(2)} ${unitLabel}`,
      },
      { label: t("tiresWidthLabel"), value: `${result.results.width.toFixed(2)} ${unitLabel}` },
    ];

    if (!inputs.flotationEnabled && inputs.width && inputs.rimWidth) {
      const rimWidthMm = toNumber(inputs.rimWidth) * 25.4;
      const widthMm = toNumber(inputs.width);
      const deltaMm = widthMm - rimWidthMm;
      const delta = unitSystem === "imperial" ? deltaMm / 25.4 : deltaMm;
      items.push({
        label: t("tireRimDeltaLabel"),
        value: `${delta.toFixed(2)} ${unitLabel}`,
      });
    }

    return items;
  };

  const renderDiffLabel = (label: string, diff: number) => {
    let state = "no-change";
    let icon = "▬";
    if (diff > 0) {
      state = "increase";
      icon = "▲";
    } else if (diff < 0) {
      state = "decrease";
      icon = "▼";
    }
    return (
      <span className="ptp-result__label-row">
        {t("deltaDiffLabel")} {label}
        <span className={`ptp-diff-icon ptp-diff-icon--${state}`}>{icon}</span>
      </span>
    );
  };

  const renderDiffValue = (diff: number, percent: number | null) => {
    let state = "no-change";
    if (diff > 0) state = "increase";
    if (diff < 0) state = "decrease";
    const percentText =
      percent === null ? t("notApplicableLabel") : `${percent.toFixed(2)}%`;
    return (
      <span className={`ptp-diff-value--${state}`}>
        {t("differenceLabel")}: {diff.toFixed(2)} {unitLabel} [{percentText}]
      </span>
    );
  };

  const buildComparisonItems = (newResultValue: TiresResponse | null) => {
    if (!originalResult || !newResultValue) return [];
    const diameterDiff = newResultValue.results.diameter - originalResult.results.diameter;
    const diameterPercent = originalResult.results.diameter
      ? (diameterDiff / originalResult.results.diameter) * 100
      : null;
    const widthDiff = newResultValue.results.width - originalResult.results.width;
    const widthPercent = originalResult.results.width
      ? (widthDiff / originalResult.results.width) * 100
      : null;
    return [
      {
        label: renderDiffLabel(t("tiresDiameterLabel"), diameterDiff),
        value: renderDiffValue(diameterDiff, diameterPercent),
      },
      {
        label: renderDiffLabel(t("tiresWidthLabel"), widthDiff),
        value: renderDiffValue(widthDiff, widthPercent),
      },
    ];
  };

  const originalResultsList = useMemo(
    () => buildResultsList(originalResult, originalInputs),
    [originalResult, unitLabel, originalInputs]
  );
  const newResultsList = useMemo(
    () => buildResultsList(newResult, newInputs),
    [newResult, unitLabel, newInputs]
  );
  const comparisonItems = useMemo(
    () => buildComparisonItems(newResult),
    [newResult, originalResult, unitLabel, t]
  );

  const originalOptions = buildOptions(originalInputs.vehicleType);
  const newOptions = buildOptions(newInputs.vehicleType);

  return (
    <Layout title={t("tires")} subtitle={t("unitLocked")} variant="pilot" hideHeader hideFooter>
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={setUnitSystem} />
          </div>
          {errorOriginal ? <ErrorBanner message={errorOriginal} /> : null}
          <div className="grid">
            <SelectField
              label={t("vehicleTypeLabel")}
              value={originalInputs.vehicleType}
              onChange={(value) =>
                updateOriginal(resetDependent({ ...originalInputs, vehicleType: value as VehicleType }, "vehicle"))
              }
              placeholder={t("selectPlaceholder")}
              options={VEHICLE_TYPES.map((vehicle) => ({ value: vehicle, label: t(vehicle) }))}
              error={fieldErrorsOriginal.vehicle_type}
            />
            <SelectField
              label={t("rimLabel")}
              unitLabel="in"
              value={originalInputs.rim}
              onChange={(value) =>
                updateOriginal(resetDependent({ ...originalInputs, rim: value }, "rim"))
              }
              placeholder={t("selectPlaceholder")}
              options={originalOptions.rims.map((rim) => ({ value: rim, label: rim }))}
              error={fieldErrorsOriginal.rim_in}
            />
            {!originalInputs.flotationEnabled ? (
              <>
                <SelectField
                  label={t("widthLabel")}
                  unitLabel="mm"
                  value={originalInputs.width}
                  onChange={(value) =>
                    updateOriginal(resetDependent({ ...originalInputs, width: value }, "width"))
                  }
                  placeholder={t("selectPlaceholder")}
                  options={getWidths(originalInputs.vehicleType, originalInputs.rim).map((width) => ({
                    value: width,
                    label: width,
                  }))}
                  error={fieldErrorsOriginal.width_mm}
                />
                <SelectField
                  label={t("aspectLabel")}
                  unitLabel="%"
                  value={originalInputs.aspect}
                  onChange={(value) => updateOriginal({ aspect: value })}
                  placeholder={t("selectPlaceholder")}
                  options={getAspects(
                    originalInputs.vehicleType,
                    originalInputs.rim,
                    originalInputs.width
                  ).map((aspect) => ({ value: aspect, label: aspect }))}
                  error={fieldErrorsOriginal.aspect_percent}
                />
              </>
            ) : null}
            {hasFlotation(originalInputs.vehicleType) ? (
              <label className="ptp-field">
                <span className="ptp-field__label">{t("flotationLabel")}</span>
                <input
                  type="checkbox"
                  checked={originalInputs.flotationEnabled}
                  onChange={(event) =>
                    updateOriginal({
                      flotationEnabled: event.target.checked,
                      flotation: "",
                      width: "",
                      aspect: "",
                    })
                  }
                />
              </label>
            ) : null}
            {originalInputs.flotationEnabled ? (
              <SelectField
                label={t("flotationLabel")}
                value={originalInputs.flotation}
                onChange={(value) => updateOriginal({ flotation: value })}
                placeholder={t("selectPlaceholder")}
                options={getFlotation(originalInputs.vehicleType, originalInputs.rim).map((option) => ({
                  value: option,
                  label: option,
                }))}
                error={fieldErrorsOriginal.flotation}
              />
            ) : null}
            <InputField
              label={t("rimWidthLabel")}
              unitLabel="in"
              placeholder="7.0"
              value={originalInputs.rimWidth}
              onChange={(value) => updateOriginal({ rimWidth: value })}
              inputMode="decimal"
              error={fieldErrorsOriginal.rim_width_in}
            />
          </div>
          <div className="ptp-actions">
            <Button type="button" onClick={handleOriginalSubmit} disabled={loadingOriginal}>
              {loadingOriginal ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loadingOriginal ? <StatusPanel message={t("warmupMessage")} /> : null}
          {originalResult ? (
            <ResultPanel title={t("originalAssemblyResultsTitle")} items={originalResultsList} />
          ) : null}
        </Card>
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("newAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={setUnitSystem} />
          </div>
          {errorNew ? <ErrorBanner message={errorNew} /> : null}
          <div className="grid">
            <SelectField
              label={t("vehicleTypeLabel")}
              value={newInputs.vehicleType}
              onChange={(value) =>
                updateNew(resetDependent({ ...newInputs, vehicleType: value as VehicleType }, "vehicle"))
              }
              placeholder={t("selectPlaceholder")}
              options={VEHICLE_TYPES.map((vehicle) => ({ value: vehicle, label: t(vehicle) }))}
              error={fieldErrorsNew.vehicle_type}
            />
            <SelectField
              label={t("rimLabel")}
              unitLabel="in"
              value={newInputs.rim}
              onChange={(value) =>
                updateNew(resetDependent({ ...newInputs, rim: value }, "rim"))
              }
              placeholder={t("selectPlaceholder")}
              options={newOptions.rims.map((rim) => ({ value: rim, label: rim }))}
              error={fieldErrorsNew.rim_in}
            />
            {!newInputs.flotationEnabled ? (
              <>
                <SelectField
                  label={t("widthLabel")}
                  unitLabel="mm"
                  value={newInputs.width}
                  onChange={(value) =>
                    updateNew(resetDependent({ ...newInputs, width: value }, "width"))
                  }
                  placeholder={t("selectPlaceholder")}
                  options={getWidths(newInputs.vehicleType, newInputs.rim).map((width) => ({
                    value: width,
                    label: width,
                  }))}
                  error={fieldErrorsNew.width_mm}
                />
                <SelectField
                  label={t("aspectLabel")}
                  unitLabel="%"
                  value={newInputs.aspect}
                  onChange={(value) => updateNew({ aspect: value })}
                  placeholder={t("selectPlaceholder")}
                  options={getAspects(newInputs.vehicleType, newInputs.rim, newInputs.width).map(
                    (aspect) => ({ value: aspect, label: aspect })
                  )}
                  error={fieldErrorsNew.aspect_percent}
                />
              </>
            ) : null}
            {hasFlotation(newInputs.vehicleType) ? (
              <label className="ptp-field">
                <span className="ptp-field__label">{t("flotationLabel")}</span>
                <input
                  type="checkbox"
                  checked={newInputs.flotationEnabled}
                  onChange={(event) =>
                    updateNew({
                      flotationEnabled: event.target.checked,
                      flotation: "",
                      width: "",
                      aspect: "",
                    })
                  }
                />
              </label>
            ) : null}
            {newInputs.flotationEnabled ? (
              <SelectField
                label={t("flotationLabel")}
                value={newInputs.flotation}
                onChange={(value) => updateNew({ flotation: value })}
                placeholder={t("selectPlaceholder")}
                options={getFlotation(newInputs.vehicleType, newInputs.rim).map((option) => ({
                  value: option,
                  label: option,
                }))}
                error={fieldErrorsNew.flotation}
              />
            ) : null}
            <InputField
              label={t("rimWidthLabel")}
              unitLabel="in"
              placeholder="7.0"
              value={newInputs.rimWidth}
              onChange={(value) => updateNew({ rimWidth: value })}
              inputMode="decimal"
              error={fieldErrorsNew.rim_width_in}
            />
          </div>
          {!originalResult ? <div className="ptp-field__helper">{t("compareHint")}</div> : null}
          <div className="ptp-actions">
            <Button type="button" onClick={handleNewSubmit} disabled={loadingNew}>
              {loadingNew ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loadingNew ? <StatusPanel message={t("warmupMessage")} /> : null}
          {newResult ? (
            <ResultPanel title={t("newAssemblyResultsTitle")} items={newResultsList} />
          ) : null}
          {comparisonItems.length > 0 ? (
            <ResultPanel title={t("comparisonAssemblyTitle")} items={comparisonItems} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
