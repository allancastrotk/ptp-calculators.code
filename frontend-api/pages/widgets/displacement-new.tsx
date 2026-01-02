import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import {
  CompressionMode,
  CompressionModeToggleButton,
} from "../../components/CompressionModeToggleButton";
import { CompressionToggleButton } from "../../components/CompressionToggleButton";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { ResultPanel } from "../../components/ResultPanel";
import { StatusPanel } from "../../components/StatusPanel";
import { UnitSystem } from "../../components/UnitSystemSwitch";
import { UnitToggleButton } from "../../components/UnitToggleButton";
import { postJson, ApiError } from "../../lib/api";
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
    compression?: {
      compression_ratio: number;
      clearance_volume: number;
      swept_volume: number;
      trapped_volume?: number | null;
      crankcase_compression_ratio?: number | null;
      compression_mode: "four_stroke" | "two_stroke";
    } | null;
  };
  warnings?: string[];
  meta: { version: string; timestamp: string; source: string };
};

type ResultItem = { label: React.ReactNode; value: React.ReactNode };

type CompressionInputs = {
  chamberVolume: string;
  gasketThickness: string;
  gasketBore: string;
  deckHeight: string;
  pistonVolume: string;
  exhaustPortHeight: string;
  transferPortHeight: string;
  crankcaseVolume: string;
};

const createCompressionInputs = (): CompressionInputs => ({
  chamberVolume: "",
  gasketThickness: "",
  gasketBore: "",
  deckHeight: "",
  pistonVolume: "",
  exhaustPortHeight: "",
  transferPortHeight: "",
  crankcaseVolume: "",
});

type BaselineMessage = {
  type: "ptp:calc:displacement:baseline";
  pageId?: string;
  payload: DisplacementResponse;
};

const allowedOrigins = new Set([
  "https://powertunepro.com",
  "https://www.powertunepro.com",
]);

const RETRY_DELAYS_MS = [800, 1600, 2400];
const RETRY_STATUSES = new Set([502, 503, 504]);

