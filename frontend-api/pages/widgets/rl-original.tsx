import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CompressionToggleButton } from "../../components/CompressionToggleButton";
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
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionInputs, setCompressionInputs] = useState<CompressionInputs>(
    createCompressionInputs
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryHint, setRetryHint] = useState<string | null>(null);
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RLResponse | null>(null);
  const [resultUnit, setResultUnit] = useState<"metric" | "imperial" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toNumber = (value: string) => Number(value.replace(",", "."));
  const unitLabel = unitSystem === "imperial" ? "in" : "mm";
  const displacementUnit = unitSystem === "imperial" ? "cu in" : "cc";
  const volumeFactor = 16.387064;
  const convertLength = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / 25.4 : value * 25.4;
  const convertDisplacement = (value: number, from: UnitSystem, to: UnitSystem) => {
    if (from === to) return value;
    return from === "metric" ? value * 0.0610237441 : value / 0.0610237441;
  };
  const convertVolume = (value: number, from: UnitSystem, to: UnitSystem) => {
    if (from === to) return value;
    return from === "metric" ? value / volumeFactor : value * volumeFactor;
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
    setRodLength((value) => convertInput(value, unitSystem, nextUnit));
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
    if (compressionEnabled) {
      if (!compressionInputs.chamberVolume)
        nextErrors["compression.chamber_volume"] = t("required");
      if (!compressionInputs.gasketThickness)
        nextErrors["compression.gasket_thickness"] = t("required");
      if (!compressionInputs.gasketBore)
        nextErrors["compression.gasket_bore"] = t("required");
      if (!compressionInputs.deckHeight)
        nextErrors["compression.deck_height"] = t("required");
      if (!compressionInputs.pistonVolume)
        nextErrors["compression.piston_volume"] = t("required");
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
          rod_length: toNumber(rodLength),
          compression: compressionEnabled ? buildCompressionPayload(compressionInputs) : undefined,
        },
      };

      const response = await postWithRetry(payload, controller.signal);
      setResult(response);
      setResultUnit(response.unit_system || unitSystem);
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

  const renderSmoothness = (value: string) => {
    const key = `smoothness_${value}` as const;
    const className = `ptp-smoothness--${value}`;
    return <span className={className}>{t(key)}</span>;
  };

  const buildCompressionPayload = (inputs: CompressionInputs) => ({
    chamber_volume: toNumber(inputs.chamberVolume),
    gasket_thickness: toNumber(inputs.gasketThickness),
    gasket_bore: toNumber(inputs.gasketBore),
    deck_height: toNumber(inputs.deckHeight),
    piston_volume: toNumber(inputs.pistonVolume),
    exhaust_port_height: inputs.exhaustPortHeight ? toNumber(inputs.exhaustPortHeight) : undefined,
    transfer_port_height: inputs.transferPortHeight
      ? toNumber(inputs.transferPortHeight)
      : undefined,
    crankcase_volume: inputs.crankcaseVolume ? toNumber(inputs.crankcaseVolume) : undefined,
  });

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
        value: (
          <span>
            {result.results.rl_ratio.toFixed(2)} ({renderSmoothness(result.results.smoothness)})
          </span>
        ),
      },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
      { label: t("rodStrokeLabel"), value: result.results.rod_stroke_ratio.toFixed(2) },
    ];
  }, [result, resultUnit, t, unitSystem, displacementUnit]);

  const compressionResultsList = useMemo((): ResultItem[] => {
    const compression = result?.results.compression;
    if (!compression) return [];
    const resolvedUnit = resultUnit || result?.unit_system || "metric";
    const convertVolumeValue = (value: number) =>
      convertVolume(value, resolvedUnit, unitSystem);
    const volumeLabel = displacementUnit;

    const items: ResultItem[] = [
      {
        label: t("compressionRatioLabel"),
        value: compression.compression_ratio.toFixed(2),
      },
      {
        label: t("clearanceVolumeLabel"),
        value: `${convertVolumeValue(compression.clearance_volume).toFixed(2)} ${volumeLabel}`,
      },
      {
        label: t("sweptVolumeLabel"),
        value: `${convertVolumeValue(compression.swept_volume).toFixed(2)} ${volumeLabel}`,
      },
    ];

    if (compression.trapped_volume !== undefined && compression.trapped_volume !== null) {
      items.push({
        label: t("trappedVolumeLabel"),
        value: `${convertVolumeValue(compression.trapped_volume).toFixed(2)} ${volumeLabel}`,
      });
    }

    if (
      compression.crankcase_compression_ratio !== undefined &&
      compression.crankcase_compression_ratio !== null
    ) {
      items.push({
        label: t("crankcaseCompressionLabel"),
        value: compression.crankcase_compression_ratio.toFixed(2),
      });
    }

    return items;
  }, [result, resultUnit, t, unitSystem, displacementUnit]);

  const resultSections =
    compressionResultsList.length > 0
      ? [
          { items: resultsList },
          { title: t("compressionSectionTitle"), items: compressionResultsList },
        ]
      : undefined;

  return (
    <Layout title={t("rl")} hideHeader hideFooter variant="pilot">
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
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
              value={bore}
              onChange={setBore}
              inputMode="decimal"
              error={fieldErrors.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
              value={stroke}
              onChange={setStroke}
              inputMode="decimal"
              error={fieldErrors.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "3.94" : "100.0"}
              value={rodLength}
              onChange={setRodLength}
              inputMode="decimal"
              error={fieldErrors.rod_length}
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
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "2.40" : "39.3"}
                  value={compressionInputs.chamberVolume}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({ ...current, chamberVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.chamber_volume"]}
                />
                <InputField
                  label={t("gasketThicknessLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "0.04" : "1.0"}
                  value={compressionInputs.gasketThickness}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({ ...current, gasketThickness: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.gasket_thickness"]}
                />
                <InputField
                  label={t("gasketBoreLabel")}
                  unitLabel={unitLabel}
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
                  unitLabel={unitLabel}
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
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "-0.12" : "-2.0"}
                  value={compressionInputs.pistonVolume}
                  onChange={(value) =>
                    setCompressionInputs((current) => ({ ...current, pistonVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrors["compression.piston_volume"]}
                />
                <div className="ptp-divider">
                  <span>{t("compressionTwoStrokeSectionTitle")}</span>
                </div>
                <InputField
                  label={t("exhaustPortHeightLabel")}
                  unitLabel={unitLabel}
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
                  unitLabel={unitLabel}
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
                  unitLabel={displacementUnit}
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
                onChange={setCompressionEnabled}
              />
            </div>
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                {loading ? t("loading") : t("calculate")}
              </Button>
            </div>
          </div>
          {loading ? <StatusPanel message={t("warmupMessage")} /> : null}
          {warmupNotice ? <div className="ptp-card">{warmupNotice}</div> : null}
          {result ? (
            <ResultPanel
              title={t("originalAssemblyResultsTitle")}
              items={resultsList}
              sections={resultSections}
            />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
