import React from "react";

import { Card } from "./Card";
import { ResultGrid } from "./ResultGrid";

export function ResultPanel({
  title,
  items,
}: {
  title: string;
  items: { label: React.ReactNode; value: React.ReactNode }[];
}) {
  return (
    <Card className="ptp-stack">
      <div className="ptp-card__title">{title}</div>
      <ResultGrid items={items} />
    </Card>
  );
}
