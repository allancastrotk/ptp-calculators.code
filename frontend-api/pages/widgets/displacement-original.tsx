import { useMemo, useRef, useState } from "react";
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

type ResultItem = { label: React.ReactNode; value: React.ReactNode };

type OriginalMessage = {
  type: "ptp:calc:displacement:originalResult";
  pageId?: string;
  payload: DisplacementResponse;
};

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
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DisplacementResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setBore((value) => convertInput(value, unitSystem, nextUnit));
    setStroke((value) => convertInput(value, unitSystem, nextUnit));
    setUnitSystem(nextUnit);
  };

  const formatGeometry = (value: string) => {
    const key = `geometry_${value}` as const;
    return t(key);
  };

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
          baseline_cc: baselineCc ? toNumber(baselineCc) : undefined,
        },
      };

      const response = await postWithRetry(payload, controller.signal);
      setResult(response);
      const message: OriginalMessage = {
        type: "ptp:calc:displacement:originalResult",
        pageId,
        payload: response,
      };
      postEmbedMessage(message);
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

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!result) return [];
    if (result.results.diff_percent === undefined || result.results.diff_percent === null) {
      return [];
    }
    const baseCc = result.normalized_inputs.baseline_cc;
    if (!baseCc) return [];
    const diffCc = result.results.displacement_cc - baseCc;
    return [
      {
        label: renderDiffLabel(t("displacementCcLabel"), diffCc),
        value: renderDiffValue(diffCc, result.results.diff_percent, "cc"),
      },
    ];
  }, [result, t]);

  return (
    <Layout title={t("displacement")} hideHeader hideFooter variant="pilot">
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={handleUnitChange} />
          </div>
          {error ? <ErrorBanner message={error} /> : null}
          {retryHint ? <div className="ptp-field__helper">{retryHint}</div> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
              value={bore}
              onChange={setBore}
              inputMode="decimal"
              error={fieldErrors.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitSystem === "imperial" ? "in" : "mm"}
              placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
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
            <InputField
              label={t("compareDeclaredLabel")}
              unitLabel="cc"
              placeholder={"528.4"}
              helper={t("compareDeclaredHelp")}
              value={baselineCc}
              onChange={setBaselineCc}
              inputMode="decimal"
              error={fieldErrors.baseline_cc}
            />
          </div>
          <div className="ptp-actions">
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loading ? <StatusPanel message={t("warmupMessage")} /> : null}
          {warmupNotice ? (
            <div className="ptp-card">
              <div className="ptp-field__helper">{warmupNotice}</div>
            </div>
          ) : null}
          {result ? (
            <ResultPanel title={t("originalAssemblyResultsTitle")} items={resultsList} />
          ) : null}
          {comparisonItems.length > 0 ? (
            <ResultPanel title={t("comparisonDeclaredTitle")} items={comparisonItems} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
