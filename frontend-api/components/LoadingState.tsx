import React from "react";

import { useI18n } from "../lib/i18n";

export function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="subtitle">{t("loading")}</div>
    </div>
  );
}