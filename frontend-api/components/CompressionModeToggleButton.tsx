import React from "react";

import { useI18n } from "../lib/i18n";

export type CompressionMode = "simple" | "advanced";

export function CompressionModeToggleButton({
  value,
  onChange,
}: {
  value: CompressionMode;
  onChange: (next: CompressionMode) => void;
}) {
  const { t } = useI18n();
  const isAdvanced = value === "advanced";

  return (
    <button
      type="button"
      className={["ptp-unit-toggle", isAdvanced ? "is-imperial" : "is-metric"].join(" ")}
      onClick={() => onChange(isAdvanced ? "simple" : "advanced")}
      aria-pressed={isAdvanced}
    >
      <span className="ptp-unit-toggle__label">{t("compressionModeLabel")}</span>
      <span>{isAdvanced ? t("compressionModeAdvanced") : t("compressionModeSimple")}</span>
    </button>
  );
}
