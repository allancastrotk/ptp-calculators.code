import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { LoadingState } from "../../components/LoadingState";
import { ResultPanel } from "../../components/ResultPanel";
import { SelectField } from "../../components/SelectField";
import { postJson, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

type SprocketResponse = {
  calculator: string;
  unit_system: "metric" | "imperial";
  normalized_inputs: {
    sprocket_teeth: number;
    crown_teeth: number;
    chain_pitch?: string | null;
    chain_links?: number | null;
  };
  results: {
    ratio: number;
    chain_length_mm?: number | null;
    chain_length_in?: number | null;
    center_distance_mm?: number | null;
    center_distance_in?: number | null;
  };
  warnings?: string[];
  meta: { version: string; timestamp: string; source: string };
};

type ResultItem = { label: string; value: string };

type BaselineMessage = {
  type: "ptp:calc:sprocket:baseline";
  pageId?: string;
  payload: SprocketResponse;
};

const allowedOrigins = new Set(["https://powertunepro.com", "https://www.powertunepro.com"]);
const CHAIN_PITCH_OPTIONS = ["415", "420", "428", "520", "525", "530", "630"];

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

export default function SprocketNewWidget() {
  const { t, language } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

  const [sprocket, setSprocket] = useState("");
  const [crown, setCrown] = useState("");
  const [pitch, setPitch] = useState("");
  const [links, setLinks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SprocketResponse | null>(null);
  const [baseline, setBaseline] = useState<SprocketResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isEnglish = language === "en_US";
  const lengthUnit = isEnglish ? "in" : "cm";

  const toNumber = (value: string) => Number(value.replace(",", "."));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const data = event.data as BaselineMessage;
      if (data?.type !== "ptp:calc:sprocket:baseline") return;
      if (!data.pageId || data.pageId !== pageId) return;
      setBaseline(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pageId]);

  const formatLength = (mmValue?: number | null, inValue?: number | null) => {
    if (mmValue === undefined || mmValue === null) return "-";
    if (isEnglish) {
      return `${(inValue ?? mmValue / 25.4).toFixed(2)} ${lengthUnit}`;
    }
    return `${(mmValue / 10).toFixed(2)} ${lengthUnit}`;
  };

  const formatDelta = (percent: number, absolute: number, unit?: string) => {
    const sign = absolute >= 0 ? "+" : "";
    const absoluteValue = unit ? `${sign}${absolute.toFixed(2)} ${unit}` : `${sign}${absolute.toFixed(2)}`;
    return `${percent.toFixed(2)}% (${absoluteValue})`;
  };

  const postWithRetry = async (payload: unknown, signal: AbortSignal) => {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        if (attempt > 0) {
          setWarmupNotice(t("warmupMessage"));
        }
        const response = await postJson<SprocketResponse>(
          "/api/v1/calc/sprocket",
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
    if (!sprocket) nextErrors.sprocket_teeth = t("required");
    if (!crown) nextErrors.crown_teeth = t("required");
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
          sprocket_teeth: toNumber(sprocket),
          crown_teeth: toNumber(crown),
          chain_pitch: pitch || undefined,
          chain_links: links ? toNumber(links) : undefined,
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
      setError(apiError.message || t("errorTitle"));
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
  }, [result, t]);

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!baseline || !result) return [];
    const items: ResultItem[] = [];

    if (baseline.results.ratio) {
      const diff = result.results.ratio - baseline.results.ratio;
      const percent = (diff / baseline.results.ratio) * 100;
      items.push({ label: t("sprocketDiffPercentLabel"), value: formatDelta(percent, diff) });
    }

    if (baseline.results.chain_length_mm && result.results.chain_length_mm) {
      const diff = result.results.chain_length_mm - baseline.results.chain_length_mm;
      const percent = (diff / baseline.results.chain_length_mm) * 100;
      const displayValue = isEnglish ? diff / 25.4 : diff / 10;
      items.push({
        label: t("chainLengthDiffLabel"),
        value: formatDelta(percent, displayValue, lengthUnit),
      });
    }

    if (baseline.results.center_distance_mm && result.results.center_distance_mm) {
      const diff = result.results.center_distance_mm - baseline.results.center_distance_mm;
      const percent = (diff / baseline.results.center_distance_mm) * 100;
      const displayValue = isEnglish ? diff / 25.4 : diff / 10;
      items.push({
        label: t("centerDistanceDiffLabel"),
        value: formatDelta(percent, displayValue, lengthUnit),
      });
    }

    return items;
  }, [baseline, isEnglish, lengthUnit, result, t]);

  return (
    <Layout title={t("sprocket")} hideHeader hideFooter variant="pilot">
      <div className="ptp-stack">
        {pageId ? null : (
          <Card>
            <div className="ptp-field__helper">{t("pageIdMissing")}</div>
          </Card>
        )}
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("newSection")}</div>
          </div>
          {error ? <ErrorBanner message={error} /> : null}
          {retryHint ? <div className="ptp-field__helper">{retryHint}</div> : null}
          <div className="grid">
            <InputField
              label={t("sprocketLabel")}
              placeholder="14"
              value={sprocket}
              onChange={setSprocket}
              inputMode="numeric"
              error={fieldErrors.sprocket_teeth}
            />
            <InputField
              label={t("crownLabel")}
              placeholder="42"
              value={crown}
              onChange={setCrown}
              inputMode="numeric"
              error={fieldErrors.crown_teeth}
            />
            <SelectField
              label={t("chainPitchLabel")}
              placeholder={t("selectPlaceholder")}
              value={pitch}
              onChange={setPitch}
              options={CHAIN_PITCH_OPTIONS.map((option) => ({ value: option, label: option }))}
              error={fieldErrors.chain_pitch}
            />
            <InputField
              label={t("chainLinksLabel")}
              placeholder="110"
              value={links}
              onChange={setLinks}
              inputMode="numeric"
              error={fieldErrors.chain_links}
            />
          </div>
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            {!baseline && !result ? <div className="ptp-field__helper">{t("compareHintWidget")}</div> : <span />}
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculateNew")}
            </Button>
          </div>
          {loading ? <LoadingState /> : null}
          {warmupNotice ? <div className="ptp-card">{warmupNotice}</div> : null}
          {result ? <ResultPanel title={t("newResultsTitle")} items={resultsList} /> : null}
          {comparisonItems.length > 0 ? (
            <ResultPanel title={t("comparisonNewTitle")} items={comparisonItems} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
