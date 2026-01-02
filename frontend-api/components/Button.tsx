import React from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: Variant;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={["ptp-button", `ptp-button--${variant}`, className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}