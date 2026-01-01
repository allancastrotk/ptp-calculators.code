import type { AppProps } from "next/app";
import React from "react";

import { LanguageProvider, useI18n } from "../lib/i18n";
import { useEmbedBridge } from "../lib/embed";
import "../styles/globals.css";

function EmbedBridge() {
  const { setLanguage } = useI18n();
  useEmbedBridge(setLanguage);
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