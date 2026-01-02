import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { ResultPanel } from "../components/ResultPanel";
import { StatusPanel } from "../components/StatusPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { UnitToggleButton } from "../components/UnitToggleButton";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type RLResponse = {
  unit_system?: "metric" | "imperial";
  results: {
    displacement_cc: number;
    geometry: string;
    smoothness: string;
    rl_ratio: number;
    rod_stroke_ratio: number;
    diff_rl_percent?: number | null;
    diff_displacement_percent?: number | null;
  };
};

export default function RLPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [originalBore, setOriginalBore] = useState("");
  const [originalStroke, setOriginalStroke] = useState("");
  const [originalRod, setOriginalRod] = useState("");
  const [newBore, setNewBore] = useState("");
  const [newStroke, setNewStroke] = useState("");
  const [newRod, setNewRod] = useState("");
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);
  const [errorNew, setErrorNew] = useState<string | null>(null);
  const [fieldErrorsOriginal, setFieldErrorsOriginal] = useState<Record<string, string>>({});
  const [fieldErrorsNew, setFieldErrorsNew] = useState<Record<string, string>>({});
  const [originalResult, setOriginalResult] = useState<RLResponse | null>(null);
  const [newResult, setNewResult] = useState<RLResponse | null>(null);
  const [originalResultUnit, setOriginalResultUnit] = useState<"metric" | "imperial" | null>(
    null
  );
  const [newResultUnit, setNewResultUnit] = useState<"metric" | "imperial" | null>(null);
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

  const toNumber = (value: string) => Number(value.replace(",", "."));
  const unitLabel = unitSystem === "imperial" ? "in" : "mm";
  const displacementUnit = unitSystem === "imperial" ? "cu in" : "cc";
  const convertLength = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / 25.4 : value * 25.4;
  const convertDisplacement = (value: number, from: UnitSystem, to: UnitSystem) => {
    if (from === to) return value;
    return from === "metric" ? value * 0.0610237441 : value / 0.0610237441;
  };
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
    setOriginalRod((value) => convertInput(value, unitSystem, nextUnit));
    setNewBore((value) => convertInput(value, unitSystem, nextUnit));
    setNewStroke((value) => convertInput(value, unitSystem, nextUnit));
    setNewRod((value) => convertInput(value, unitSystem, nextUnit));
    setUnitSystem(nextUnit);
  };

  const handleOriginalSubmit = async () => {
    setErrorOriginal(null);
    setFieldErrorsOriginal({});

    const nextErrors: Record<string, string> = {};
    if (!originalBore) nextErrors.bore = t("required");
    if (!originalStroke) nextErrors.stroke = t("required");
    if (!originalRod) nextErrors.rod_length = t("required");
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
          rod_length: toNumber(originalRod),
        },
      };

      const response = await postJson<RLResponse>(
        "/api/v1/calc/rl",
        payload,
        controller.signal
      );
      setOriginalResult(response);
      setOriginalResultUnit(response.unit_system || unitSystem);
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
    if (!newRod) nextErrors.rod_length = t("required");
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
          rod_length: toNumber(newRod),
          baseline: originalResult
            ? {
                bore: toNumber(originalBore),
                stroke: toNumber(originalStroke),
                rod_length: toNumber(originalRod),
              }
            : undefined,
        },
      };

      const response = await postJson<RLResponse>(
        "/api/v1/calc/rl",
        payload,
        controller.signal
      );
      setNewResult(response);
      setNewResultUnit(response.unit_system || unitSystem);
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

  const formatGeometry = (value: string) => {
    const key = `geometry_${value}` as const;
    return t(key);
  };

  const renderSmoothness = (value: string) => {
    const key = `smoothness_${value}` as const;
    const className = `ptp-smoothness--${value}`;
    return <span className={className}>{t(key)}</span>;
  };

  const buildResults = (result: RLResponse | null, baseUnit: UnitSystem | null) => {
    if (!result) return [];
    const resolvedUnit = baseUnit || result.unit_system || "metric";
    const displacement = convertDisplacement(
      result.results.displacement_cc,
      resolvedUnit,
      unitSystem
    );
    return [
      {
        label: t("displacementLabel"),
        value: `${displacement.toFixed(2)} ${displacementUnit}`,
      },
      {
        label: t("rlRatioLabel"),
        value: (
          <span>
            {result.results.rl_ratio.toFixed(2)} ({renderSmoothness(result.results.smoothness)})
          </span>
        ),
      },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
      { label: t("rodStrokeLabel"), value: result.results.rod_stroke_ratio.toFixed(2) },
    ];
  };

  const originalResultsList = useMemo(
    () => buildResults(originalResult, originalResultUnit),
    [originalResult, originalResultUnit, unitSystem]
  );
  const newResultsList = useMemo(
    () => buildResults(newResult, newResultUnit),
    [newResult, newResultUnit, unitSystem]
  );

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

  const renderDiffValue = (diff: number, percent: number | null, unit?: string) => {
    let state = "no-change";
    if (diff > 0) state = "increase";
    if (diff < 0) state = "decrease";
    const percentText =
      percent === null ? t("notApplicableLabel") : `${percent.toFixed(2)}%`;
    const unitSuffix = unit ? ` ${unit}` : "";
    return (
      <span className={`ptp-diff-value--${state}`}>
        {diff.toFixed(2)}
        {unitSuffix} [{percentText}]
      </span>
    );
  };

  const comparisonItems = useMemo(() => {
    if (!originalResult || !newResult) return [];
    const originalUnit = originalResultUnit || originalResult.unit_system || "metric";
    const newUnit = newResultUnit || newResult.unit_system || "metric";
    const originalDisplacement = convertDisplacement(
      originalResult.results.displacement_cc,
      originalUnit,
      unitSystem
    );
    const newDisplacement = convertDisplacement(
      newResult.results.displacement_cc,
      newUnit,
      unitSystem
    );

    const rlDiff = newResult.results.rl_ratio - originalResult.results.rl_ratio;
    const rlPercent = originalResult.results.rl_ratio
      ? (rlDiff / originalResult.results.rl_ratio) * 100
      : null;
    const rodDiff =
      newResult.results.rod_stroke_ratio - originalResult.results.rod_stroke_ratio;
    const rodPercent = originalResult.results.rod_stroke_ratio
      ? (rodDiff / originalResult.results.rod_stroke_ratio) * 100
      : null;
    const displacementDiff = newDisplacement - originalDisplacement;
    const displacementPercent = originalDisplacement
      ? (displacementDiff / originalDisplacement) * 100
      : null;

    return [
      {
        label: renderDiffLabel(t("displacementLabel"), displacementDiff),
        value: renderDiffValue(displacementDiff, displacementPercent, displacementUnit),
      },
      {
        label: renderDiffLabel(t("rlRatioLabel"), rlDiff),
        value: renderDiffValue(rlDiff, rlPercent),
      },
      {
        label: renderDiffLabel(t("rodStrokeLabel"), rodDiff),
        value: renderDiffValue(rodDiff, rodPercent),
      },
    ];
  }, [newResult, originalResult, originalResultUnit, newResultUnit, unitSystem, t]);

  return (
    <Layout title={t("rl")} subtitle={t("unitLocked")} variant="pilot" hideHeader hideFooter>
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={handleUnitChange} />
          </div>
          {errorOriginal ? <ErrorBanner message={errorOriginal} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
              value={originalBore}
              onChange={setOriginalBore}
              inputMode="decimal"
              error={fieldErrorsOriginal.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
              value={originalStroke}
              onChange={setOriginalStroke}
              inputMode="decimal"
              error={fieldErrorsOriginal.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "3.94" : "100.0"}
              value={originalRod}
              onChange={setOriginalRod}
              inputMode="decimal"
              error={fieldErrorsOriginal.rod_length}
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
          </div>
          {errorNew ? <ErrorBanner message={errorNew} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.52" : "64.0"}
              value={newBore}
              onChange={setNewBore}
              inputMode="decimal"
              error={fieldErrorsNew.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.13" : "54.0"}
              value={newStroke}
              onChange={setNewStroke}
              inputMode="decimal"
              error={fieldErrorsNew.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "4.13" : "105.0"}
              value={newRod}
              onChange={setNewRod}
              inputMode="decimal"
              error={fieldErrorsNew.rod_length}
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
