import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { ResultPanel } from "../components/ResultPanel";
import { StatusPanel } from "../components/StatusPanel";
import { SelectField } from "../components/SelectField";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { UnitToggleButton } from "../components/UnitToggleButton";
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
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
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

  const lengthUnit = unitSystem === "imperial" ? "in" : "mm";

  const toNumber = (value: string) => Number(value.replace(",", "."));

  const formatLength = (mmValue?: number | null, inValue?: number | null) => {
    if (mmValue === undefined || mmValue === null) return "-";
    if (unitSystem === "imperial") {
      return `${(inValue ?? mmValue / 25.4).toFixed(2)} ${lengthUnit}`;
    }
    return `${mmValue.toFixed(2)} ${lengthUnit}`;
  };

  const renderDiffLabel = (label: string, diff: number) => {
    let state = "no-change";
    let icon = "";
    if (diff > 0) {
      state = "increase";
      icon = "";
    } else if (diff < 0) {
      state = "decrease";
      icon = "";
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
    const unitSuffix = unit ? ` ${unit}` : "";
    return (
      <span className={`ptp-diff-value--${state}`}>
        {diff.toFixed(2)}
        {unitSuffix} [{percentText}]
      </span>
    );
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
        unit_system: unitSystem,
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
        unit_system: unitSystem,
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
    if (!originalResult) return [];
    const ratioDiff = newResult.results.diff_ratio_absolute ?? 0;
    const ratioPercent = newResult.results.diff_ratio_percent ?? null;
    const chainDiffRaw = newResult.results.diff_chain_length_absolute ?? null;
    const chainPercent = newResult.results.diff_chain_length_percent ?? null;
    const centerDiffRaw = newResult.results.diff_center_distance_absolute ?? null;
    const centerPercent = newResult.results.diff_center_distance_percent ?? null;
    const chainDiff =
      chainDiffRaw === null
        ? null
        : unitSystem === "imperial"
          ? chainDiffRaw / 25.4
          : chainDiffRaw;
    const centerDiff =
      centerDiffRaw === null
        ? null
        : unitSystem === "imperial"
          ? centerDiffRaw / 25.4
          : centerDiffRaw;

    return [
      {
        label: renderDiffLabel(t("sprocketRatioLabel"), ratioDiff),
        value: renderDiffValue(ratioDiff, ratioPercent, ""),
      },
      {
        label: renderDiffLabel(t("chainLengthLabel"), chainDiff ?? 0),
        value:
          chainDiff === null
            ? t("notApplicableLabel")
            : renderDiffValue(chainDiff, chainPercent, lengthUnit),
      },
      {
        label: renderDiffLabel(t("centerDistanceLabel"), centerDiff ?? 0),
        value:
          centerDiff === null
            ? t("notApplicableLabel")
            : renderDiffValue(centerDiff, centerPercent, lengthUnit),
      },
    ];
  }, [lengthUnit, newResult, originalResult, t, unitSystem]);

  return (
    <Layout title={t("sprocket")} variant="pilot" hideHeader hideFooter>
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={setUnitSystem} />
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
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left" />
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleOriginalSubmit} disabled={loadingOriginal}>
                {loadingOriginal ? t("loading") : t("calculate")}
              </Button>
            </div>
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
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left">
              {!originalResult ? <span className="ptp-actions__hint">{t("compareHint")}</span> : null}
            </div>
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleNewSubmit} disabled={loadingNew}>
                {loadingNew ? t("loading") : t("calculate")}
              </Button>
            </div>
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
