import React, { useId, useState } from "react";

export function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="ptp-hint"
      data-open={open ? "true" : "false"}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="ptp-hint__icon"
        aria-describedby={id}
        aria-label={text}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      <span id={id} className="ptp-hint__bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
