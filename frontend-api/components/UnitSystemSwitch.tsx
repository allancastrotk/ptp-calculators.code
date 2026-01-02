import React from "react";

import { useI18n } from "../lib/i18n";
import { Button } from "./Button";
import { Card } from "./Card";

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
    <Card className="ptp-switch">
      <span className="ptp-switch__label">Unit</span>
      <div className="ptp-switch__actions">
        <Button
          type="button"
          variant={value === "metric" ? "primary" : "secondary"}
          onClick={() => onChange("metric")}
          disabled={value === "metric"}
        >
          {t("unitMetric")}
        </Button>
        <Button
          type="button"
          variant={value === "imperial" ? "primary" : "secondary"}
          onClick={() => onChange("imperial")}
          disabled={value === "imperial"}
        >
          {t("unitImperial")}
        </Button>
      </div>
    </Card>
  );
}