import React from "react";

export function ResultGrid({
  items,
}: {
  items: { label: React.ReactNode; value: React.ReactNode }[];
}) {
  return (
    <div className="ptp-results-grid">
      {items.map((item, index) => (
        <div key={index} className="ptp-result">
          <div className="ptp-result__label">{item.label}</div>
          <div className="ptp-result__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
