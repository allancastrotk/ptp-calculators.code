import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { LoadingState } from "../../components/LoadingState";
import { ResultPanel } from "../../components/ResultPanel";
import { UnitSystem } from "../../components/UnitSystemSwitch";
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
  };
  warnings?: string[];
  meta: { version: string; timestamp: string; source: string };
};

type ResultItem = { label: string; value: string };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DisplacementResponse | null>(null);
  const [baseline, setBaseline] = useState<DisplacementResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      { label: "Displacement (cc)", value: result.results.displacement_cc.toFixed(2) },
      { label: "Displacement (L)", value: result.results.displacement_l.toFixed(2) },
      { label: "Displacement (cu in)", value: result.results.displacement_ci.toFixed(2) },
      { label: "Geometry", value: result.results.geometry },
    ];
  }, [result]);

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!baseline || !result) return [];
    const originalCc = baseline.results.displacement_cc;
    if (!originalCc) return [];
    const diffPercent = ((result.results.displacement_cc - originalCc) / originalCc) * 100;
    return [
      {
        label: "Diff vs Original (%)",
        value: `${diffPercent.toFixed(2)}%`,
      },
    ];
  }, [baseline, result]);

  return (
    <Layout title={t("displacement")} unitSystem={unitSystem} onUnitChange={setUnitSystem}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {pageId ? null : (
          <div className="card">
            <div className="subtitle">{t("pageIdMissing")}</div>
          </div>
        )}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t("newSection")}</div>
          {error ? <ErrorBanner message={error} /> : null}
          {retryHint ? <div className="subtitle">{retryHint}</div> : null}
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
          <button className="button" type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? t("loading") : t("calculateNew")}
          </button>
          {loading ? <LoadingState /> : null}
          {warmupNotice ? (
            <div className="card">
              <div className="subtitle">{warmupNotice}</div>
            </div>
          ) : null}
          {result ? <ResultPanel title={t("newResultsTitle")} items={resultsList} /> : null}
        </div>
        {comparisonItems.length > 0 ? (
          <ResultPanel title={t("comparisonTitle")} items={comparisonItems} />
        ) : (
          <ResultPanel
            title={t("comparisonTitle")}
            items={[{ label: t("comparisonStatusLabel"), value: t("compareHintWidget") }]}
          />
        )}
      </div>
    </Layout>
  );
}