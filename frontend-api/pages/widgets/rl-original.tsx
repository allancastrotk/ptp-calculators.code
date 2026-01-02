import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { LoadingState } from "../../components/LoadingState";
import { ResultPanel } from "../../components/ResultPanel";
import { postJson, ApiError } from "../../lib/api";
import { postEmbedMessage } from "../../lib/embed";
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

type ResultItem = { label: string; value: string };

type OriginalMessage = {
  type: "ptp:calc:rl:originalResult";
  pageId?: string;
  payload: RLResponse;
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

export default function RlOriginalWidget() {
  const { t } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

  const [bore, setBore] = useState("");
  const [stroke, setStroke] = useState("");
  const [rodLength, setRodLength] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RLResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toNumber = (value: string) => Number(value.replace(",", "."));

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
        unit_system: "metric",
        inputs: {
          bore: toNumber(bore),
          stroke: toNumber(stroke),
          rod_length: toNumber(rodLength),
        },
      };

      const response = await postWithRetry(payload, controller.signal);
      setResult(response);
      const message: OriginalMessage = {
        type: "ptp:calc:rl:originalResult",
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
    return [
      { label: t("displacementCcLabel"), value: result.results.displacement_cc.toFixed(2) },
      {
        label: t("rlRatioLabel"),
        value: `${result.results.rl_ratio.toFixed(2)} (${formatSmoothness(result.results.smoothness)})`,
      },
      { label: t("rodStrokeLabel"), value: result.results.rod_stroke_ratio.toFixed(2) },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
    ];
  }, [result, t]);

  return (
    <Layout title={t("rl")} hideHeader hideFooter variant="pilot">
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalSection")}</div>
          </div>
          {error ? <ErrorBanner message={error} /> : null}
          {retryHint ? <div className="ptp-field__helper">{retryHint}</div> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel="mm"
              placeholder="58.0"
              value={bore}
              onChange={setBore}
              inputMode="decimal"
              error={fieldErrors.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel="mm"
              placeholder="50.0"
              value={stroke}
              onChange={setStroke}
              inputMode="decimal"
              error={fieldErrors.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel="mm"
              placeholder="100.0"
              value={rodLength}
              onChange={setRodLength}
              inputMode="decimal"
              error={fieldErrors.rod_length}
            />
          </div>
          <div className="ptp-actions ptp-actions--spaced">
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loading ? <LoadingState /> : null}
          {warmupNotice ? <div className="ptp-card">{warmupNotice}</div> : null}
          {result ? <ResultPanel title={t("originalResultsTitle")} items={resultsList} /> : null}
        </Card>
      </div>
    </Layout>
  );
}