function isRetriable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status ? RETRY_STATUSES.has(status) : false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DisplacementNewWidget() {
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
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionMode, setCompressionMode] = useState<CompressionMode>("simple");
  const [compressionInputs, setCompressionInputs] = useState<CompressionInputs>(
    createCompressionInputs
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DisplacementResponse | null>(null);
  const [baseline, setBaseline] = useState<DisplacementResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toNumber = (value: string) => Number(value.replace(",", "."));
  const volumeFactor = 16.387064;
  const convertLength = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / 25.4 : value * 25.4;
  const convertVolume = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / volumeFactor : value * volumeFactor;
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
  const convertInputVolume = (value: string, from: UnitSystem, to: UnitSystem) => {
    if (!value) return value;
    const numeric = toNumber(value);
    if (Number.isNaN(numeric)) return value;
    return formatConverted(convertVolume(numeric, from, to));
  };
  const handleUnitChange = (nextUnit: UnitSystem) => {
    if (nextUnit === unitSystem) return;
    setBore((value) => convertInput(value, unitSystem, nextUnit));
    setStroke((value) => convertInput(value, unitSystem, nextUnit));
    setCompressionInputs((current) => ({
      ...current,
      chamberVolume: convertInputVolume(current.chamberVolume, unitSystem, nextUnit),
      gasketThickness: convertInput(current.gasketThickness, unitSystem, nextUnit),
      gasketBore: convertInput(current.gasketBore, unitSystem, nextUnit),
      deckHeight: convertInput(current.deckHeight, unitSystem, nextUnit),
      pistonVolume: convertInputVolume(current.pistonVolume, unitSystem, nextUnit),
      exhaustPortHeight: convertInput(current.exhaustPortHeight, unitSystem, nextUnit),
      transferPortHeight: convertInput(current.transferPortHeight, unitSystem, nextUnit),
      crankcaseVolume: convertInputVolume(current.crankcaseVolume, unitSystem, nextUnit),
    }));
    setUnitSystem(nextUnit);
  };

  const formatGeometry = (value: string) => {
    const key = `geometry_${value}` as const;
    return t(key);
  };

  const lengthUnit = unitSystem === "imperial" ? "in" : "mm";
  const volumeUnit = unitSystem === "imperial" ? "cu in" : "cc";

  const buildCompressionPayload = (inputs: CompressionInputs, mode: CompressionMode) => ({
    mode,
    chamber_volume: toNumber(inputs.chamberVolume),
    gasket_thickness: mode === "advanced" ? toNumber(inputs.gasketThickness) : undefined,
    gasket_bore: mode === "advanced" ? toNumber(inputs.gasketBore) : undefined,
    deck_height: mode === "advanced" ? toNumber(inputs.deckHeight) : undefined,
    piston_volume: mode === "advanced" ? toNumber(inputs.pistonVolume) : undefined,
    exhaust_port_height: inputs.exhaustPortHeight ? toNumber(inputs.exhaustPortHeight) : undefined,
    transfer_port_height: inputs.transferPortHeight
      ? toNumber(inputs.transferPortHeight)
      : undefined,
    crankcase_volume: inputs.crankcaseVolume ? toNumber(inputs.crankcaseVolume) : undefined,
  });

  const handleCompressionToggle = (next: boolean) => {
    setCompressionEnabled(next);
    if (next) setCompressionMode("simple");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const data = event.data as BaselineMessage;
      if (data?.type !== "ptp:calc:displacement:baseline") return;
      if (!data.pageId || data.pageId !== pageId) return;
      setBaseline(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pageId]);

  const postWithRetry = async (payload: unknown, signal: AbortSignal) => {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        if (attempt > 0) {
          setWarmupNotice(t("warmupMessage"));
        }
        const response = await postJson<DisplacementResponse>(
          "/api/v1/calc/displacement",
          payload,
          signal
        );
        setWarmupNotice(null);
        return response;
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err;
        const retriable = isRetriable(err);
        if (!retriable || attempt === RETRY_DELAYS_MS.length) {
          throw err;
        }
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
    throw new Error("Request failed");
  };

  const handleSubmit = async () => {
    setError(null);
    setRetryHint(null);
    setWarmupNotice(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!bore) nextErrors.bore = t("required");
    if (!stroke) nextErrors.stroke = t("required");
    if (!cylinders) nextErrors.cylinders = t("required");
    if (compressionEnabled) {
      if (!compressionInputs.chamberVolume)
        nextErrors["compression.chamber_volume"] = t("required");
      if (compressionMode === "advanced") {
        if (!compressionInputs.gasketThickness)
          nextErrors["compression.gasket_thickness"] = t("required");
        if (!compressionInputs.gasketBore)
          nextErrors["compression.gasket_bore"] = t("required");
        if (!compressionInputs.deckHeight)
          nextErrors["compression.deck_height"] = t("required");
        if (!compressionInputs.pistonVolume)
          nextErrors["compression.piston_volume"] = t("required");
      }
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
          bore: toNumber(bore),
          stroke: toNumber(stroke),
          cylinders: toNumber(cylinders),
          compression: compressionEnabled
            ? buildCompressionPayload(compressionInputs, compressionMode)
            : undefined,
        },
      };

      const response = await postWithRetry(payload, controller.signal);
      setResult(response);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (isRetriable(err)) {
        setRetryHint(t("retryHint"));
      }
      const apiError = err as ApiError;
      setError(apiError.message || "Request failed");
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
      { label: t("displacementCcLabel"), value: result.results.displacement_cc.toFixed(2) },
      { label: t("displacementLLabel"), value: result.results.displacement_l.toFixed(2) },
      { label: t("displacementCiLabel"), value: result.results.displacement_ci.toFixed(2) },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
    ];
  }, [result, t]);

  const compressionResultsList = useMemo((): ResultItem[] => {
    const compression = result?.results.compression;
    if (!compression) return [];
    return [
      {
        label: t("compressionRatioLabel"),
        value: compression.compression_ratio.toFixed(2),
      },
      {
        label: t("clearanceVolumeLabel"),
        value: `${compression.clearance_volume.toFixed(2)} ${volumeUnit}`,
      },
      {
        label: t("sweptVolumeLabel"),
        value: `${compression.swept_volume.toFixed(2)} ${volumeUnit}`,
      },
      ...(compression.trapped_volume !== undefined && compression.trapped_volume !== null
        ? [
            {
              label: t("trappedVolumeLabel"),
              value: `${compression.trapped_volume.toFixed(2)} ${volumeUnit}`,
            },
          ]
        : []),
      ...(compression.crankcase_compression_ratio !== undefined &&
      compression.crankcase_compression_ratio !== null
        ? [
            {
              label: t("crankcaseCompressionLabel"),
              value: compression.crankcase_compression_ratio.toFixed(2),
            },
          ]
        : []),
    ];
  }, [result, t, volumeUnit]);

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
    const unitSuffix = unit ? ` ${unit}` : "";
    return (
      <span className={`ptp-diff-value--${state}`}>
        {diff.toFixed(2)}
        {unitSuffix} [{percentText}]
      </span>
    );
  };

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!baseline || !result) return [];
    const diffCc = result.results.displacement_cc - baseline.results.displacement_cc;
    const diffL = result.results.displacement_l - baseline.results.displacement_l;
    const diffCi = result.results.displacement_ci - baseline.results.displacement_ci;
    const percentCc = baseline.results.displacement_cc
      ? (diffCc / baseline.results.displacement_cc) * 100
      : null;
    const percentL = baseline.results.displacement_l
      ? (diffL / baseline.results.displacement_l) * 100
      : null;
    const percentCi = baseline.results.displacement_ci
      ? (diffCi / baseline.results.displacement_ci) * 100
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
  }, [baseline, result, t]);

  const comparisonCompressionItems = useMemo((): ResultItem[] => {
    const baselineCompression = baseline?.results.compression;
    const resultCompression = result?.results.compression;
    if (!baselineCompression || !resultCompression) return [];

    const diffRatio = resultCompression.compression_ratio - baselineCompression.compression_ratio;
    const diffRatioPercent = baselineCompression.compression_ratio
      ? (diffRatio / baselineCompression.compression_ratio) * 100
      : null;
    const diffClearance =
      resultCompression.clearance_volume - baselineCompression.clearance_volume;
    const diffClearancePercent = baselineCompression.clearance_volume
      ? (diffClearance / baselineCompression.clearance_volume) * 100
      : null;
    const diffSwept = resultCompression.swept_volume - baselineCompression.swept_volume;
    const diffSweptPercent = baselineCompression.swept_volume
      ? (diffSwept / baselineCompression.swept_volume) * 100
      : null;

    const items: ResultItem[] = [
      {
        label: renderDiffLabel(t("compressionRatioLabel"), diffRatio),
        value: renderDiffValue(diffRatio, diffRatioPercent, ""),
      },
      {
        label: renderDiffLabel(t("clearanceVolumeLabel"), diffClearance),
        value: renderDiffValue(diffClearance, diffClearancePercent, volumeUnit),
      },
      {
        label: renderDiffLabel(t("sweptVolumeLabel"), diffSwept),
        value: renderDiffValue(diffSwept, diffSweptPercent, volumeUnit),
      },
    ];

    if (
      baselineCompression.trapped_volume !== undefined &&
      baselineCompression.trapped_volume !== null &&
      resultCompression.trapped_volume !== undefined &&
      resultCompression.trapped_volume !== null
    ) {
      const diffTrapped = resultCompression.trapped_volume - baselineCompression.trapped_volume;
      const diffTrappedPercent = baselineCompression.trapped_volume
        ? (diffTrapped / baselineCompression.trapped_volume) * 100
        : null;
      items.push({
        label: renderDiffLabel(t("trappedVolumeLabel"), diffTrapped),
        value: renderDiffValue(diffTrapped, diffTrappedPercent, volumeUnit),
      });
    }

    if (
      baselineCompression.crankcase_compression_ratio !== undefined &&
      baselineCompression.crankcase_compression_ratio !== null &&
      resultCompression.crankcase_compression_ratio !== undefined &&
      resultCompression.crankcase_compression_ratio !== null
    ) {
      const diffCrankcase =
        resultCompression.crankcase_compression_ratio -
        baselineCompression.crankcase_compression_ratio;
      const diffCrankcasePercent = baselineCompression.crankcase_compression_ratio
        ? (diffCrankcase / baselineCompression.crankcase_compression_ratio) * 100
        : null;
      items.push({
        label: renderDiffLabel(t("crankcaseCompressionLabel"), diffCrankcase),
        value: renderDiffValue(diffCrankcase, diffCrankcasePercent, ""),
      });
    }

    return items;
  }, [baseline, result, t, volumeUnit]);

  const resultSections =
    compressionResultsList.length > 0
      ? [
          { items: resultsList },
          { title: t("compressionSectionTitle"), items: compressionResultsList },
        ]
      : undefined;
  const comparisonSections =
    comparisonCompressionItems.length > 0
      ? [
          { items: comparisonItems },
          { title: t("compressionSectionTitle"), items: comparisonCompressionItems },
        ]
      : undefined;
  const hasComparisonResults =
    comparisonItems.length > 0 || comparisonCompressionItems.length > 0;

  return (
    <Layout title={t("displacement")} hideHeader hideFooter variant="pilot">
      <div className="ptp-stack">
        {pageId ? null : (
          <Card>
            <div className="ptp-field__helper">{t("pageIdMissing")}</div>
          </Card>
        )}
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("newAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={handleUnitChange} />
          </div>
          {error ? <ErrorBanner message={error} /> : null}
          {retryHint ? <div className="ptp-field__helper">{retryHint}</div> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "2.52" : "64.0"}
              value={bore}
              onChange={setBore}
              inputMode="decimal"
              error={fieldErrors.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "2.13" : "54.0"}
              value={stroke}
              onChange={setStroke}
              inputMode="decimal"
              error={fieldErrors.stroke}
            />
            <InputField
              label={t("cylindersLabel")}
              placeholder={"4"}
              value={cylinders}
              onChange={setCylinders}
              inputMode="numeric"
              error={fieldErrors.cylinders}
            />
          </div>
          {compressionEnabled ? (
            <>
              <div className="ptp-divider">
                <span>{t("compressionSectionTitle")}</span>
              </div>
              <div className="grid">
                <InputField
                  label={t("chamberVolumeLabel")}
                  unitLabel={volumeUnit}
                  placeholder={unitSystem === "imperial" ? "2.40" : "39.3"}
                  value={compressionInputs.chamberVolume}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({ ...current, chamberVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.chamber_volume"]}
                />
                {compressionMode === "advanced" ? (
                  <>
                    <InputField
                      label={t("gasketThicknessLabel")}
                      unitLabel={lengthUnit}
                      placeholder={unitSystem === "imperial" ? "0.04" : "1.0"}
                      value={compressionInputs.gasketThickness}
                      onChange={(value) =>
                        setCompressionInputs((current) => ({
                          ...current,
                          gasketThickness: value,
                        }))
                      }
                      inputMode="decimal"
                      error={fieldErrors["compression.gasket_thickness"]}
                    />
                    <InputField
                      label={t("gasketBoreLabel")}
                      unitLabel={lengthUnit}
                      placeholder={unitSystem === "imperial" ? "2.72" : "69.0"}
                      value={compressionInputs.gasketBore}
                      onChange={(value) =>
                        setCompressionInputs((current) => ({ ...current, gasketBore: value }))
                      }
                      inputMode="decimal"
                      error={fieldErrors["compression.gasket_bore"]}
                    />
                    <InputField
                      label={t("deckHeightLabel")}
                      unitLabel={lengthUnit}
                      placeholder={unitSystem === "imperial" ? "0.00" : "0.0"}
                      value={compressionInputs.deckHeight}
                      onChange={(value) =>
                        setCompressionInputs((current) => ({ ...current, deckHeight: value }))
                      }
                      inputMode="decimal"
                      error={fieldErrors["compression.deck_height"]}
                    />
                    <InputField
                      label={t("pistonVolumeLabel")}
                      unitLabel={volumeUnit}
                      placeholder={unitSystem === "imperial" ? "-0.12" : "-2.0"}
                      value={compressionInputs.pistonVolume}
                      onChange={(value) =>
                        setCompressionInputs((current) => ({ ...current, pistonVolume: value }))
                      }
                      inputMode="decimal"
                      error={fieldErrors["compression.piston_volume"]}
                    />
                  </>
                ) : null}
                <div className="ptp-divider ptp-grid-divider">
                  <span>{t("compressionTwoStrokeSectionTitle")}</span>
                </div>
                <InputField
                  label={t("exhaustPortHeightLabel")}
                  unitLabel={lengthUnit}
                  placeholder={unitSystem === "imperial" ? "1.57" : "40.0"}
                  value={compressionInputs.exhaustPortHeight}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({
                      ...current,
                      exhaustPortHeight: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.exhaust_port_height"]}
                />
                <InputField
                  label={t("transferPortHeightLabel")}
                  unitLabel={lengthUnit}
                  placeholder={unitSystem === "imperial" ? "1.89" : "48.0"}
                  value={compressionInputs.transferPortHeight}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({
                      ...current,
                      transferPortHeight: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.transfer_port_height"]}
                />
                <InputField
                  label={t("crankcaseVolumeLabel")}
                  unitLabel={volumeUnit}
                  placeholder={unitSystem === "imperial" ? "2.44" : "40.0"}
                  value={compressionInputs.crankcaseVolume}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({
                      ...current,
                      crankcaseVolume: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.crankcase_volume"]}
                />
              </div>
            </>
          ) : null}
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left">
              <CompressionToggleButton
                value={compressionEnabled}
                onChange={handleCompressionToggle}
              />
              {compressionEnabled ? (
                <CompressionModeToggleButton
                  value={compressionMode}
                  onChange={setCompressionMode}
                />
              ) : null}
              {!baseline && !result ? (
                <span className="ptp-actions__hint">{t("compareHintWidget")}</span>
              ) : null}
            </div>
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                {loading ? t("loading") : t("calculate")}
              </Button>
            </div>
          </div>
          {loading ? <StatusPanel message={t("warmupMessage")} /> : null}
          {warmupNotice ? (
            <div className="ptp-card">
              <div className="ptp-field__helper">{warmupNotice}</div>
            </div>
          ) : null}
          {result ? (
            <ResultPanel
              title={t("newAssemblyResultsTitle")}
              items={resultsList}
              sections={resultSections}
            />
          ) : null}
          {hasComparisonResults ? (
            <ResultPanel
              title={t("comparisonAssemblyTitle")}
              items={comparisonItems}
              sections={comparisonSections}
            />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
