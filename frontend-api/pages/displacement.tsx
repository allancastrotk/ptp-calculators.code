import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { ResultPanel } from "../components/ResultPanel";
import { StatusPanel } from "../components/StatusPanel";
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

type ResultItem = { label: React.ReactNode; value: React.ReactNode };

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

  const toNumber = (value: string) => Number(value.replace(",", "."));
  const convertLength = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / 25.4 : value * 25.4;
  const formatConverted = (value: number) => {
    const rounded = Number(value.toFixed(2));
    return Number.isNaN(rounded) ? "" : String(rounded);
  };
  const convertInput = (value: string, from: UnitSystem, to: UnitSystem) => {
    if (!value) return value;
    const numeric = toNumber(value);
    if (Number.isNaN(numeric)) return value;
    return formatConverted(convertLength(numeric, from, to));
  };
  const handleUnitChange = (nextUnit: UnitSystem) => {
    if (nextUnit === unitSystem) return;
    setOriginalBore((value) => convertInput(value, unitSystem, nextUnit));
    setOriginalStroke((value) => convertInput(value, unitSystem, nextUnit));
    setNewBore((value) => convertInput(value, unitSystem, nextUnit));
    setNewStroke((value) => convertInput(value, unitSystem, nextUnit));
    setUnitSystem(nextUnit);
  };

  const formatGeometry = (value: string) => {
    const key = `geometry_${value}` as const;
    return t(key);
  };

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
          bore: toNumber(originalBore),
          stroke: toNumber(originalStroke),
          cylinders: toNumber(originalCylinders),
          baseline_cc: baselineCc ? toNumber(baselineCc) : undefined,
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
          bore: toNumber(newBore),
          stroke: toNumber(newStroke),
          cylinders: toNumber(newCylinders),
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
      { label: t("displacementCcLabel"), value: result.results.displacement_cc.toFixed(2) },
      { label: t("displacementLLabel"), value: result.results.displacement_l.toFixed(2) },
      { label: t("displacementCiLabel"), value: result.results.displacement_ci.toFixed(2) },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
    ];
  };

  const originalResultsList = useMemo(
    () => buildResultsList(originalResult),
    [originalResult]
  );
  const newResultsList = useMemo(() => buildResultsList(newResult), [newResult]);

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

  const renderDiffValue = (diff: number, percent: number | null, unit: string) => {
    let state = "no-change";
    if (diff > 0) state = "increase";
    if (diff < 0) state = "decrease";
    const percentText =
      percent === null ? t("notApplicableLabel") : `${percent.toFixed(2)}%`;
    return (
      <span className={`ptp-diff-value--${state}`}>
        {diff.toFixed(2)} {unit} [{percentText}]
      </span>
    );
  };

  const comparisonDeclaredItems = useMemo((): ResultItem[] => {
    if (!originalResult) return [];
    const percent = originalResult.results.diff_percent ?? null;
    if (percent === null || percent === undefined) return [];
    const baseCc = originalResult.normalized_inputs.baseline_cc;
    if (!baseCc) return [];
    const diffCc = originalResult.results.displacement_cc - baseCc;
    return [
      {
        label: renderDiffLabel(t("displacementCcLabel"), diffCc),
        value: renderDiffValue(diffCc, percent, "cc"),
      },
    ];
  }, [originalResult, t]);

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!originalResult || !newResult) return [];
    const diffCc = newResult.results.displacement_cc - originalResult.results.displacement_cc;
    const diffL = newResult.results.displacement_l - originalResult.results.displacement_l;
    const diffCi = newResult.results.displacement_ci - originalResult.results.displacement_ci;
    const percentCc = originalResult.results.displacement_cc
      ? (diffCc / originalResult.results.displacement_cc) * 100
      : null;
    const percentL = originalResult.results.displacement_l
      ? (diffL / originalResult.results.displacement_l) * 100
      : null;
    const percentCi = originalResult.results.displacement_ci
      ? (diffCi / originalResult.results.displacement_ci) * 100
      : null;
    return [
      {
        label: renderDiffLabel(t("displacementCcLabel"), diffCc),
        value: renderDiffValue(diffCc, percentCc, "cc"),
      },
      {
        label: renderDiffLabel(t("displacementLLabel"), diffL),
        value: renderDiffValue(diffL, percentL, "L"),
      },
      {
        label: renderDiffLabel(t("displacementCiLabel"), diffCi),
        value: renderDiffValue(diffCi, percentCi, "cu in"),
      },
    ];
  }, [originalResult, newResult, t]);

  const handleClear = () => {
    setOriginalResult(null);
    setNewResult(null);
    setErrorOriginal(null);
    setErrorNew(null);
    setFieldErrorsOriginal({});
    setFieldErrorsNew({});
  };

  return (
    <Layout
      title={t("displacement")}
      unitSystem={unitSystem}
      onUnitChange={handleUnitChange}
      variant="pilot"
    >
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
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
              {loadingOriginal ? t("loading") : t("calculate")}
            </Button>
            <Button type="button" variant="secondary" onClick={handleClear}>
              {t("clear")}
            </Button>
          </div>
          {loadingOriginal ? <StatusPanel message={t("warmupMessage")} /> : null}
          {originalResult ? (
            <ResultPanel title={t("originalAssemblyResultsTitle")} items={originalResultsList} />
          ) : null}
          {comparisonDeclaredItems.length > 0 ? (
            <ResultPanel title={t("comparisonDeclaredTitle")} items={comparisonDeclaredItems} />
          ) : null}
        </Card>
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("newAssemblySection")}</div>
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
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left">
              {!originalResult && !newResult ? (
                <span className="ptp-actions__hint">{t("compareHint")}</span>
              ) : null}
            </div>
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
