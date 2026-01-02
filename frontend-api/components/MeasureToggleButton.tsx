import React from "react";

export function MeasureToggleButton({
  value,
  onChange,
  metricLabel,
  flotationLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
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
      <span>{isFlotation ? flotationLabel : metricLabel}</span>
    </button>
  );
}
