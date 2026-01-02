import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { LoadingState } from "../../components/LoadingState";
import { ResultPanel } from "../../components/ResultPanel";
import { UnitSystem } from "../../components/UnitSystemSwitch";
import { postJson, ApiError } from "../../lib/api";
import { postEmbedMessage } from "../../lib/embed";
import { useI18n } from "../../lib/i18n";

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

type ResultItem = { label: string; value: string };

type OriginalMessage = {
  type: "ptp:calc:displacement:originalResult";
  pageId?: string;
  payload: DisplacementResponse;
};

export default function DisplacementOriginalWidget() {
  const { t } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

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
    if (!bore) nextErrors.bore = t("required");
    if (!stroke) nextErrors.stroke = t("required");
    if (!cylinders) nextErrors.cylinders = t("required");
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
      const message: OriginalMessage = {
        type: "ptp:calc:displacement:originalResult",
        pageId,
        payload: response,
      };
      postEmbedMessage(message);
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

  const resultsList = useMemo((): ResultItem[] => {
    if (!result) return [];
    return [
      { label: "Displacement (cc)", value: result.results.displacement_cc.toFixed(2) },
      { label: "Displacement (L)", value: result.results.displacement_l.toFixed(2) },
      { label: "Displacement (cu in)", value: result.results.displacement_ci.toFixed(2) },
      { label: "Geometry", value: result.results.geometry },
    ];
  }, [result]);

  return (
    <Layout title={t("displacement")} unitSystem={unitSystem} onUnitChange={setUnitSystem}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t("originalSection")}</div>
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
              label={t("compareDeclaredLabel")}
              unitLabel="cc"
              placeholder={"528.4"}
              value={baselineCc}
              onChange={setBaselineCc}
              error={fieldErrors.baseline_cc}
            />
          </div>
          <button className="button" type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? t("loading") : t("calculateOriginal")}
          </button>
          {loading ? <LoadingState /> : null}
          {result ? <ResultPanel title={t("originalResultsTitle")} items={resultsList} /> : null}
        </div>
      </div>
    </Layout>
  );
}