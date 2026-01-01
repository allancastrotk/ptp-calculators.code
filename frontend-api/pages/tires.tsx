import React, { useMemo, useRef, useState } from "react";

import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ResultPanel } from "../components/ResultPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

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

export default function TiresPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [vehicleType, setVehicleType] = useState("Car");
  const [rimIn, setRimIn] = useState("");
  const [widthMm, setWidthMm] = useState("");
  const [aspectPercent, setAspectPercent] = useState("");
  const [rimWidthIn, setRimWidthIn] = useState("");
  const [flotation, setFlotation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TiresResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const useFlotation = vehicleType === "Utility" && flotation.trim().length > 0;

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!rimIn) nextErrors.rim_in = t("required");
    if (!vehicleType) nextErrors.vehicle_type = t("required");
    if (!useFlotation) {
      if (!widthMm) nextErrors.width_mm = t("required");
      if (!aspectPercent) nextErrors.aspect_percent = t("required");
    } else {
      if (!flotation.trim()) nextErrors.flotation = t("required");
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const payload = {
        unit_system: unitSystem,
        inputs: {
          vehicle_type: vehicleType,
          rim_in: Number(rimIn),
          width_mm: useFlotation ? undefined : Number(widthMm),
          aspect_percent: useFlotation ? undefined : Number(aspectPercent),
          flotation: useFlotation ? flotation : undefined,
          rim_width_in: rimWidthIn ? Number(rimWidthIn) : undefined,
        },
      };

      const response = await postJson<TiresResponse>(
        "/api/v1/calc/tires",
        payload,
        controller.signal
      );
      setResult(response);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const apiError = err as ApiError;
      setError(apiError.message || t("errorTitle"));
      if (apiError.field_errors) {
        const mapped: Record<string, string> = {};
        apiError.field_errors.forEach((fieldError) => {
          const key = fieldError.field.replace("inputs.", "");
          mapped[key] = fieldError.reason;
        });
        setFieldErrors(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  const resultsList = useMemo(() => {
    if (!result) return [];
    const unit = unitSystem === "imperial" ? "in" : "mm";
    return [
      { label: `Diameter (${unit})`, value: result.results.diameter.toFixed(2) },
      { label: `Width (${unit})`, value: result.results.width.toFixed(2) },
      result.results.diff_diameter != null
        ? { label: `Diff diameter (${unit})`, value: result.results.diff_diameter.toFixed(2) }
        : null,
      result.results.diff_diameter_percent != null
        ? { label: "Diff diameter (%)", value: `${result.results.diff_diameter_percent.toFixed(2)}%` }
        : null,
      result.results.diff_width != null
        ? { label: `Diff width (${unit})`, value: result.results.diff_width.toFixed(2) }
        : null,
      result.results.diff_width_percent != null
        ? { label: "Diff width (%)", value: `${result.results.diff_width_percent.toFixed(2)}%` }
        : null,
    ].filter(Boolean) as { label: string; value: string }[];
  }, [result, unitSystem]);

  return (
    <Layout title={t("tires")} unitSystem={unitSystem} onUnitChange={setUnitSystem}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {unitSystem === "imperial" ? <div className="subtitle">{t("unitOutputImperial")}</div> : null}
        {error ? <ErrorBanner message={error} /> : null}
        <div className="grid">
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>{t("vehicleTypeLabel")}</span>
            <select
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                fontSize: 14,
              }}
            >
              <option value="Car">Car</option>
              <option value="Motorcycle">Motorcycle</option>
              <option value="Utility">Utility</option>
            </select>
          </label>
          <InputField
            label={t("rimLabel")}
            unitLabel="in"
            placeholder="17"
            value={rimIn}
            onChange={setRimIn}
            error={fieldErrors.rim_in}
          />
          <InputField
            label={t("widthLabel")}
            unitLabel="mm"
            placeholder="190"
            value={widthMm}
            onChange={setWidthMm}
            error={fieldErrors.width_mm}
          />
          <InputField
            label={t("aspectLabel")}
            unitLabel="%"
            placeholder="55"
            value={aspectPercent}
            onChange={setAspectPercent}
            error={fieldErrors.aspect_percent}
          />
          <InputField
            label={t("rimWidthLabel")}
            unitLabel="in"
            placeholder="7.0"
            value={rimWidthIn}
            onChange={setRimWidthIn}
            error={fieldErrors.rim_width_in}
          />
          {vehicleType === "Utility" ? (
            <InputField
              label={t("flotationLabel")}
              placeholder="31x10.5R15"
              value={flotation}
              onChange={setFlotation}
              error={fieldErrors.flotation}
            />
          ) : null}
        </div>
        <button className="button" type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? t("loading") : t("calculate")}
        </button>
        {loading ? <LoadingState /> : null}
        {result ? <ResultPanel title="Results" items={resultsList} /> : null}
      </div>
    </Layout>
  );
}