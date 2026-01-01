import React, { useState } from "react";

import { Layout } from "../components/Layout";
import { UnitSystem } from "../components/UnitSystemSwitch";
import { ResultPanel } from "../components/ResultPanel";
import { useI18n } from "../lib/i18n";

export default function RLPage() {
  const { t } = useI18n();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");

  return (
    <Layout title={t("rl")} unitSystem={unitSystem} onUnitChange={setUnitSystem}>
      <div className="grid">
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{t("placeholder")}</div>
          <div className="subtitle">/api/v1/calc/rl</div>
        </div>
        <ResultPanel
          title="Results"
          items={[
            { label: "R/L", value: "-" },
            { label: "Rod/Stroke", value: "-" },
          ]}
        />
      </div>
    </Layout>
  );
}