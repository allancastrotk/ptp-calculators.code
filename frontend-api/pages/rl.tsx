import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CompressionToggleButton } from "../components/CompressionToggleButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { ResultPanel } from "../components/ResultPanel";
import { StatusPanel } from "../components/StatusPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { UnitToggleButton } from "../components/UnitToggleButton";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type RLResponse = {
  unit_system?: "metric" | "imperial";
  results: {
    displacement_cc: number;
    geometry: string;
    smoothness: string;
    rl_ratio: number;
    rod_stroke_ratio: number;
    diff_rl_percent?: number | null;
    diff_displacement_percent?: number | null;
    compression?: {
      compression_ratio: number;
      clearance_volume: number;
      swept_volume: number;
      trapped_volume?: number | null;
      crankcase_compression_ratio?: number | null;
      compression_mode: "four_stroke" | "two_stroke";
    } | null;
  };
};

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

export default function RLPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [originalBore, setOriginalBore] = useState("");
  const [originalStroke, setOriginalStroke] = useState("");
  const [originalRod, setOriginalRod] = useState("");
  const [originalCompressionEnabled, setOriginalCompressionEnabled] = useState(false);
  const [originalCompression, setOriginalCompression] = useState<CompressionInputs>(
    createCompressionInputs
  );
  const [newBore, setNewBore] = useState("");
  const [newStroke, setNewStroke] = useState("");
  const [newRod, setNewRod] = useState("");
  const [newCompressionEnabled, setNewCompressionEnabled] = useState(false);
  const [newCompression, setNewCompression] = useState<CompressionInputs>(
    createCompressionInputs
  );
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);
  const [errorNew, setErrorNew] = useState<string | null>(null);
  const [fieldErrorsOriginal, setFieldErrorsOriginal] = useState<Record<string, string>>({});
  const [fieldErrorsNew, setFieldErrorsNew] = useState<Record<string, string>>({});
  const [originalResult, setOriginalResult] = useState<RLResponse | null>(null);
  const [newResult, setNewResult] = useState<RLResponse | null>(null);
  const [originalResultUnit, setOriginalResultUnit] = useState<"metric" | "imperial" | null>(
    null
  );
  const [newResultUnit, setNewResultUnit] = useState<"metric" | "imperial" | null>(null);
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

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
    setOriginalBore((value) => convertInput(value, unitSystem, nextUnit));
    setOriginalStroke((value) => convertInput(value, unitSystem, nextUnit));
    setOriginalRod((value) => convertInput(value, unitSystem, nextUnit));
    setOriginalCompression((current) => ({
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
    setNewBore((value) => convertInput(value, unitSystem, nextUnit));
    setNewStroke((value) => convertInput(value, unitSystem, nextUnit));
    setNewRod((value) => convertInput(value, unitSystem, nextUnit));
    setNewCompression((current) => ({
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

  const handleOriginalSubmit = async () => {
    setErrorOriginal(null);
    setFieldErrorsOriginal({});

    const nextErrors: Record<string, string> = {};
    if (!originalBore) nextErrors.bore = t("required");
    if (!originalStroke) nextErrors.stroke = t("required");
    if (!originalRod) nextErrors.rod_length = t("required");
    if (originalCompressionEnabled) {
      if (!originalCompression.chamberVolume)
        nextErrors["compression.chamber_volume"] = t("required");
      if (!originalCompression.gasketThickness)
        nextErrors["compression.gasket_thickness"] = t("required");
      if (!originalCompression.gasketBore)
        nextErrors["compression.gasket_bore"] = t("required");
      if (!originalCompression.deckHeight)
        nextErrors["compression.deck_height"] = t("required");
      if (!originalCompression.pistonVolume)
        nextErrors["compression.piston_volume"] = t("required");
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrorsOriginal(nextErrors);
      return;
    }

    if (abortOriginalRef.current) {
      abortOriginalRef.current.abort();
    }
    const controller = new AbortController();
    abortOriginalRef.current = controller;

    setLoadingOriginal(true);
    try {
      const payload = {
        unit_system: unitSystem,
        inputs: {
          bore: toNumber(originalBore),
          stroke: toNumber(originalStroke),
          rod_length: toNumber(originalRod),
          compression: originalCompressionEnabled
            ? buildCompressionPayload(originalCompression)
            : undefined,
        },
      };

      const response = await postJson<RLResponse>(
        "/api/v1/calc/rl",
        payload,
        controller.signal
      );
      setOriginalResult(response);
      setOriginalResultUnit(response.unit_system || unitSystem);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const apiError = err as ApiError;
      setErrorOriginal(apiError.message || t("errorTitle"));
      if (apiError.field_errors) {
        const mapped: Record<string, string> = {};
        apiError.field_errors.forEach((fieldError) => {
          const key = fieldError.field.replace("inputs.", "");
          mapped[key] = fieldError.reason;
        });
        setFieldErrorsOriginal(mapped);
      }
    } finally {
      setLoadingOriginal(false);
    }
  };

  const handleNewSubmit = async () => {
    setErrorNew(null);
    setFieldErrorsNew({});

    const nextErrors: Record<string, string> = {};
    if (!newBore) nextErrors.bore = t("required");
    if (!newStroke) nextErrors.stroke = t("required");
    if (!newRod) nextErrors.rod_length = t("required");
    if (newCompressionEnabled) {
      if (!newCompression.chamberVolume)
        nextErrors["compression.chamber_volume"] = t("required");
      if (!newCompression.gasketThickness)
        nextErrors["compression.gasket_thickness"] = t("required");
      if (!newCompression.gasketBore)
        nextErrors["compression.gasket_bore"] = t("required");
      if (!newCompression.deckHeight)
        nextErrors["compression.deck_height"] = t("required");
      if (!newCompression.pistonVolume)
        nextErrors["compression.piston_volume"] = t("required");
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrorsNew(nextErrors);
      return;
    }

    if (abortNewRef.current) {
      abortNewRef.current.abort();
    }
    const controller = new AbortController();
    abortNewRef.current = controller;

    setLoadingNew(true);
    try {
      const payload = {
        unit_system: unitSystem,
        inputs: {
          bore: toNumber(newBore),
          stroke: toNumber(newStroke),
          rod_length: toNumber(newRod),
          compression: newCompressionEnabled ? buildCompressionPayload(newCompression) : undefined,
          baseline: originalResult
            ? {
                bore: toNumber(originalBore),
                stroke: toNumber(originalStroke),
                rod_length: toNumber(originalRod),
              }
            : undefined,
        },
      };

      const response = await postJson<RLResponse>(
        "/api/v1/calc/rl",
        payload,
        controller.signal
      );
      setNewResult(response);
      setNewResultUnit(response.unit_system || unitSystem);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const apiError = err as ApiError;
      setErrorNew(apiError.message || t("errorTitle"));
      if (apiError.field_errors) {
        const mapped: Record<string, string> = {};
        apiError.field_errors.forEach((fieldError) => {
          const key = fieldError.field.replace("inputs.", "");
          mapped[key] = fieldError.reason;
        });
        setFieldErrorsNew(mapped);
      }
    } finally {
      setLoadingNew(false);
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

  const buildResults = (result: RLResponse | null, baseUnit: UnitSystem | null) => {
    if (!result) return [];
    const resolvedUnit = baseUnit || result.unit_system || "metric";
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
  };

  const buildCompressionItems = (
    result: RLResponse | null,
    baseUnit: UnitSystem | null
  ): { label: React.ReactNode; value: React.ReactNode }[] => {
    const compression = result?.results.compression;
    if (!compression) return [];
    const resolvedUnit = baseUnit || result?.unit_system || "metric";
    const convertVolumeValue = (value: number) =>
      convertVolume(value, resolvedUnit, unitSystem);
    const volumeLabel = displacementUnit;

    const items: { label: React.ReactNode; value: React.ReactNode }[] = [
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
  };

  const originalResultsList = useMemo(
    () => buildResults(originalResult, originalResultUnit),
    [originalResult, originalResultUnit, unitSystem]
  );
  const newResultsList = useMemo(
    () => buildResults(newResult, newResultUnit),
    [newResult, newResultUnit, unitSystem]
  );
  const originalCompressionResults = useMemo(
    () => buildCompressionItems(originalResult, originalResultUnit),
    [originalResult, originalResultUnit, unitSystem]
  );
  const newCompressionResults = useMemo(
    () => buildCompressionItems(newResult, newResultUnit),
    [newResult, newResultUnit, unitSystem]
  );

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

  const comparisonItems = useMemo(() => {
    if (!originalResult || !newResult) return [];
    const originalUnit = originalResultUnit || originalResult.unit_system || "metric";
    const newUnit = newResultUnit || newResult.unit_system || "metric";
    const originalDisplacement = convertDisplacement(
      originalResult.results.displacement_cc,
      originalUnit,
      unitSystem
    );
    const newDisplacement = convertDisplacement(
      newResult.results.displacement_cc,
      newUnit,
      unitSystem
    );

    const rlDiff = newResult.results.rl_ratio - originalResult.results.rl_ratio;
    const rlPercent = originalResult.results.rl_ratio
      ? (rlDiff / originalResult.results.rl_ratio) * 100
      : null;
    const rodDiff =
      newResult.results.rod_stroke_ratio - originalResult.results.rod_stroke_ratio;
    const rodPercent = originalResult.results.rod_stroke_ratio
      ? (rodDiff / originalResult.results.rod_stroke_ratio) * 100
      : null;
    const displacementDiff = newDisplacement - originalDisplacement;
    const displacementPercent = originalDisplacement
      ? (displacementDiff / originalDisplacement) * 100
      : null;

    return [
      {
        label: renderDiffLabel(t("displacementLabel"), displacementDiff),
        value: renderDiffValue(displacementDiff, displacementPercent, displacementUnit),
      },
      {
        label: renderDiffLabel(t("rlRatioLabel"), rlDiff),
        value: renderDiffValue(rlDiff, rlPercent),
      },
      {
        label: renderDiffLabel(t("rodStrokeLabel"), rodDiff),
        value: renderDiffValue(rodDiff, rodPercent),
      },
    ];
  }, [newResult, originalResult, originalResultUnit, newResultUnit, unitSystem, t]);

  const comparisonCompressionItems = useMemo(() => {
    if (!originalResult?.results.compression || !newResult?.results.compression) return [];
    const originalUnit = originalResultUnit || originalResult.unit_system || "metric";
    const newUnit = newResultUnit || newResult.unit_system || "metric";
    const convertOriginalVolume = (value: number) =>
      convertVolume(value, originalUnit, unitSystem);
    const convertNewVolume = (value: number) => convertVolume(value, newUnit, unitSystem);

    const originalCompression = originalResult.results.compression;
    const newCompression = newResult.results.compression;

    const diffRatio = newCompression.compression_ratio - originalCompression.compression_ratio;
    const diffRatioPercent = originalCompression.compression_ratio
      ? (diffRatio / originalCompression.compression_ratio) * 100
      : null;
    const diffClearance =
      convertNewVolume(newCompression.clearance_volume) -
      convertOriginalVolume(originalCompression.clearance_volume);
    const diffClearancePercent = originalCompression.clearance_volume
      ? (diffClearance / convertOriginalVolume(originalCompression.clearance_volume)) * 100
      : null;
    const diffSwept =
      convertNewVolume(newCompression.swept_volume) -
      convertOriginalVolume(originalCompression.swept_volume);
    const diffSweptPercent = originalCompression.swept_volume
      ? (diffSwept / convertOriginalVolume(originalCompression.swept_volume)) * 100
      : null;

    const items = [
      {
        label: renderDiffLabel(t("compressionRatioLabel"), diffRatio),
        value: renderDiffValue(diffRatio, diffRatioPercent),
      },
      {
        label: renderDiffLabel(t("clearanceVolumeLabel"), diffClearance),
        value: renderDiffValue(diffClearance, diffClearancePercent, displacementUnit),
      },
      {
        label: renderDiffLabel(t("sweptVolumeLabel"), diffSwept),
        value: renderDiffValue(diffSwept, diffSweptPercent, displacementUnit),
      },
    ];

    if (
      originalCompression.trapped_volume !== undefined &&
      originalCompression.trapped_volume !== null &&
      newCompression.trapped_volume !== undefined &&
      newCompression.trapped_volume !== null
    ) {
      const diffTrapped =
        convertNewVolume(newCompression.trapped_volume) -
        convertOriginalVolume(originalCompression.trapped_volume);
      const diffTrappedPercent = originalCompression.trapped_volume
        ? (diffTrapped / convertOriginalVolume(originalCompression.trapped_volume)) * 100
        : null;
      items.push({
        label: renderDiffLabel(t("trappedVolumeLabel"), diffTrapped),
        value: renderDiffValue(diffTrapped, diffTrappedPercent, displacementUnit),
      });
    }

    if (
      originalCompression.crankcase_compression_ratio !== undefined &&
      originalCompression.crankcase_compression_ratio !== null &&
      newCompression.crankcase_compression_ratio !== undefined &&
      newCompression.crankcase_compression_ratio !== null
    ) {
      const diffCrankcase =
        newCompression.crankcase_compression_ratio -
        originalCompression.crankcase_compression_ratio;
      const diffCrankcasePercent = originalCompression.crankcase_compression_ratio
        ? (diffCrankcase / originalCompression.crankcase_compression_ratio) * 100
        : null;
      items.push({
        label: renderDiffLabel(t("crankcaseCompressionLabel"), diffCrankcase),
        value: renderDiffValue(diffCrankcase, diffCrankcasePercent),
      });
    }

    return items;
  }, [
    originalResult,
    newResult,
    originalResultUnit,
    newResultUnit,
    unitSystem,
    t,
    displacementUnit,
  ]);

  const originalSections =
    originalCompressionResults.length > 0
      ? [
          { items: originalResultsList },
          { title: t("compressionSectionTitle"), items: originalCompressionResults },
        ]
      : undefined;
  const newSections =
    newCompressionResults.length > 0
      ? [
          { items: newResultsList },
          { title: t("compressionSectionTitle"), items: newCompressionResults },
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
    <Layout title={t("rl")} subtitle={t("unitLocked")} variant="pilot" hideHeader hideFooter>
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
            <UnitToggleButton value={unitSystem} onChange={handleUnitChange} />
          </div>
          {errorOriginal ? <ErrorBanner message={errorOriginal} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
              value={originalBore}
              onChange={setOriginalBore}
              inputMode="decimal"
              error={fieldErrorsOriginal.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
              value={originalStroke}
              onChange={setOriginalStroke}
              inputMode="decimal"
              error={fieldErrorsOriginal.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "3.94" : "100.0"}
              value={originalRod}
              onChange={setOriginalRod}
              inputMode="decimal"
              error={fieldErrorsOriginal.rod_length}
            />
          </div>
          {originalCompressionEnabled ? (
            <>
              <div className="ptp-divider">
                <span>{t("compressionSectionTitle")}</span>
              </div>
              <div className="grid">
                <InputField
                  label={t("chamberVolumeLabel")}
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "2.40" : "39.3"}
                  value={originalCompression.chamberVolume}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({ ...current, chamberVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.chamber_volume"]}
                />
                <InputField
                  label={t("gasketThicknessLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "0.04" : "1.0"}
                  value={originalCompression.gasketThickness}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({ ...current, gasketThickness: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.gasket_thickness"]}
                />
                <InputField
                  label={t("gasketBoreLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "2.72" : "69.0"}
                  value={originalCompression.gasketBore}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({ ...current, gasketBore: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.gasket_bore"]}
                />
                <InputField
                  label={t("deckHeightLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "0.00" : "0.0"}
                  value={originalCompression.deckHeight}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({ ...current, deckHeight: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.deck_height"]}
                />
                <InputField
                  label={t("pistonVolumeLabel")}
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "-0.12" : "-2.0"}
                  value={originalCompression.pistonVolume}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({ ...current, pistonVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.piston_volume"]}
                />
                <InputField
                  label={t("exhaustPortHeightLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "1.57" : "40.0"}
                  value={originalCompression.exhaustPortHeight}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({
                      ...current,
                      exhaustPortHeight: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.exhaust_port_height"]}
                />
                <InputField
                  label={t("transferPortHeightLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "1.89" : "48.0"}
                  value={originalCompression.transferPortHeight}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({
                      ...current,
                      transferPortHeight: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.transfer_port_height"]}
                />
                <InputField
                  label={t("crankcaseVolumeLabel")}
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "2.44" : "40.0"}
                  value={originalCompression.crankcaseVolume}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({
                      ...current,
                      crankcaseVolume: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.crankcase_volume"]}
                />
              </div>
            </>
          ) : null}
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left">
              <CompressionToggleButton
                value={originalCompressionEnabled}
                onChange={setOriginalCompressionEnabled}
              />
            </div>
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleOriginalSubmit} disabled={loadingOriginal}>
                {loadingOriginal ? t("loading") : t("calculate")}
              </Button>
            </div>
          </div>
          {loadingOriginal ? <StatusPanel message={t("warmupMessage")} /> : null}
          {originalResult ? (
            <ResultPanel
              title={t("originalAssemblyResultsTitle")}
              items={originalResultsList}
              sections={originalSections}
            />
          ) : null}
        </Card>
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("newAssemblySection")}</div>
          </div>
          {errorNew ? <ErrorBanner message={errorNew} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.52" : "64.0"}
              value={newBore}
              onChange={setNewBore}
              inputMode="decimal"
              error={fieldErrorsNew.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "2.13" : "54.0"}
              value={newStroke}
              onChange={setNewStroke}
              inputMode="decimal"
              error={fieldErrorsNew.stroke}
            />
            <InputField
              label={t("rodLengthLabel")}
              unitLabel={unitLabel}
              placeholder={unitSystem === "imperial" ? "4.13" : "105.0"}
              value={newRod}
              onChange={setNewRod}
              inputMode="decimal"
              error={fieldErrorsNew.rod_length}
            />
          </div>
          {newCompressionEnabled ? (
            <>
              <div className="ptp-divider">
                <span>{t("compressionSectionTitle")}</span>
              </div>
              <div className="grid">
                <InputField
                  label={t("chamberVolumeLabel")}
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "2.40" : "39.3"}
                  value={newCompression.chamberVolume}
                  onChange={(value) =>
                    setNewCompression((current) => ({ ...current, chamberVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.chamber_volume"]}
                />
                <InputField
                  label={t("gasketThicknessLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "0.04" : "1.0"}
                  value={newCompression.gasketThickness}
                  onChange={(value) =>
                    setNewCompression((current) => ({ ...current, gasketThickness: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.gasket_thickness"]}
                />
                <InputField
                  label={t("gasketBoreLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "2.72" : "69.0"}
                  value={newCompression.gasketBore}
                  onChange={(value) =>
                    setNewCompression((current) => ({ ...current, gasketBore: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.gasket_bore"]}
                />
                <InputField
                  label={t("deckHeightLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "0.00" : "0.0"}
                  value={newCompression.deckHeight}
                  onChange={(value) =>
                    setNewCompression((current) => ({ ...current, deckHeight: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.deck_height"]}
                />
                <InputField
                  label={t("pistonVolumeLabel")}
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "-0.12" : "-2.0"}
                  value={newCompression.pistonVolume}
                  onChange={(value) =>
                    setNewCompression((current) => ({ ...current, pistonVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.piston_volume"]}
                />
                <InputField
                  label={t("exhaustPortHeightLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "1.57" : "40.0"}
                  value={newCompression.exhaustPortHeight}
                  onChange={(value) =>
                    setNewCompression((current) => ({
                      ...current,
                      exhaustPortHeight: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.exhaust_port_height"]}
                />
                <InputField
                  label={t("transferPortHeightLabel")}
                  unitLabel={unitLabel}
                  placeholder={unitSystem === "imperial" ? "1.89" : "48.0"}
                  value={newCompression.transferPortHeight}
                  onChange={(value) =>
                    setNewCompression((current) => ({
                      ...current,
                      transferPortHeight: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.transfer_port_height"]}
                />
                <InputField
                  label={t("crankcaseVolumeLabel")}
                  unitLabel={displacementUnit}
                  placeholder={unitSystem === "imperial" ? "2.44" : "40.0"}
                  value={newCompression.crankcaseVolume}
                  onChange={(value) =>
                    setNewCompression((current) => ({
                      ...current,
                      crankcaseVolume: value,
                    }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.crankcase_volume"]}
                />
              </div>
            </>
          ) : null}
          <div className="ptp-actions ptp-actions--between ptp-actions--spaced">
            <div className="ptp-actions__left">
              <CompressionToggleButton
                value={newCompressionEnabled}
                onChange={setNewCompressionEnabled}
              />
              {!originalResult && !newResult ? (
                <span className="ptp-actions__hint">{t("compareHint")}</span>
              ) : null}
            </div>
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleNewSubmit} disabled={loadingNew}>
                {loadingNew ? t("loading") : t("calculate")}
              </Button>
            </div>
          </div>
          {loadingNew ? <StatusPanel message={t("warmupMessage")} /> : null}
          {newResult ? (
            <ResultPanel
              title={t("newAssemblyResultsTitle")}
              items={newResultsList}
              sections={newSections}
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
