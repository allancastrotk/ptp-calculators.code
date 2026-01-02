import Head from "next/head";
import React from "react";

import { useI18n } from "../lib/i18n";
import { UnitSystemSwitch, UnitSystem } from "./UnitSystemSwitch";

export function Layout({
  title,
  subtitle,
  unitSystem,
  onUnitChange,
  children,
}: {
  title: string;
  subtitle?: string;
  unitSystem?: UnitSystem;
  onUnitChange?: (next: UnitSystem) => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <main className="ptp-shell">
        <div className="ptp-container">
          <header className="ptp-header">
            <div>
              <div className="ptp-title">{title}</div>
              <div className="ptp-subtitle">{subtitle || t("appTitle")}</div>
            </div>
            {unitSystem && onUnitChange ? (
              <UnitSystemSwitch value={unitSystem} onChange={onUnitChange} />
            ) : null}
          </header>
          <section className="ptp-content">{children}</section>
          <footer className="ptp-footer">{t("footer")}</footer>
        </div>
      </main>
    </>
  );
}