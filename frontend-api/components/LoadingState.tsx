import React from "react";

import { Alert } from "./Alert";
import { useI18n } from "../lib/i18n";

export function LoadingState() {
  const { t } = useI18n();
  return <Alert message={t("loading")} tone="info" />;
}