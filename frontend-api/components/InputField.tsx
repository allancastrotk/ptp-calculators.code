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
    <label className="ptp-field">
      <span className="ptp-field__label">
        {label} {unitLabel ? <span className="ptp-field__unit">({unitLabel})</span> : null}
      </span>
      <input
        className="ptp-input"
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {helper ? <span className="ptp-field__helper">{helper}</span> : null}
      {error ? <span className="ptp-field__error">{error}</span> : null}
    </label>
  );
}