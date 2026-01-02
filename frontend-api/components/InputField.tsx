import React from "react";

type InputMode = React.HTMLAttributes<HTMLInputElement>["inputMode"];

export function InputField({
  label,
  unitLabel,
  placeholder,
  value,
  onChange,
  error,
  helper,
  type = "number",
  inputMode,
}: {
  label: string;
  unitLabel?: string;
  placeholder?: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  type?: string;
  inputMode?: InputMode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>
        {label} {unitLabel ? <span className="subtitle">({unitLabel})</span> : null}
      </span>
      <input
        type={type}
        inputMode={inputMode}
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
      {helper ? <span className="subtitle">{helper}</span> : null}
      {error ? <span style={{ color: "var(--error)", fontSize: 12 }}>{error}</span> : null}
    </label>
  );
}