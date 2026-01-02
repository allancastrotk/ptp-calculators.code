import React from "react";

export function HeaderBar({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="ptp-header">
      <div className="ptp-header__text">
        <h1 className="ptp-title">{title}</h1>
        {subtitle ? <div className="ptp-subtitle">{subtitle}</div> : null}
      </div>
      {rightSlot ? <div className="ptp-header__slot">{rightSlot}</div> : null}
    </header>
  );
}