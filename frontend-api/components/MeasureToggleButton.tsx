import React from "react";

export function MeasureToggleButton({
  value,
  onChange,
  label,
  metricLabel,
  flotationLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  metricLabel: string;
  flotationLabel: string;
}) {
  const isFlotation = value;

  return (
    <button
      type="button"
      className={["ptp-unit-toggle", isFlotation ? "is-imperial" : "is-metric"].join(" ")}
      onClick={() => onChange(!isFlotation)}
      aria-pressed={isFlotation}
    >
      <span className="ptp-unit-toggle__label">{label}</span>
      <span>{isFlotation ? flotationLabel : metricLabel}</span>
    </button>
  );
}
