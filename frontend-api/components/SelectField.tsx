import React from "react";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function SelectField({
  label,
  unitLabel,
  value,
  onChange,
  options,
  placeholder,
  error,
  helper,
}: {
  label: string;
  unitLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
  helper?: string;
}) {
  return (
    <label className="ptp-field">
      <span className="ptp-field__label">
        {label} {unitLabel ? <span className="ptp-field__unit">({unitLabel})</span> : null}
      </span>
      <select
        className="ptp-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {helper ? <span className="ptp-field__helper">{helper}</span> : null}
      {error ? <span className="ptp-field__error">{error}</span> : null}
    </label>
  );
}
