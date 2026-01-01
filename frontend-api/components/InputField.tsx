import React from "react";

export function InputField({
  label,
  unitLabel,
  placeholder,
  value,
  onChange,
  error,
  type = "number",
}: {
  label: string;
  unitLabel?: string;
  placeholder?: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>
        {label} {unitLabel ? <span className="subtitle">({unitLabel})</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          fontSize: 14,
        }}
      />
      {error ? <span style={{ color: "var(--error)", fontSize: 12 }}>{error}</span> : null}
    </label>
  );
}