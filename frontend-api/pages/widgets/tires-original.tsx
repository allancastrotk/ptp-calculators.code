import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { MeasureToggleButton } from "../../components/MeasureToggleButton";
import { ResultPanel } from "../../components/ResultPanel";
import { SelectField } from "../../components/SelectField";
import { StatusPanel } from "../../components/StatusPanel";
import { UnitSystem } from "../../components/UnitSystemSwitch";
import { UnitToggleButton } from "../../components/UnitToggleButton";
import { postJson, ApiError } from "../../lib/api";
import { postEmbedMessage } from "../../lib/embed";
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

type ResultItem = { label: React.ReactNode; value: React.ReactNode };

type OriginalMessage = {
  type: "ptp:calc:tires:originalResult";
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

export default function TiresOriginalWidget() {
  const { t, language } = useI18n();
  const router = useRouter();
  const pageId = useMemo(() => {
    const value = router.query.pageId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }, [router.query.pageId]);

  const [inputs, setInputs] = useState<TireInputs>(createEmptyInputs);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TiresResponse | null>(null);
  const [resultUnit, setResultUnit] = useState<"metric" | "imperial" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const unitLabel = unitSystem === "imperial" ? "in" : "mm";
  const toNumber = (value: string) => Number(value.replace(",", "."));
  const convertValue = (value: number, from?: "metric" | "imperial") => {
    if (!from || from === unitSystem) return value;
    return from === "metric" ? value / 25.4 : value * 25.4;
  };
  const hasFlotation = (vehicleType: VehicleType | "") =>
    vehicleType === "LightTruck" ||
    vehicleType === "Kart" ||
    vehicleType === "Kartcross" ||
    vehicleType === "Motorcycle";

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

  const toggleMeasure = () => {
    setInputs((current) => ({
      ...current,
      flotationEnabled: !current.flotationEnabled,
      flotation: "",
      width: "",
      aspect: "",
    }));
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
      setResultUnit(response.unit_system || unitSystem);
      const message: OriginalMessage = {
        type: "ptp:calc:tires:originalResult",
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
    const resolvedUnit = resultUnit || result.unit_system || "metric";
    const diameterOut = convertValue(result.results.diameter, resolvedUnit);
    const widthOut = convertValue(result.results.width, resolvedUnit);
    const items = [
      {
        label: t("tiresDiameterLabel"),
        value: `${diameterOut.toFixed(2)} ${unitLabel}`,
      },
      { label: t("tiresWidthLabel"), value: `${widthOut.toFixed(2)} ${unitLabel}` },
    ];

    if (!inputs.flotationEnabled && inputs.width && inputs.rimWidth) {
      const rimWidthMm = toNumber(inputs.rimWidth) * 25.4;
      const widthMm = toNumber(inputs.width);
      const deltaMm = widthMm - rimWidthMm;
      const delta = unitSystem === "imperial" ? deltaMm / 25.4 : deltaMm;
      items.push({
        label: t("tireRimDeltaLabel"),
        value: `${delta.toFixed(2)} ${unitLabel}`,
      });
    }

    return items;
  }, [inputs, result, resultUnit, t, unitLabel, unitSystem]);

  const options = buildOptions(inputs.vehicleType);

  return (
    <Layout title={t("tires")} hideHeader hideFooter variant="pilot">
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={setUnitSystem} />
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
                  unitLabel="mm"
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
                  unitLabel="%"
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
            {hasFlotation(inputs.vehicleType) ? (
              <MeasureToggleButton
                value={inputs.flotationEnabled}
                onChange={toggleMeasure}
                label={t("measureLabel")}
                metricLabel={t("measureMetricLabel")}
                flotationLabel={t("measureFlotationLabel")}
              />
            ) : (
              <span />
            )}
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
