import React from "react";

type Tone = "error" | "warning" | "info";

export function Alert({
  message,
  tone = "info",
  className,
}: {
  message: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={["ptp-alert", `ptp-alert--${tone}`, className].filter(Boolean).join(" ")}>
      {message}
    </div>
  );
}