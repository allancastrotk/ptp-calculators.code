import React from "react";

export function ResultGrid({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="ptp-results-grid">
      {items.map((item) => (
        <div key={item.label} className="ptp-result">
          <div className="ptp-result__label">{item.label}</div>
          <div className="ptp-result__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}