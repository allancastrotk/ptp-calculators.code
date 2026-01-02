import React from "react";

import { Card } from "./Card";
import { ResultGrid } from "./ResultGrid";

export function ResultPanel({
  title,
  items,
  sections,
}: {
  title: string;
  items?: { label: React.ReactNode; value: React.ReactNode }[];
  sections?: { title?: string; items: { label: React.ReactNode; value: React.ReactNode }[] }[];
}) {
  const resolvedSections =
    sections?.filter((section) => section.items && section.items.length > 0) ?? [];

  return (
    <Card className="ptp-stack">
      <div className="ptp-card__title">{title}</div>
      {resolvedSections.length > 0 ? (
        resolvedSections.map((section, index) => (
          <div key={section.title || index} className="ptp-stack">
            {index > 0 ? (
              <div className="ptp-divider">
                {section.title ? <span>{section.title}</span> : null}
              </div>
            ) : null}
            <ResultGrid items={section.items} />
          </div>
        ))
      ) : (
        <ResultGrid items={items || []} />
      )}
    </Card>
  );
}
