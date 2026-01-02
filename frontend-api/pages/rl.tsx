import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ResultPanel } from "../components/ResultPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { UnitToggleButton } from "../components/UnitToggleButton";
import { postJson, ApiError } from "../lib/api";
import { formatNumericComparison, formatTextComparison } from "../lib/comparison";
import { useI18n } from "../lib/i18n";

type RLResponse = {
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
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

  const toNumber = (value: string) => Number(value.replace(",", "."));
  const unitLabel = unitSystem === "imperial" ? "in" : "mm";

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

  const formatSmoothness = (value: string) => {
    const key = `smoothness_${value}` as const;
    return t(key);
  };

  const buildResults = (result: RLResponse | null) => {
    if (!result) return [];
    return [
      { label: t("displacementCcLabel"), value: result.results.displacement_cc.toFixed(2) },
      {
        label: t("rlRatioLabel"),
        value: `${result.results.rl_ratio.toFixed(2)} (${formatSmoothness(result.results.smoothness)})`,
      },
      { label: t("rodStrokeLabel"), value: result.results.rod_stroke_ratio.toFixed(2) },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
    ];
  };

  const originalResultsList = useMemo(
    () => buildResults(originalResult),
    [originalResult]
  );
  const newResultsList = useMemo(() => buildResults(newResult), [newResult]);

  const comparisonItems = useMemo(() => {
    if (!originalResult || !newResult) return [];
    const labels = {
      original: t("originalValueLabel"),
      newValue: t("newValueLabel"),
      diff: t("diffValueLabel"),
      diffPercent: t("diffPercentLabel"),
      na: t("notApplicableLabel"),
    };
    return [
      {
        label: t("rlRatioLabel"),
        value: formatNumericComparison(
          originalResult.results.rl_ratio,
          newResult.results.rl_ratio,
          null,
          labels
        ),
      },
      {
        label: t("rodStrokeLabel"),
        value: formatNumericComparison(
          originalResult.results.rod_stroke_ratio,
          newResult.results.rod_stroke_ratio,
          null,
          labels
        ),
      },
      {
        label: t("displacementCcLabel"),
        value: formatNumericComparison(
          originalResult.results.displacement_cc,
          newResult.results.displacement_cc,
          "cc",
          labels
        ),
      },
      {
        label: t("geometryLabel"),
        value: formatTextComparison(
          formatGeometry(originalResult.results.geometry),
          formatGeometry(newResult.results.geometry),
          labels
        ),
      },
      {
        label: t("smoothnessLabel"),
        value: formatTextComparison(
          formatSmoothness(originalResult.results.smoothness),
          formatSmoothness(newResult.results.smoothness),
          labels
        ),
      },
    ];
  }, [newResult, originalResult, t]);

  return (
    <Layout title={t("rl")} subtitle={t("unitLocked")} variant="pilot" hideHeader hideFooter>
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalSection")}</div>
            <UnitToggleButton value={unitSystem} onChange={setUnitSystem} />
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
          {loadingOriginal ? <LoadingState /> : null}
          {originalResult ? (
            <ResultPanel title={t("originalResultsTitle")} items={originalResultsList} />
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
          {!originalResult ? <div className="ptp-field__helper">{t("compareHint")}</div> : null}
          <div className="ptp-actions">
            <Button type="button" onClick={handleNewSubmit} disabled={loadingNew}>
              {loadingNew ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loadingNew ? <LoadingState /> : null}
          {newResult ? <ResultPanel title={t("newResultsTitle")} items={newResultsList} /> : null}
          {comparisonItems.length > 0 ? (
            <ResultPanel title={t("comparisonNewTitle")} items={comparisonItems} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
