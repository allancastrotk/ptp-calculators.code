import React from "react";

import { useI18n } from "../lib/i18n";

export function CompressionToggleButton({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useI18n();
  const isOn = value;

  return (
    <button
      type="button"
      className={["ptp-unit-toggle", isOn ? "is-imperial" : "is-metric"].join(" ")}
      onClick={() => onChange(!isOn)}
      aria-pressed={isOn}
    >
      <span className="ptp-unit-toggle__label">{t("compressionLabel")}</span>
      <span>{isOn ? t("compressionOn") : t("compressionOff")}</span>
    </button>
  );
}
