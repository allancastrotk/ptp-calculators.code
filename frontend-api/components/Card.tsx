import React from "react";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={['ptp-card', className].filter(Boolean).join(' ')}>{children}</div>;
}