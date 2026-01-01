import React, { useMemo, useRef, useState } from "react";

import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ResultPanel } from "../components/ResultPanel";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type SprocketResponse = {
  results: {
    ratio: number;
    diff_ratio_percent?: number | null;
    diff_ratio_absolute?: number | null;
    chain_length_mm?: number | null;
    chain_length_in?: number | null;
    center_distance_mm?: number | null;
    center_distance_in?: number | null;
  };
};

export default function SprocketPage() {
  const { t } = useI18n();
  const [sprocketTeeth, setSprocketTeeth] = useState("");
  const [crownTeeth, setCrownTeeth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SprocketResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!sprocketTeeth) nextErrors.sprocket_teeth = t("required");
    if (!crownTeeth) nextErrors.crown_teeth = t("required");
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
          sprocket_teeth: Number(sprocketTeeth),
          crown_teeth: Number(crownTeeth),
        },
      };

      const response = await postJson<SprocketResponse>(
        "/api/v1/calc/sprocket",
        payload,
        controller.signal
      );
      setResult(response);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
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

  const resultsList = useMemo(() => {
    if (!result) return [];
    const items = [{ label: "Ratio", value: result.results.ratio.toFixed(2) }];
    if (result.results.diff_ratio_percent != null) {
      items.push({ label: "Diff (%)", value: `${result.results.diff_ratio_percent.toFixed(2)}%` });
    }
    if (result.results.diff_ratio_absolute != null) {
      items.push({ label: "Diff", value: result.results.diff_ratio_absolute.toFixed(2) });
    }
    return items;
  }, [result]);

  return (
    <Layout title={t("sprocket")} subtitle={t("unitLocked")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <div className="grid">
          <InputField
            label={t("sprocketLabel")}
            placeholder="14"
            value={sprocketTeeth}
            onChange={setSprocketTeeth}
            error={fieldErrors.sprocket_teeth}
          />
          <InputField
            label={t("crownLabel")}
            placeholder="38"
            value={crownTeeth}
            onChange={setCrownTeeth}
            error={fieldErrors.crown_teeth}
          />
        </div>
        <button className="button" type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? t("loading") : t("calculate")}
        </button>
        {loading ? <LoadingState /> : null}
        {result ? <ResultPanel title="Results" items={resultsList} /> : null}
      </div>
    </Layout>
  );
}