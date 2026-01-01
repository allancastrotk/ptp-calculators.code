import React, { useMemo, useRef, useState } from "react";

import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ResultPanel } from "../components/ResultPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type DisplacementResponse = {
  calculator: string;
  unit_system: "metric" | "imperial";
  normalized_inputs: {
    bore_mm: number;
    stroke_mm: number;
    cylinders: number;
    baseline_cc?: number | null;
  };
  results: {
    displacement_cc: number;
    displacement_l: number;
    displacement_ci: number;
    geometry: string;
    diff_percent?: number | null;
  };
  warnings?: string[];
  meta: { version: string; timestamp: string; source: string };
};

export default function DisplacementPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [bore, setBore] = useState("");
  const [stroke, setStroke] = useState("");
  const [cylinders, setCylinders] = useState("");
  const [baselineCc, setBaselineCc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DisplacementResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!bore) nextErrors.bore = "Required";
    if (!stroke) nextErrors.stroke = "Required";
    if (!cylinders) nextErrors.cylinders = "Required";
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
          bore: Number(bore),
          stroke: Number(stroke),
          cylinders: Number(cylinders),
          baseline_cc: baselineCc ? Number(baselineCc) : undefined,
        },
      };

      const response = await postJson<DisplacementResponse>(
        "/api/v1/calc/displacement",
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
    return [
      { label: "Displacement (cc)", value: result.results.displacement_cc.toFixed(2) },
      { label: "Displacement (L)", value: result.results.displacement_l.toFixed(2) },
      { label: "Displacement (cu in)", value: result.results.displacement_ci.toFixed(2) },
      { label: "Geometry", value: result.results.geometry },
      result.results.diff_percent !== undefined && result.results.diff_percent !== null
        ? {
            label: "Diff (%)",
            value: `${result.results.diff_percent.toFixed(2)}%`,
          }
        : null,
    ].filter(Boolean) as { label: string; value: string }[];
  }, [result]);

  return (
    <Layout title={t("displacement")} unitSystem={unitSystem} onUnitChange={setUnitSystem}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <div className="grid">
          <InputField
            label={t("boreLabel")}
            unitLabel={unitSystem === "imperial" ? "in" : "mm"}
            placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
            value={bore}
            onChange={setBore}
            error={fieldErrors.bore}
          />
          <InputField
            label={t("strokeLabel")}
            unitLabel={unitSystem === "imperial" ? "in" : "mm"}
            placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
            value={stroke}
            onChange={setStroke}
            error={fieldErrors.stroke}
          />
          <InputField
            label={t("cylindersLabel")}
            placeholder={"4"}
            value={cylinders}
            onChange={setCylinders}
            error={fieldErrors.cylinders}
          />
          <InputField
            label={t("baselineLabel")}
            unitLabel="cc"
            placeholder={"528.4"}
            value={baselineCc}
            onChange={setBaselineCc}
            error={fieldErrors.baseline_cc}
          />
        </div>
        <button className="button" type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? t("loading") : t("calculate")}
        </button>
        {loading ? <LoadingState /> : null}
        {result ? <ResultPanel title="Results" items={resultsList} /> : null}
        {result ? (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Normalized inputs (mm)</div>
            <div className="subtitle">
              Bore: {result.normalized_inputs.bore_mm.toFixed(2)} | Stroke:{" "}
              {result.normalized_inputs.stroke_mm.toFixed(2)} | Cylinders:{" "}
              {result.normalized_inputs.cylinders}
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}