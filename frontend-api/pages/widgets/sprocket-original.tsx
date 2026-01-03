import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { ResultPanel } from "../../components/ResultPanel";
import { StatusPanel } from "../../components/StatusPanel";
import { SelectField } from "../../components/SelectField";
import { UnitSystem } from "../../components/UnitSystemSwitch";
import { UnitToggleButton } from "../../components/UnitToggleButton";
import { postJson, ApiError } from "../../lib/api";
import { postEmbedMessage } from "../../lib/embed";
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

type OriginalMessage = {
  type: "ptp:calc:sprocket:originalResult";
  pageId?: string;
  payload: SprocketResponse;
};

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

export default function SprocketOriginalWidget() {
  const { t } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
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
  const abortRef = useRef<AbortController | null>(null);

  const lengthUnit = unitSystem === "imperial" ? "in" : "mm";

  const toNumber = (value: string) => Number(value.replace(",", "."));

  const formatLength = (mmValue?: number | null, inValue?: number | null) => {
    if (mmValue === undefined || mmValue === null) return "-";
    if (unitSystem === "imperial") {
      return `${(inValue ?? mmValue / 25.4).toFixed(2)} ${lengthUnit}`;
    }
    return `${mmValue.toFixed(2)} ${lengthUnit}`;
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
        unit_system: unitSystem,
        inputs: {
          sprocket_teeth: toNumber(sprocket),
          crown_teeth: toNumber(crown),
          chain_pitch: pitch || undefined,
          chain_links: links ? toNumber(links) : undefined,
        },
      };

      const response = await postWithRetry(payload, controller.signal);
      setResult(response);
      const message: OriginalMessage = {
        type: "ptp:calc:sprocket:originalResult",
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
  }, [result, t, unitSystem]);

  return (
    <Layout title={t("sprocket")} hideHeader hideFooter variant="pilot">
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={setUnitSystem} />
          </div>
          {error ? <ErrorBanner message={error} /> : null}
          {retryHint ? <div className="ptp-field__helper">{retryHint}</div> : null}
          <div className="grid">
            <InputField
              label={t("sprocketLabel")}
              hint={t("hintSprocketTeeth")}
              placeholder="14"
              value={sprocket}
              onChange={setSprocket}
              inputMode="numeric"
              error={fieldErrors.sprocket_teeth}
            />
            <InputField
              label={t("crownLabel")}
              hint={t("hintCrownTeeth")}
              placeholder="42"
              value={crown}
              onChange={setCrown}
              inputMode="numeric"
              error={fieldErrors.crown_teeth}
            />
            <SelectField
              label={t("chainPitchLabel")}
              hint={t("hintChainPitch")}
              placeholder={t("selectPlaceholder")}
              value={pitch}
              onChange={setPitch}
              options={CHAIN_PITCH_OPTIONS.map((option) => ({ value: option, label: option }))}
              error={fieldErrors.chain_pitch}
            />
            <InputField
              label={t("chainLinksLabel")}
              hint={t("hintChainLinks")}
              placeholder="110"
              value={links}
              onChange={setLinks}
              inputMode="numeric"
              error={fieldErrors.chain_links}
            />
          </div>
          <div className="ptp-actions ptp-actions--spaced">
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loading ? <StatusPanel message={t("warmupMessage")} /> : null}
          {warmupNotice ? <div className="ptp-card">{warmupNotice}</div> : null}
          {result ? (
            <ResultPanel title={t("originalAssemblyResultsTitle")} items={resultsList} />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
