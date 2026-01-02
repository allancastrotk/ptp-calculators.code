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

type SprocketResponse = {
  results: {
    ratio: number;
    diff_ratio_percent?: number | null;
    diff_ratio_absolute?: number | null;
  };
};

export default function SprocketPage() {
  const { t } = useI18n();
  const [frontTeeth, setFrontTeeth] = useState("");
  const [rearTeeth, setRearTeeth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SprocketResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!frontTeeth) nextErrors.sprocket_teeth = t("required");
    if (!rearTeeth) nextErrors.crown_teeth = t("required");
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
          sprocket_teeth: Number(frontTeeth),
          crown_teeth: Number(rearTeeth),
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
    const items = [{ label: t("sprocketRatioLabel"), value: result.results.ratio.toFixed(2) }];
    if (result.results.diff_ratio_percent !== undefined && result.results.diff_ratio_percent !== null) {
      items.push({
        label: t("sprocketDiffPercentLabel"),
        value: `${result.results.diff_ratio_percent.toFixed(2)}%`,
      });
    }
    if (result.results.diff_ratio_absolute !== undefined && result.results.diff_ratio_absolute !== null) {
      items.push({
        label: t("sprocketDiffLabel"),
        value: result.results.diff_ratio_absolute.toFixed(2),
      });
    }
    return items;
  }, [result, t]);

  return (
    <Layout title={t("sprocket")} subtitle={t("unitLocked")} variant="pilot">
      <div className="ptp-stack">
        {error ? <ErrorBanner message={error} /> : null}
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">{t("sprocket")}</div>
          </div>
          <div className="grid">
            <InputField
              label={t("sprocketLabel")}
              placeholder="15"
              value={frontTeeth}
              onChange={setFrontTeeth}
              inputMode="numeric"
              error={fieldErrors.sprocket_teeth}
            />
            <InputField
              label={t("crownLabel")}
              placeholder="42"
              value={rearTeeth}
              onChange={setRearTeeth}
              inputMode="numeric"
              error={fieldErrors.crown_teeth}
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
