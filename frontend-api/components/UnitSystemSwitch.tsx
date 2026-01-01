import React from "react";

import { useI18n } from "../lib/i18n";

export type UnitSystem = "metric" | "imperial";

export function UnitSystemSwitch({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (next: UnitSystem) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span className="subtitle">Unit</span>
      <button
        className="button"
        type="button"
        onClick={() => onChange("metric")}
        disabled={value === "metric"}
      >
        {t("unitMetric")}
      </button>
      <button
        className="button"
        type="button"
        onClick={() => onChange("imperial")}
        disabled={value === "imperial"}
      >
        {t("unitImperial")}
      </button>
    </div>
  );
}