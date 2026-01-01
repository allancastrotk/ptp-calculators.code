import { useEffect, useRef } from "react";

import { Language } from "./i18n";

const allowedOrigins = new Set([
  "https://powertunepro.com",
  "https://www.powertunepro.com",
]);

type LangMessage = { language?: string };

type ResizeMessage = { type: "ptp:resize"; height: number };

type LangAckMessage = { type: "ptp:lang:ack"; language: Language };

function resolveLanguage(value?: string): Language | null {
  if (value === "pt_BR" || value === "en_US" || value === "es_ES") {
    return value;
  }
  return null;
}

function getParentOrigin(): string | null {
  if (typeof document === "undefined") return null;
  if (!document.referrer) return null;
  try {
    const origin = new URL(document.referrer).origin;
    return allowedOrigins.has(origin) ? origin : null;
  } catch {
    return null;
  }
}

function postToHost(message: ResizeMessage | LangAckMessage) {
  if (typeof window === "undefined") return;
  const origin = getParentOrigin();
  if (!origin) return;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, origin);
  }
}

export function useEmbedBridge(setLanguage: (lang: Language) => void) {
  const lastHeight = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const data = event.data as LangMessage;
      const next = resolveLanguage(data?.language);
      if (next) {
        setLanguage(next);
        postToHost({ type: "ptp:lang:ack", language: next });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const emit = () => {
      const height = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0
      );
      if (!height || height === lastHeight.current) return;
      lastHeight.current = height;
      postToHost({ type: "ptp:resize", height });
    };

    emit();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(() => emit());
      if (document.body) observer.observe(document.body);
      return () => observer.disconnect();
    }

    const interval = globalThis.setInterval(emit, 500);
    return () => globalThis.clearInterval(interval);
  }, []);
}