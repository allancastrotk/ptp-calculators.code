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

type RLResponse = {
  results: {
    rl_ratio: number;
    rod_stroke_ratio: number;
  };
};

export default function RLPage() {
  const { t } = useI18n();
  const [stroke, setStroke] = useState("");
  const [rodLength, setRodLength] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RLResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
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
          stroke: Number(stroke),
          rod_length: Number(rodLength),
        },
      };

      const response = await postJson<RLResponse>(
        "/api/v1/calc/rl",
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
    return [
      { label: t("rlRatioLabel"), value: result.results.rl_ratio.toFixed(2) },
      { label: t("rodStrokeLabel"), value: result.results.rod_stroke_ratio.toFixed(2) },
    ];
  }, [result, t]);

  return (
    <Layout title={t("rl")} subtitle={t("unitLocked")} variant="pilot">
      <div className="ptp-stack">
        {error ? <ErrorBanner message={error} /> : null}
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("rl")}</div>
          </div>
          <div className="grid">
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
          <div className="ptp-actions">
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? t("loading") : t("calculate")}
            </Button>
          </div>
          {loading ? <LoadingState /> : null}
        </Card>
        {result ? <ResultPanel title={t("resultsTitle")} items={resultsList} /> : null}
      </div>
    </Layout>
  );
}
