import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ResultPanel } from "../components/ResultPanel";
import { SelectField } from "../components/SelectField";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type SprocketResponse = {
  results: {
    ratio: number;
    chain_length_mm?: number | null;
    chain_length_in?: number | null;
    center_distance_mm?: number | null;
    center_distance_in?: number | null;
    diff_ratio_percent?: number | null;
    diff_ratio_absolute?: number | null;
    diff_chain_length_percent?: number | null;
    diff_chain_length_absolute?: number | null;
    diff_center_distance_percent?: number | null;
    diff_center_distance_absolute?: number | null;
  };
};

const CHAIN_PITCH_OPTIONS = ["415", "420", "428", "520", "525", "530", "630"];

export default function SprocketPage() {
  const { t, language } = useI18n();
  const [originalSprocket, setOriginalSprocket] = useState("");
  const [originalCrown, setOriginalCrown] = useState("");
  const [originalPitch, setOriginalPitch] = useState("");
  const [originalLinks, setOriginalLinks] = useState("");
  const [newSprocket, setNewSprocket] = useState("");
  const [newCrown, setNewCrown] = useState("");
  const [newPitch, setNewPitch] = useState("");
  const [newLinks, setNewLinks] = useState("");
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);
  const [errorNew, setErrorNew] = useState<string | null>(null);
  const [fieldErrorsOriginal, setFieldErrorsOriginal] = useState<Record<string, string>>({});
  const [fieldErrorsNew, setFieldErrorsNew] = useState<Record<string, string>>({});
  const [originalResult, setOriginalResult] = useState<SprocketResponse | null>(null);
  const [newResult, setNewResult] = useState<SprocketResponse | null>(null);
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

  const isEnglish = language === "en_US";
  const lengthUnit = isEnglish ? "in" : "cm";

  const toNumber = (value: string) => Number(value.replace(",", "."));

  const formatLength = (mmValue?: number | null, inValue?: number | null) => {
    if (mmValue === undefined || mmValue === null) return "-";
    if (isEnglish) {
      return `${(inValue ?? mmValue / 25.4).toFixed(2)} ${lengthUnit}`;
    }
    return `${(mmValue / 10).toFixed(2)} ${lengthUnit}`;
  };

  const formatDelta = (percent?: number | null, absolute?: number | null, unit?: string) => {
    if (percent === undefined || percent === null || absolute === undefined || absolute === null) {
      return null;
    }
    const sign = absolute >= 0 ? "+" : "";
    const absoluteValue = unit
      ? `${sign}${absolute.toFixed(2)} ${unit}`
      : `${sign}${absolute.toFixed(2)}`;
    return `${percent.toFixed(2)}% (${absoluteValue})`;
  };

  const handleOriginalSubmit = async () => {
    setErrorOriginal(null);
    setFieldErrorsOriginal({});

    const nextErrors: Record<string, string> = {};
    if (!originalSprocket) nextErrors.sprocket_teeth = t("required");
    if (!originalCrown) nextErrors.crown_teeth = t("required");
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
        unit_system: "metric",
        inputs: {
          sprocket_teeth: toNumber(originalSprocket),
          crown_teeth: toNumber(originalCrown),
          chain_pitch: originalPitch || undefined,
          chain_links: originalLinks ? toNumber(originalLinks) : undefined,
        },
      };

      const response = await postJson<SprocketResponse>(
        "/api/v1/calc/sprocket",
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
    if (!newSprocket) nextErrors.sprocket_teeth = t("required");
    if (!newCrown) nextErrors.crown_teeth = t("required");
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
        unit_system: "metric",
        inputs: {
          sprocket_teeth: toNumber(newSprocket),
          crown_teeth: toNumber(newCrown),
          chain_pitch: newPitch || undefined,
          chain_links: newLinks ? toNumber(newLinks) : undefined,
          baseline: originalResult
            ? {
                sprocket_teeth: toNumber(originalSprocket),
                crown_teeth: toNumber(originalCrown),
                chain_pitch: originalPitch || undefined,
                chain_links: originalLinks ? toNumber(originalLinks) : undefined,
              }
            : undefined,
        },
      };

      const response = await postJson<SprocketResponse>(
        "/api/v1/calc/sprocket",
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

  const buildResultsList = (result: SprocketResponse | null) => {
    if (!result) return [];
    return [
      { label: t("sprocketRatioLabel"), value: result.results.ratio.toFixed(2) },
      {
        label: t("chainLengthLabel"),
        value: formatLength(result.results.chain_length_mm, result.results.chain_length_in),
      },
      {
        label: t("centerDistanceLabel"),
        value: formatLength(result.results.center_distance_mm, result.results.center_distance_in),
      },
    ];
  };

  const originalResultsList = useMemo(
    () => buildResultsList(originalResult),
    [originalResult]
  );
  const newResultsList = useMemo(() => buildResultsList(newResult), [newResult]);

  const comparisonItems = useMemo(() => {
    if (!newResult) return [];
    const items = [];
    const ratioDelta = formatDelta(
      newResult.results.diff_ratio_percent,
      newResult.results.diff_ratio_absolute
    );
    if (ratioDelta) {
      items.push({ label: t("sprocketDiffPercentLabel"), value: ratioDelta });
    }
    const chainDelta = formatDelta(
      newResult.results.diff_chain_length_percent,
      newResult.results.diff_chain_length_absolute
        ? isEnglish
          ? newResult.results.diff_chain_length_absolute / 25.4
          : newResult.results.diff_chain_length_absolute / 10
        : newResult.results.diff_chain_length_absolute,
      lengthUnit
    );
    if (chainDelta) {
      items.push({ label: t("chainLengthDiffLabel"), value: chainDelta });
    }
    const centerDelta = formatDelta(
      newResult.results.diff_center_distance_percent,
      newResult.results.diff_center_distance_absolute
        ? isEnglish
          ? newResult.results.diff_center_distance_absolute / 25.4
          : newResult.results.diff_center_distance_absolute / 10
        : newResult.results.diff_center_distance_absolute,
      lengthUnit
    );
    if (centerDelta) {
      items.push({ label: t("centerDistanceDiffLabel"), value: centerDelta });
    }
    return items;
  }, [isEnglish, lengthUnit, newResult, t]);

  return (
    <Layout title={t("sprocket")} subtitle={t("unitLocked")} variant="pilot" hideHeader hideFooter>
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalSection")}</div>
          </div>
          {errorOriginal ? <ErrorBanner message={errorOriginal} /> : null}
          <div className="grid">
            <InputField
              label={t("sprocketLabel")}
              placeholder="14"
              value={originalSprocket}
              onChange={setOriginalSprocket}
              inputMode="numeric"
              error={fieldErrorsOriginal.sprocket_teeth}
            />
            <InputField
              label={t("crownLabel")}
              placeholder="38"
              value={originalCrown}
              onChange={setOriginalCrown}
              inputMode="numeric"
              error={fieldErrorsOriginal.crown_teeth}
            />
            <SelectField
              label={t("chainPitchLabel")}
              value={originalPitch}
              onChange={setOriginalPitch}
              placeholder={t("chainPitchPlaceholder")}
              options={CHAIN_PITCH_OPTIONS.map((option) => ({ value: option, label: option }))}
              error={fieldErrorsOriginal.chain_pitch}
            />
            <InputField
              label={t("chainLinksLabel")}
              placeholder="108"
              value={originalLinks}
              onChange={setOriginalLinks}
              inputMode="numeric"
              error={fieldErrorsOriginal.chain_links}
            />
          </div>
          <div className="ptp-actions">
            <Button type="button" onClick={handleOriginalSubmit} disabled={loadingOriginal}>
              {loadingOriginal ? t("loading") : t("calculateOriginal")}
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
              label={t("sprocketLabel")}
              placeholder="14"
              value={newSprocket}
              onChange={setNewSprocket}
              inputMode="numeric"
              error={fieldErrorsNew.sprocket_teeth}
            />
            <InputField
              label={t("crownLabel")}
              placeholder="38"
              value={newCrown}
              onChange={setNewCrown}
              inputMode="numeric"
              error={fieldErrorsNew.crown_teeth}
            />
            <SelectField
              label={t("chainPitchLabel")}
              value={newPitch}
              onChange={setNewPitch}
              placeholder={t("chainPitchPlaceholder")}
              options={CHAIN_PITCH_OPTIONS.map((option) => ({ value: option, label: option }))}
              error={fieldErrorsNew.chain_pitch}
            />
            <InputField
              label={t("chainLinksLabel")}
              placeholder="108"
              value={newLinks}
              onChange={setNewLinks}
              inputMode="numeric"
              error={fieldErrorsNew.chain_links}
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
          {comparisonItems.length > 0 ? (
            <ResultPanel title={t("comparisonNewTitle")} items={comparisonItems} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
