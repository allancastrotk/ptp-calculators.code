import type { AppProps } from "next/app";
import React, { useEffect } from "react";

import { LanguageProvider, useI18n } from "../lib/i18n";
import { useEmbedBridge } from "../lib/embed";
import "../styles/globals.css";

function EmbedBridge() {
  const { setLanguage } = useI18n();
  useEmbedBridge(setLanguage);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isEmbed = typeof window !== "undefined" && window.top !== window;
    document.body.classList.toggle("ptp-embed", isEmbed);
  }, []);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <EmbedBridge />
      <Component {...pageProps} />
    </LanguageProvider>
  );
}