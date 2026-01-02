import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { ResultPanel } from "../../components/ResultPanel";
import { StatusPanel } from "../../components/StatusPanel";
import { UnitSystem } from "../../components/UnitSystemSwitch";
import { UnitToggleButton } from "../../components/UnitToggleButton";
import { postJson, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

type RLResponse = {
  calculator: string;
  unit_system: "metric" | "imperial";
  normalized_inputs: {
    bore_mm: number;
    stroke_mm: number;
    rod_length_mm: number;
  };
  results: {
    displacement_cc: number;
    geometry: string;
    smoothness: string;
    rl_ratio: number;
    rod_stroke_ratio: number;
  };
  warnings?: string[];
  meta: { version: string; timestamp: string; source: string };
};

type ResultItem = { label: React.ReactNode; value: React.ReactNode };

type BaselineMessage = {
  type: "ptp:calc:rl:baseline";
  pageId?: string;
  payload: RLResponse;
};

const allowedOrigins = new Set(["https://powertunepro.com", "https://www.powertunepro.com"]);

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

export default function RlNewWidget() {
  const { t } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

  const [bore, setBore] = useState("");
  const [stroke, setStroke] = useState("");
  const [rodLength, setRodLength] = useState("");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RLResponse | null>(null);
  const [resultUnit, setResultUnit] = useState<"metric" | "imperial" | null>(null);
  const [baseline, setBaseline] = useState<RLResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setBore((value) => convertInput(value, unitSystem, nextUnit));
    setStroke((value) => convertInput(value, unitSystem, nextUnit));
    setRodLength((value) => convertInput(value, unitSystem, nextUnit));
    setUnitSystem(nextUnit);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const data = event.data as BaselineMessage;
      if (data?.type !== "ptp:calc:rl:baseline") return;
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
        const response = await postJson<RLResponse>("/api/v1/calc/rl", payload, signal);
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
    if (!rodLength) nextErrors.rod_length = t("required");
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
          rod_length: toNumber(rodLength),
        },
      };

      const response = await postWithRetry(payload, controller.signal);
      setResult(response);
      setResultUnit(response.unit_system || unitSystem);
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

  const formatGeometry = (value: string) => {
    const key = `geometry_${value}` as const;
    return t(key);
  };

  const formatSmoothness = (value: string) => {
    const key = `smoothness_${value}` as const;
    return t(key);
  };

  const resultsList = useMemo((): ResultItem[] => {
    if (!result) return [];
    const resolvedUnit = resultUnit || result.unit_system || "metric";
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
        value: `${result.results.rl_ratio.toFixed(2)} (${formatSmoothness(result.results.smoothness)})`,
      },
      { label: t("rodStrokeLabel"), value: result.results.rod_stroke_ratio.toFixed(2) },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
    ];
  }, [result, resultUnit, t, unitSystem, displacementUnit]);

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

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!baseline || !result) return [];
    const baselineUnit = baseline.unit_system || "metric";
    const resolvedUnit = resultUnit || result.unit_system || "metric";
    const baselineDisplacement = convertDisplacement(
      baseline.results.displacement_cc,
      baselineUnit,
      unitSystem
    );
    const resultDisplacement = convertDisplacement(
      result.results.displacement_cc,
      resolvedUnit,
      unitSystem
    );
    const rlDiff = result.results.rl_ratio - baseline.results.rl_ratio;
    const rlPercent = baseline.results.rl_ratio
      ? (rlDiff / baseline.results.rl_ratio) * 100
      : null;
    const rodDiff = result.results.rod_stroke_ratio - baseline.results.rod_stroke_ratio;
    const rodPercent = baseline.results.rod_stroke_ratio
      ? (rodDiff / baseline.results.rod_stroke_ratio) * 100
      : null;
    const displacementDiff = resultDisplacement - baselineDisplacement;
    const displacementPercent = baselineDisplacement
      ? (displacementDiff / baselineDisplacement) * 100
      : null;
    return [
      {
        label: renderDiffLabel(t("rlRatioLabel"), rlDiff),
        value: renderDiffValue(rlDiff, rlPercent),
      },
      {
        label: renderDiffLabel(t("rodStrokeLabel"), rodDiff),
        value: renderDiffValue(rodDiff, rodPercent),
      },
      {
        label: renderDiffLabel(t("displacementLabel"), displacementDiff),
        value: renderDiffValue(displacementDiff, displacementPercent, displacementUnit),
      },
    ];
  }, [baseline, result, resultUnit, t, unitSystem, displacementUnit]);

  return (
    <Layout title={t("rl")} hideHeader hideFooter variant="pilot">
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
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.52" : "64.0"}
              value={bore}
              onChange={setBore}
              inputMode="decimal"
              error={fieldErrors.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.13" : "54.0"}
              value={stroke}
              onChange={setStroke}
              inputMode="decimal"
              error={fieldErrors.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "4.13" : "105.0"}
              value={rodLength}
              onChange={setRodLength}
              inputMode="decimal"
              error={fieldErrors.rod_length}
            />
          </div>
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left">
              {!baseline && !result ? (
                <span className="ptp-actions__hint">{t("compareHintWidget")}</span>
              ) : null}
            </div>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loading ? <StatusPanel message={t("warmupMessage")} /> : null}
          {warmupNotice ? <div className="ptp-card">{warmupNotice}</div> : null}
          {result ? (
            <ResultPanel title={t("newAssemblyResultsTitle")} items={resultsList} />
          ) : null}
          {comparisonItems.length > 0 ? (
            <ResultPanel title={t("comparisonAssemblyTitle")} items={comparisonItems} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
