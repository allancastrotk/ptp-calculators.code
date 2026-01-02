import React, { useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { InputField } from "../components/InputField";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { ResultPanel } from "../components/ResultPanel";
import { postJson, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type TiresResponse = {
  results: {
    diameter: number;
    width: number;
    diff_diameter?: number | null;
    diff_diameter_percent?: number | null;
    diff_width?: number | null;
    diff_width_percent?: number | null;
  };
};

export default function TiresPage() {
  const { t } = useI18n();
  const [tireSize, setTireSize] = useState("");
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TiresResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!tireSize) nextErrors.tire_size = t("required");
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
          tire_size: tireSize,
          baseline_tire_size: baseline || undefined,
        },
      };

      const response = await postJson<TiresResponse>(
        "/api/v1/calc/tires",
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
    const items = [
      { label: "Diameter", value: result.results.diameter.toFixed(2) },
      { label: "Width", value: result.results.width.toFixed(2) },
    ];
    if (result.results.diff_diameter !== undefined && result.results.diff_diameter !== null) {
      items.push({
        label: "Diff diameter",
        value: result.results.diff_diameter.toFixed(2),
      });
    }
    if (
      result.results.diff_diameter_percent !== undefined &&
      result.results.diff_diameter_percent !== null
    ) {
      items.push({
        label: "Diff diameter (%)",
        value: `${result.results.diff_diameter_percent.toFixed(2)}%`,
      });
    }
    if (result.results.diff_width !== undefined && result.results.diff_width !== null) {
      items.push({
        label: "Diff width",
        value: result.results.diff_width.toFixed(2),
      });
    }
    if (result.results.diff_width_percent !== undefined && result.results.diff_width_percent !== null) {
      items.push({
        label: "Diff width (%)",
        value: `${result.results.diff_width_percent.toFixed(2)}%`,
      });
    }
    return items;
  }, [result]);

  return (
    <Layout title={t("tires")} subtitle={t("unitLocked")}>
      <div className="ptp-stack">
        {error ? <ErrorBanner message={error} /> : null}
        <Card className="ptp-stack">
          <div className="grid">
            <InputField
              label={t("tires")}
              placeholder="190/55-17"
              value={tireSize}
              onChange={setTireSize}
              type="text"
              error={fieldErrors.tire_size}
            />
            <InputField
              label={t("baselineLabel")}
              placeholder="180/55-17"
              value={baseline}
              onChange={setBaseline}
              type="text"
              error={fieldErrors.baseline_tire_size}
            />
          </div>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? t("loading") : t("calculate")}
          </Button>
          {loading ? <LoadingState /> : null}
        </Card>
        {result ? <ResultPanel title="Results" items={resultsList} /> : null}
      </div>
    </Layout>
  );
}