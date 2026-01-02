import Head from "next/head";
import React from "react";

import { useI18n } from "../lib/i18n";
import { HeaderBar } from "./HeaderBar";
import { UnitToggleButton } from "./UnitToggleButton";
import { UnitSystem } from "./UnitSystemSwitch";

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
          <HeaderBar
            title={title}
            subtitle={subtitle || t("appTitle")}
            rightSlot={
              unitSystem && onUnitChange ? (
                <UnitToggleButton value={unitSystem} onChange={onUnitChange} />
              ) : null
            }
          />
          <section className="ptp-content">{children}</section>
          <footer className="ptp-footer">{t("footer")}</footer>
        </div>
      </main>
    </>
  );
}