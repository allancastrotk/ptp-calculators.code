import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
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

type ResultItem = { label: string; value: string };

export default function DisplacementPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [originalBore, setOriginalBore] = useState("");
  const [originalStroke, setOriginalStroke] = useState("");
  const [originalCylinders, setOriginalCylinders] = useState("");
  const [baselineCc, setBaselineCc] = useState("");
  const [newBore, setNewBore] = useState("");
  const [newStroke, setNewStroke] = useState("");
  const [newCylinders, setNewCylinders] = useState("");
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);
  const [errorNew, setErrorNew] = useState<string | null>(null);
  const [fieldErrorsOriginal, setFieldErrorsOriginal] = useState<Record<string, string>>({});
  const [fieldErrorsNew, setFieldErrorsNew] = useState<Record<string, string>>({});
  const [originalResult, setOriginalResult] = useState<DisplacementResponse | null>(null);
  const [newResult, setNewResult] = useState<DisplacementResponse | null>(null);
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

  const handleOriginalSubmit = async () => {
    setErrorOriginal(null);
    setFieldErrorsOriginal({});

    const nextErrors: Record<string, string> = {};
    if (!originalBore) nextErrors.bore = t("required");
    if (!originalStroke) nextErrors.stroke = t("required");
    if (!originalCylinders) nextErrors.cylinders = t("required");
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrorsOriginal(nextErrors);
      return;
    }

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
          bore: Number(originalBore),
          stroke: Number(originalStroke),
          cylinders: Number(originalCylinders),
          baseline_cc: baselineCc ? Number(baselineCc) : undefined,
        },
      };

      const response = await postJson<DisplacementResponse>(
        "/api/v1/calc/displacement",
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
    setFieldErrorsNew({});

    const nextErrors: Record<string, string> = {};
    if (!newBore) nextErrors.bore = t("required");
    if (!newStroke) nextErrors.stroke = t("required");
    if (!newCylinders) nextErrors.cylinders = t("required");
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrorsNew(nextErrors);
      return;
    }

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
          bore: Number(newBore),
          stroke: Number(newStroke),
          cylinders: Number(newCylinders),
        },
      };

      const response = await postJson<DisplacementResponse>(
        "/api/v1/calc/displacement",
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

  const buildResultsList = (result: DisplacementResponse | null): ResultItem[] => {
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
    ].filter(Boolean) as ResultItem[];
  };

  const originalResultsList = useMemo(
    () => buildResultsList(originalResult),
    [originalResult]
  );
  const newResultsList = useMemo(() => buildResultsList(newResult), [newResult]);

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!originalResult || !newResult) return [];
    const originalCc = originalResult.results.displacement_cc;
    if (!originalCc) return [];
    const diffPercent = ((newResult.results.displacement_cc - originalCc) / originalCc) * 100;
    return [
      {
        label: "Diff vs Original (%)",
        value: `${diffPercent.toFixed(2)}%`,
      },
    ];
  }, [originalResult, newResult]);

  const handleClear = () => {
    setOriginalResult(null);
    setNewResult(null);
    setErrorOriginal(null);
    setErrorNew(null);
    setFieldErrorsOriginal({});
    setFieldErrorsNew({});
  };

  return (
    <Layout title={t("displacement")} unitSystem={unitSystem} onUnitChange={setUnitSystem} variant="pilot">
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalSection")}</div>
          </div>
          {errorOriginal ? <ErrorBanner message={errorOriginal} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
              value={originalBore}
              onChange={setOriginalBore}
              inputMode="decimal"
              error={fieldErrorsOriginal.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
              value={originalStroke}
              onChange={setOriginalStroke}
              inputMode="decimal"
              error={fieldErrorsOriginal.stroke}
            />
            <InputField
              label={t("cylindersLabel")}
              placeholder={"4"}
              value={originalCylinders}
              onChange={setOriginalCylinders}
              inputMode="numeric"
              error={fieldErrorsOriginal.cylinders}
            />
            <InputField
              label={t("compareDeclaredLabel")}
              unitLabel="cc"
              placeholder={"528.4"}
              helper={t("compareDeclaredHelp")}
              value={baselineCc}
              onChange={setBaselineCc}
              inputMode="decimal"
              error={fieldErrorsOriginal.baseline_cc}
            />
          </div>
          <div className="ptp-actions">
            <Button type="button" onClick={handleOriginalSubmit} disabled={loadingOriginal}>
              {loadingOriginal ? t("loading") : t("calculateOriginal")}
            </Button>
            <Button type="button" variant="secondary" onClick={handleClear}>
              {t("clear")}
            </Button>
          </div>
          {loadingOriginal ? <LoadingState /> : null}
          {originalResult ? (
            <ResultPanel title={t("originalResultsTitle")} items={originalResultsList} />
          ) : null}
          {originalResult ? (
            <Card>
              <div className="ptp-card__title">{t("normalizedInputsTitle")}</div>
              <div className="subtitle">
                Bore: {originalResult.normalized_inputs.bore_mm.toFixed(2)} | Stroke:{" "}
                {originalResult.normalized_inputs.stroke_mm.toFixed(2)} | Cylinders:{" "}
                {originalResult.normalized_inputs.cylinders}
              </div>
            </Card>
          ) : null}
        </Card>
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("newSection")}</div>
          </div>
          {errorNew ? <ErrorBanner message={errorNew} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "2.52" : "64.0"}
              value={newBore}
              onChange={setNewBore}
              inputMode="decimal"
              error={fieldErrorsNew.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "2.13" : "54.0"}
              value={newStroke}
              onChange={setNewStroke}
              inputMode="decimal"
              error={fieldErrorsNew.stroke}
            />
            <InputField
              label={t("cylindersLabel")}
              placeholder={"4"}
              value={newCylinders}
              onChange={setNewCylinders}
              inputMode="numeric"
              error={fieldErrorsNew.cylinders}
            />
          </div>
          {!originalResult ? <div className="ptp-field__helper">{t("compareHint")}</div> : null}
          <div className="ptp-actions">
            <Button type="button" onClick={handleNewSubmit} disabled={loadingNew}>
              {loadingNew ? t("loading") : t("calculateNew")}
            </Button>
          </div>
          {loadingNew ? <LoadingState /> : null}
          {newResult ? <ResultPanel title={t("newResultsTitle")} items={newResultsList} /> : null}
        </Card>
        {comparisonItems.length > 0 ? (
          <ResultPanel title={t("comparisonTitle")} items={comparisonItems} />
        ) : null}
      </div>
    </Layout>
  );
}