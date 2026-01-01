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
      <main>
        <div className="container">
          <header className="header">
            <div className="title">{title}</div>
            <div className="subtitle">{subtitle || t("appTitle")}</div>
            {unitSystem && onUnitChange ? (
              <UnitSystemSwitch value={unitSystem} onChange={onUnitChange} />
            ) : null}
          </header>
          <section className="card">{children}</section>
          <footer className="footer">{t("footer")}</footer>
        </div>
      </main>
    </>
  );
}