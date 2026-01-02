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
import { formatNumericComparison } from "../../lib/comparison";
import { useI18n } from "../../lib/i18n";
import { TIRES_DB, VEHICLE_TYPES, VehicleType, getRimData, getWidthEntry } from "../../lib/tiresDb";

type TiresResponse = {
  calculator: string;
  unit_system: "metric" | "imperial";
  normalized_inputs: Record<string, unknown>;
  results: {
    diameter: number;
    width: number;
  };
  warnings?: string[];
  meta: { version: string; timestamp: string; source: string };
};

type ResultItem = { label: string; value: string };

type BaselineMessage = {
  type: "ptp:calc:tires:baseline";
  pageId?: string;
  payload: TiresResponse;
};

type TireInputs = {
  vehicleType: VehicleType | "";
  rim: string;
  width: string;
  aspect: string;
  rimWidth: string;
  flotationEnabled: boolean;
  flotation: string;
};

const allowedOrigins = new Set(["https://powertunepro.com", "https://www.powertunepro.com"]);

const createEmptyInputs = (): TireInputs => ({
  vehicleType: "",
  rim: "",
  width: "",
  aspect: "",
  rimWidth: "",
  flotationEnabled: false,
  flotation: "",
});

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

export default function TiresNewWidget() {
  const { t, language } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

  const [inputs, setInputs] = useState<TireInputs>(createEmptyInputs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TiresResponse | null>(null);
  const [baseline, setBaseline] = useState<TiresResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isEnglish = language === "en_US";
  const unitSystem = isEnglish ? "imperial" : "metric";
  const unitLabel = isEnglish ? "in" : "mm";
  const toNumber = (value: string) => Number(value.replace(",", "."));
  const hasFlotation = (vehicleType: VehicleType | "") =>
    vehicleType === "LightTruck" || vehicleType === "Kart" || vehicleType === "Kartcross";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const data = event.data as BaselineMessage;
      if (data?.type !== "ptp:calc:tires:baseline") return;
      if (!data.pageId || data.pageId !== pageId) return;
      setBaseline(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pageId]);

  const buildOptions = (vehicleType: VehicleType | "") => {
    if (!vehicleType) return { rims: [] };
    const vehicle = TIRES_DB[vehicleType];
    return { rims: vehicle.rims.map((rim) => String(rim)) };
  };

  const getWidths = (vehicleType: VehicleType | "", rim: string) => {
    if (!vehicleType || !rim) return [];
    const rimData = getRimData(vehicleType, rim);
    return rimData?.widths || [];
  };

  const getAspects = (vehicleType: VehicleType | "", rim: string, width: string) => {
    if (!vehicleType || !rim || !width) return [];
    const rimData = getRimData(vehicleType, rim);
    const entry = getWidthEntry(rimData, width);
    return entry?.aspects?.map((aspect: number) => String(aspect)) || [];
  };

  const getFlotation = (vehicleType: VehicleType | "", rim: string) => {
    if (!vehicleType || !rim) return [];
    if (!hasFlotation(vehicleType)) return [];
    const options: string[] = [];
    const rimData = getRimData(vehicleType, rim);
    (rimData?.widths || []).forEach((width: string) => {
      const entry = getWidthEntry(rimData, width);
      const flotation = entry?.flotation || [];
      options.push(...flotation);
    });
    return Array.from(new Set(options));
  };

  const resetDependent = (current: TireInputs, level: "vehicle" | "rim" | "width"): TireInputs => {
    if (level === "vehicle") {
      return { ...current, rim: "", width: "", aspect: "", flotation: "" };
    }
    if (level === "rim") {
      return { ...current, width: "", aspect: "", flotation: "" };
    }
    return { ...current, aspect: "" };
  };

  const validateInputs = (nextInputs: TireInputs) => {
    const errors: Record<string, string> = {};
    if (!nextInputs.vehicleType) errors.vehicle_type = t("required");
    if (!nextInputs.rim) errors.rim_in = t("required");
    if (nextInputs.flotationEnabled) {
      if (!nextInputs.flotation) errors.flotation = t("required");
    } else {
      if (!nextInputs.width) errors.width_mm = t("required");
      if (!nextInputs.aspect) errors.aspect_percent = t("required");
    }
    return errors;
  };

  const postWithRetry = async (payload: unknown, signal: AbortSignal) => {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        if (attempt > 0) {
          setWarmupNotice(t("warmupMessage"));
        }
        const response = await postJson<TiresResponse>("/api/v1/calc/tires", payload, signal);
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
    const errors = validateInputs(inputs);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
          vehicle_type: inputs.vehicleType,
          rim_in: toNumber(inputs.rim),
          width_mm: inputs.flotationEnabled ? undefined : toNumber(inputs.width),
          aspect_percent: inputs.flotationEnabled ? undefined : toNumber(inputs.aspect),
          flotation: inputs.flotationEnabled ? inputs.flotation : undefined,
          rim_width_in: inputs.rimWidth ? toNumber(inputs.rimWidth) : undefined,
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
      {
        label: t("tiresDiameterLabel"),
        value: `${result.results.diameter.toFixed(2)} ${unitLabel}`,
      },
      { label: t("tiresWidthLabel"), value: `${result.results.width.toFixed(2)} ${unitLabel}` },
    ];
  }, [result, t, unitLabel]);

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!baseline || !result) return [];
    const labels = {
      original: t("originalValueLabel"),
      newValue: t("newValueLabel"),
      diff: t("diffValueLabel"),
      diffPercent: t("diffPercentLabel"),
      na: t("notApplicableLabel"),
    };
    return [
      {
        label: t("tiresDiameterLabel"),
        value: formatNumericComparison(
          baseline.results.diameter,
          result.results.diameter,
          unitLabel,
          labels
        ),
      },
      {
        label: t("tiresWidthLabel"),
        value: formatNumericComparison(
          baseline.results.width,
          result.results.width,
          unitLabel,
          labels
        ),
      },
    ];
  }, [baseline, result, t, unitLabel]);

  const options = buildOptions(inputs.vehicleType);

  return (
    <Layout title={t("tires")} hideHeader hideFooter variant="pilot">
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
            <SelectField
              label={t("vehicleTypeLabel")}
              value={inputs.vehicleType}
              onChange={(value) =>
                setInputs(resetDependent({ ...inputs, vehicleType: value as VehicleType }, "vehicle"))
              }
              placeholder={t("selectPlaceholder")}
              options={VEHICLE_TYPES.map((vehicle) => ({ value: vehicle, label: t(vehicle) }))}
              error={fieldErrors.vehicle_type}
            />
            <SelectField
              label={t("rimLabel")}
              unitLabel="in"
              value={inputs.rim}
              onChange={(value) => setInputs(resetDependent({ ...inputs, rim: value }, "rim"))}
              placeholder={t("selectPlaceholder")}
              options={options.rims.map((rim) => ({ value: rim, label: rim }))}
              error={fieldErrors.rim_in}
            />
            {!inputs.flotationEnabled ? (
              <>
                <SelectField
                  label={t("widthLabel")}
                  value={inputs.width}
                  onChange={(value) => setInputs(resetDependent({ ...inputs, width: value }, "width"))}
                  placeholder={t("selectPlaceholder")}
                  options={getWidths(inputs.vehicleType, inputs.rim).map((width) => ({
                    value: width,
                    label: width,
                  }))}
                  error={fieldErrors.width_mm}
                />
                <SelectField
                  label={t("aspectLabel")}
                  value={inputs.aspect}
                  onChange={(value) => setInputs({ ...inputs, aspect: value })}
                  placeholder={t("selectPlaceholder")}
                  options={getAspects(inputs.vehicleType, inputs.rim, inputs.width).map((aspect) => ({
                    value: aspect,
                    label: aspect,
                  }))}
                  error={fieldErrors.aspect_percent}
                />
              </>
            ) : null}
            {hasFlotation(inputs.vehicleType) ? (
              <label className="ptp-field">
                <span className="ptp-field__label">{t("flotationLabel")}</span>
                <input
                  type="checkbox"
                  checked={inputs.flotationEnabled}
                  onChange={(event) =>
                    setInputs({
                      ...inputs,
                      flotationEnabled: event.target.checked,
                      flotation: "",
                      width: "",
                      aspect: "",
                    })
                  }
                />
              </label>
            ) : null}
            {inputs.flotationEnabled ? (
              <SelectField
                label={t("flotationLabel")}
                value={inputs.flotation}
                onChange={(value) => setInputs({ ...inputs, flotation: value })}
                placeholder={t("selectPlaceholder")}
                options={getFlotation(inputs.vehicleType, inputs.rim).map((option) => ({
                  value: option,
                  label: option,
                }))}
                error={fieldErrors.flotation}
              />
            ) : null}
            <InputField
              label={t("rimWidthLabel")}
              unitLabel="in"
              placeholder="7.0"
              value={inputs.rimWidth}
              onChange={(value) => setInputs({ ...inputs, rimWidth: value })}
              inputMode="decimal"
              error={fieldErrors.rim_width_in}
            />
          </div>
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            {!baseline && !result ? <div className="ptp-field__helper">{t("compareHintWidget")}</div> : <span />}
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculate")}
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
