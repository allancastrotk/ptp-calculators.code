import Head from "next/head";
import React from "react";

import { useI18n } from "../lib/i18n";
import { HeaderBar } from "./HeaderBar";
import { UnitToggleButton } from "./UnitToggleButton";
import { UnitSystem } from "./UnitSystemSwitch";

type LayoutVariant = "pilot" | "default";

export function Layout({
  title,
  subtitle,
  unitSystem,
  onUnitChange,
  children,
  hideHeader = false,
  hideFooter = false,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  unitSystem?: UnitSystem;
  onUnitChange?: (next: UnitSystem) => void;
  children: React.ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
  variant?: LayoutVariant;
}) {
  const { t } = useI18n();
  const variantClass = variant === "pilot" ? "ptp-variant-pilot" : "";

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <main className={["ptp-shell", variantClass].filter(Boolean).join(" ")}>
        <div className="ptp-container">
          {hideHeader ? null : (
            <HeaderBar
              title={title}
              subtitle={subtitle || t("appTitle")}
              rightSlot={
                unitSystem && onUnitChange ? (
                  <UnitToggleButton value={unitSystem} onChange={onUnitChange} />
                ) : null
              }
            />
          )}
          <section className="ptp-content">{children}</section>
          {hideFooter ? null : <footer className="ptp-footer">{t("footer")}</footer>}
        </div>
      </main>
    </>
  );
}