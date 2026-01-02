import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import {
  CompressionMode,
  CompressionModeToggleButton,
} from "../components/CompressionModeToggleButton";
import { CompressionToggleButton } from "../components/CompressionToggleButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { ResultPanel } from "../components/ResultPanel";
import { StatusPanel } from "../components/StatusPanel";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

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

export default function DisplacementPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [originalBore, setOriginalBore] = useState("");
  const [originalStroke, setOriginalStroke] = useState("");
  const [originalCylinders, setOriginalCylinders] = useState("");
  const [baselineCc, setBaselineCc] = useState("");
  const [originalCompressionEnabled, setOriginalCompressionEnabled] = useState(false);
  const [originalCompressionMode, setOriginalCompressionMode] =
    useState<CompressionMode>("simple");
  const [originalCompression, setOriginalCompression] = useState<CompressionInputs>(
    createCompressionInputs
  );
  const [newBore, setNewBore] = useState("");
  const [newStroke, setNewStroke] = useState("");
  const [newCylinders, setNewCylinders] = useState("");
  const [newCompressionEnabled, setNewCompressionEnabled] = useState(false);
  const [newCompressionMode, setNewCompressionMode] =
    useState<CompressionMode>("simple");
  const [newCompression, setNewCompression] = useState<CompressionInputs>(
    createCompressionInputs
  );
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);
  const [errorNew, setErrorNew] = useState<string | null>(null);
  const [fieldErrorsOriginal, setFieldErrorsOriginal] = useState<Record<string, string>>({});
  const [fieldErrorsNew, setFieldErrorsNew] = useState<Record<string, string>>({});
  const [originalResult, setOriginalResult] = useState<DisplacementResponse | null>(null);
  const [newResult, setNewResult] = useState<DisplacementResponse | null>(null);
  const abortOriginalRef = useRef<AbortController | null>(null);
  const abortNewRef = useRef<AbortController | null>(null);

  const toNumber = (value: string) => Number(value.replace(",", "."));
  const volumeFactor = 16.387064;
  const convertLength = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / 25.4 : value * 25.4;
  const convertVolume = (value: number, from: UnitSystem, to: UnitSystem) =>
    from === to ? value : from === "metric" ? value / volumeFactor : value * volumeFactor;
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
    setNewBore((value) => convertInput(value, unitSystem, nextUnit));
    setNewStroke((value) => convertInput(value, unitSystem, nextUnit));
    setBaselineCc((value) => convertInputVolume(value, unitSystem, nextUnit));
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

  const formatGeometry = (value: string) => {
    const key = `geometry_${value}` as const;
    return t(key);
  };

  const lengthUnit = unitSystem === "imperial" ? "in" : "mm";
  const volumeUnit = unitSystem === "imperial" ? "cu in" : "cc";

  const buildCompressionPayload = (inputs: CompressionInputs, mode: CompressionMode) => ({
    mode,
    chamber_volume: toNumber(inputs.chamberVolume),
    gasket_thickness:
      mode === "advanced" ? toNumber(inputs.gasketThickness) : undefined,
    gasket_bore: mode === "advanced" ? toNumber(inputs.gasketBore) : undefined,
    deck_height: mode === "advanced" ? toNumber(inputs.deckHeight) : undefined,
    piston_volume: mode === "advanced" ? toNumber(inputs.pistonVolume) : undefined,
    exhaust_port_height: inputs.exhaustPortHeight ? toNumber(inputs.exhaustPortHeight) : undefined,
    transfer_port_height: inputs.transferPortHeight
      ? toNumber(inputs.transferPortHeight)
      : undefined,
    crankcase_volume: inputs.crankcaseVolume ? toNumber(inputs.crankcaseVolume) : undefined,
  });

  const handleOriginalCompressionToggle = (next: boolean) => {
    setOriginalCompressionEnabled(next);
    if (next) setOriginalCompressionMode("simple");
  };

  const handleNewCompressionToggle = (next: boolean) => {
    setNewCompressionEnabled(next);
    if (next) setNewCompressionMode("simple");
  };

  const handleOriginalSubmit = async () => {
    setErrorOriginal(null);
    setFieldErrorsOriginal({});

    const nextErrors: Record<string, string> = {};
    if (!originalBore) nextErrors.bore = t("required");
    if (!originalStroke) nextErrors.stroke = t("required");
    if (!originalCylinders) nextErrors.cylinders = t("required");
    if (originalCompressionEnabled) {
      if (!originalCompression.chamberVolume)
        nextErrors["compression.chamber_volume"] = t("required");
      if (originalCompressionMode === "advanced") {
        if (!originalCompression.gasketThickness)
          nextErrors["compression.gasket_thickness"] = t("required");
        if (!originalCompression.gasketBore)
          nextErrors["compression.gasket_bore"] = t("required");
        if (!originalCompression.deckHeight)
          nextErrors["compression.deck_height"] = t("required");
        if (!originalCompression.pistonVolume)
          nextErrors["compression.piston_volume"] = t("required");
      }
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
          cylinders: toNumber(originalCylinders),
          baseline_cc: baselineCc ? toNumber(baselineCc) : undefined,
          compression: originalCompressionEnabled
            ? buildCompressionPayload(originalCompression, originalCompressionMode)
            : undefined,
        },
      };

      const response = await postJson<DisplacementResponse>(
        "/api/v1/calc/displacement",
        payload,
        controller.signal
      );
      setOriginalResult(response);
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
    if (!newCylinders) nextErrors.cylinders = t("required");
    if (newCompressionEnabled) {
      if (!newCompression.chamberVolume)
        nextErrors["compression.chamber_volume"] = t("required");
      if (newCompressionMode === "advanced") {
        if (!newCompression.gasketThickness)
          nextErrors["compression.gasket_thickness"] = t("required");
        if (!newCompression.gasketBore)
          nextErrors["compression.gasket_bore"] = t("required");
        if (!newCompression.deckHeight)
          nextErrors["compression.deck_height"] = t("required");
        if (!newCompression.pistonVolume)
          nextErrors["compression.piston_volume"] = t("required");
      }
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
          cylinders: toNumber(newCylinders),
          compression: newCompressionEnabled
            ? buildCompressionPayload(newCompression, newCompressionMode)
            : undefined,
        },
      };

      const response = await postJson<DisplacementResponse>(
        "/api/v1/calc/displacement",
        payload,
        controller.signal
      );
      setNewResult(response);
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

  const buildResultsList = (result: DisplacementResponse | null): ResultItem[] => {
    if (!result) return [];
    return [
      { label: t("displacementCcLabel"), value: result.results.displacement_cc.toFixed(2) },
      { label: t("displacementLLabel"), value: result.results.displacement_l.toFixed(2) },
      { label: t("displacementCiLabel"), value: result.results.displacement_ci.toFixed(2) },
      { label: t("geometryLabel"), value: formatGeometry(result.results.geometry) },
    ];
  };

  const buildCompressionItems = (result: DisplacementResponse | null): ResultItem[] => {
    const compression = result?.results.compression;
    if (!compression) return [];
    return [
      {
        label: t("compressionRatioLabel"),
        value: compression.compression_ratio.toFixed(2),
      },
      {
        label: t("clearanceVolumeLabel"),
        value: `${compression.clearance_volume.toFixed(2)} ${volumeUnit}`,
      },
      {
        label: t("sweptVolumeLabel"),
        value: `${compression.swept_volume.toFixed(2)} ${volumeUnit}`,
      },
      ...(compression.trapped_volume !== undefined && compression.trapped_volume !== null
        ? [
            {
              label: t("trappedVolumeLabel"),
              value: `${compression.trapped_volume.toFixed(2)} ${volumeUnit}`,
            },
          ]
        : []),
      ...(compression.crankcase_compression_ratio !== undefined &&
      compression.crankcase_compression_ratio !== null
        ? [
            {
              label: t("crankcaseCompressionLabel"),
              value: compression.crankcase_compression_ratio.toFixed(2),
            },
          ]
        : []),
    ];
  };

  const originalResultsList = useMemo(
    () => buildResultsList(originalResult),
    [originalResult]
  );
  const newResultsList = useMemo(() => buildResultsList(newResult), [newResult]);
  const originalCompressionResults = useMemo(
    () => buildCompressionItems(originalResult),
    [originalResult, volumeUnit]
  );
  const newCompressionResults = useMemo(
    () => buildCompressionItems(newResult),
    [newResult, volumeUnit]
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

  const renderDiffValue = (diff: number, percent: number | null, unit: string) => {
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

  const comparisonDeclaredItems = useMemo((): ResultItem[] => {
    if (!originalResult) return [];
    const percent = originalResult.results.diff_percent ?? null;
    if (percent === null || percent === undefined) return [];
    const baseCc = originalResult.normalized_inputs.baseline_cc;
    if (!baseCc) return [];
    const diffCc = originalResult.results.displacement_cc - baseCc;
    return [
      {
        label: renderDiffLabel(t("displacementCcLabel"), diffCc),
        value: renderDiffValue(diffCc, percent, "cc"),
      },
    ];
  }, [originalResult, t]);

  const comparisonItems = useMemo((): ResultItem[] => {
    if (!originalResult || !newResult) return [];
    const diffCc = newResult.results.displacement_cc - originalResult.results.displacement_cc;
    const diffL = newResult.results.displacement_l - originalResult.results.displacement_l;
    const diffCi = newResult.results.displacement_ci - originalResult.results.displacement_ci;
    const percentCc = originalResult.results.displacement_cc
      ? (diffCc / originalResult.results.displacement_cc) * 100
      : null;
    const percentL = originalResult.results.displacement_l
      ? (diffL / originalResult.results.displacement_l) * 100
      : null;
    const percentCi = originalResult.results.displacement_ci
      ? (diffCi / originalResult.results.displacement_ci) * 100
      : null;
    return [
      {
        label: renderDiffLabel(t("displacementCcLabel"), diffCc),
        value: renderDiffValue(diffCc, percentCc, "cc"),
      },
      {
        label: renderDiffLabel(t("displacementLLabel"), diffL),
        value: renderDiffValue(diffL, percentL, "L"),
      },
      {
        label: renderDiffLabel(t("displacementCiLabel"), diffCi),
        value: renderDiffValue(diffCi, percentCi, "cu in"),
      },
    ];
  }, [originalResult, newResult, t]);

  const comparisonCompressionItems = useMemo((): ResultItem[] => {
    const originalCompression = originalResult?.results.compression;
    const newCompression = newResult?.results.compression;
    if (!originalCompression || !newCompression) return [];

    const diffRatio = newCompression.compression_ratio - originalCompression.compression_ratio;
    const diffRatioPercent = originalCompression.compression_ratio
      ? (diffRatio / originalCompression.compression_ratio) * 100
      : null;
    const diffClearance = newCompression.clearance_volume - originalCompression.clearance_volume;
    const diffClearancePercent = originalCompression.clearance_volume
      ? (diffClearance / originalCompression.clearance_volume) * 100
      : null;
    const diffSwept = newCompression.swept_volume - originalCompression.swept_volume;
    const diffSweptPercent = originalCompression.swept_volume
      ? (diffSwept / originalCompression.swept_volume) * 100
      : null;

    const items: ResultItem[] = [
      {
        label: renderDiffLabel(t("compressionRatioLabel"), diffRatio),
        value: renderDiffValue(diffRatio, diffRatioPercent, ""),
      },
      {
        label: renderDiffLabel(t("clearanceVolumeLabel"), diffClearance),
        value: renderDiffValue(diffClearance, diffClearancePercent, volumeUnit),
      },
      {
        label: renderDiffLabel(t("sweptVolumeLabel"), diffSwept),
        value: renderDiffValue(diffSwept, diffSweptPercent, volumeUnit),
      },
    ];

    if (
      originalCompression.trapped_volume !== undefined &&
      originalCompression.trapped_volume !== null &&
      newCompression.trapped_volume !== undefined &&
      newCompression.trapped_volume !== null
    ) {
      const diffTrapped = newCompression.trapped_volume - originalCompression.trapped_volume;
      const diffTrappedPercent = originalCompression.trapped_volume
        ? (diffTrapped / originalCompression.trapped_volume) * 100
        : null;
      items.push({
        label: renderDiffLabel(t("trappedVolumeLabel"), diffTrapped),
        value: renderDiffValue(diffTrapped, diffTrappedPercent, volumeUnit),
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
        value: renderDiffValue(diffCrankcase, diffCrankcasePercent, ""),
      });
    }

    return items;
  }, [originalResult, newResult, t, volumeUnit]);

  const handleClear = () => {
    setOriginalResult(null);
    setNewResult(null);
    setErrorOriginal(null);
    setErrorNew(null);
    setFieldErrorsOriginal({});
    setFieldErrorsNew({});
  };

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
    <Layout
      title={t("displacement")}
      unitSystem={unitSystem}
      onUnitChange={handleUnitChange}
      variant="pilot"
    >
      <div className="ptp-stack">
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("originalAssemblySection")}</div>
          </div>
          {errorOriginal ? <ErrorBanner message={errorOriginal} /> : null}
          <div className="grid">
            <InputField
              label={t("boreLabel")}
              unitLabel={lengthUnit}
              placeholder={unitSystem === "imperial" ? "2.28" : "58.0"}
              value={originalBore}
              onChange={setOriginalBore}
              inputMode="decimal"
              error={fieldErrorsOriginal.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={lengthUnit}
              placeholder={unitSystem === "imperial" ? "1.97" : "50.0"}
              value={originalStroke}
              onChange={setOriginalStroke}
              inputMode="decimal"
              error={fieldErrorsOriginal.stroke}
            />
            <InputField
              label={t("cylindersLabel")}
              placeholder={"4"}
              value={originalCylinders}
              onChange={setOriginalCylinders}
              inputMode="numeric"
              error={fieldErrorsOriginal.cylinders}
            />
            <InputField
              label={t("compareDeclaredLabel")}
              unitLabel={volumeUnit}
              placeholder={"528.4"}
              helper={t("compareDeclaredHelp")}
              value={baselineCc}
              onChange={setBaselineCc}
              inputMode="decimal"
              error={fieldErrorsOriginal.baseline_cc}
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
                  unitLabel={volumeUnit}
                  placeholder={unitSystem === "imperial" ? "2.40" : "39.3"}
                  value={originalCompression.chamberVolume}
                  onChange={(value) =>
                    setOriginalCompression((current) => ({ ...current, chamberVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsOriginal["compression.chamber_volume"]}
                />
                {originalCompressionMode === "advanced" ? (
                  <>
                    <InputField
                      label={t("gasketThicknessLabel")}
                      unitLabel={lengthUnit}
                      placeholder={unitSystem === "imperial" ? "0.04" : "1.0"}
                      value={originalCompression.gasketThickness}
                      onChange={(value) =>
                        setOriginalCompression((current) => ({
                          ...current,
                          gasketThickness: value,
                        }))
                      }
                      inputMode="decimal"
                      error={fieldErrorsOriginal["compression.gasket_thickness"]}
                    />
                    <InputField
                      label={t("gasketBoreLabel")}
                      unitLabel={lengthUnit}
                      placeholder={unitSystem === "imperial" ? "2.72" : "69.0"}
                      value={originalCompression.gasketBore}
                      onChange={(value) =>
                        setOriginalCompression((current) => ({
                          ...current,
                          gasketBore: value,
                        }))
                      }
                      inputMode="decimal"
                      error={fieldErrorsOriginal["compression.gasket_bore"]}
                    />
                    <InputField
                      label={t("deckHeightLabel")}
                      unitLabel={lengthUnit}
                      placeholder={unitSystem === "imperial" ? "0.00" : "0.0"}
                      value={originalCompression.deckHeight}
                      onChange={(value) =>
                        setOriginalCompression((current) => ({
                          ...current,
                          deckHeight: value,
                        }))
                      }
                      inputMode="decimal"
                      error={fieldErrorsOriginal["compression.deck_height"]}
                    />
                    <InputField
                      label={t("pistonVolumeLabel")}
                      unitLabel={volumeUnit}
                      placeholder={unitSystem === "imperial" ? "-0.12" : "-2.0"}
                      value={originalCompression.pistonVolume}
                      onChange={(value) =>
                        setOriginalCompression((current) => ({
                          ...current,
                          pistonVolume: value,
                        }))
                      }
                      inputMode="decimal"
                      error={fieldErrorsOriginal["compression.piston_volume"]}
                    />
                  </>
                ) : null}
                <div className="ptp-divider ptp-grid-divider">
                  <span>{t("compressionTwoStrokeSectionTitle")}</span>
                </div>
                <InputField
                  label={t("exhaustPortHeightLabel")}
                  unitLabel={lengthUnit}
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
                  unitLabel={lengthUnit}
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
                  unitLabel={volumeUnit}
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
                onChange={handleOriginalCompressionToggle}
              />
              {originalCompressionEnabled ? (
                <CompressionModeToggleButton
                  value={originalCompressionMode}
                  onChange={setOriginalCompressionMode}
                />
              ) : null}
            </div>
            <div className="ptp-actions__right">
              <Button type="button" onClick={handleOriginalSubmit} disabled={loadingOriginal}>
                {loadingOriginal ? t("loading") : t("calculate")}
              </Button>
              <Button type="button" variant="secondary" onClick={handleClear}>
                {t("clear")}
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
          {comparisonDeclaredItems.length > 0 ? (
            <ResultPanel title={t("comparisonDeclaredTitle")} items={comparisonDeclaredItems} />
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
              unitLabel={lengthUnit}
              placeholder={unitSystem === "imperial" ? "2.52" : "64.0"}
              value={newBore}
              onChange={setNewBore}
              inputMode="decimal"
              error={fieldErrorsNew.bore}
            />
            <InputField
              label={t("strokeLabel")}
              unitLabel={lengthUnit}
              placeholder={unitSystem === "imperial" ? "2.13" : "54.0"}
              value={newStroke}
              onChange={setNewStroke}
              inputMode="decimal"
              error={fieldErrorsNew.stroke}
            />
            <InputField
              label={t("cylindersLabel")}
              placeholder={"4"}
              value={newCylinders}
              onChange={setNewCylinders}
              inputMode="numeric"
              error={fieldErrorsNew.cylinders}
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
                  unitLabel={volumeUnit}
                  placeholder={unitSystem === "imperial" ? "2.40" : "39.3"}
                  value={newCompression.chamberVolume}
                  onChange={(value) =>
                    setNewCompression((current) => ({ ...current, chamberVolume: value }))
                  }
                  inputMode="decimal"
                  error={fieldErrorsNew["compression.chamber_volume"]}
                />
                {newCompressionMode === "advanced" ? (
                  <>
                    <InputField
                      label={t("gasketThicknessLabel")}
                      unitLabel={lengthUnit}
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
                      unitLabel={lengthUnit}
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
                      unitLabel={lengthUnit}
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
                      unitLabel={volumeUnit}
                      placeholder={unitSystem === "imperial" ? "-0.12" : "-2.0"}
                      value={newCompression.pistonVolume}
                      onChange={(value) =>
                        setNewCompression((current) => ({ ...current, pistonVolume: value }))
                      }
                      inputMode="decimal"
                      error={fieldErrorsNew["compression.piston_volume"]}
                    />
                  </>
                ) : null}
                <div className="ptp-divider ptp-grid-divider">
                  <span>{t("compressionTwoStrokeSectionTitle")}</span>
                </div>
                <InputField
                  label={t("exhaustPortHeightLabel")}
                  unitLabel={lengthUnit}
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
                  unitLabel={lengthUnit}
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
                  unitLabel={volumeUnit}
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
                onChange={handleNewCompressionToggle}
              />
              {newCompressionEnabled ? (
                <CompressionModeToggleButton
                  value={newCompressionMode}
                  onChange={setNewCompressionMode}
                />
              ) : null}
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
