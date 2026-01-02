import React from "react";

import { useI18n } from "../lib/i18n";

export type UnitSystem = "metric" | "imperial";

export function UnitToggleButton({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (next: UnitSystem) => void;
}) {
  const { t } = useI18n();
  const isMetric = value === "metric";
  const nextValue: UnitSystem = isMetric ? "imperial" : "metric";

  return (
    <button
      type="button"
      className={["ptp-unit-toggle", isMetric ? "is-metric" : "is-imperial"].join(" ")}
      onClick={() => onChange(nextValue)}
      aria-pressed={!isMetric}
    >
      <span className="ptp-unit-toggle__label">{t("unitLabel")}</span>
      <span>{isMetric ? t("unitMetric") : t("unitImperial")}</span>
    </button>
  );
}
