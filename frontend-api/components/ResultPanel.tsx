import React from "react";

export function ResultPanel({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div className="grid">
        {items.map((item) => (
          <div key={item.label}>
            <div className="subtitle">{item.label}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}