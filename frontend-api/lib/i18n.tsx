import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "pt_BR" | "en_US" | "es_ES";

const allowedOrigins = new Set([
  "https://powertunepro.com",
  "https://www.powertunepro.com",
]);

const dictionaries: Record<Language, Record<string, string>> = {
  en_US: {
    appTitle: "PowerTunePro Calculators",
    unitMetric: "Metric",
    unitImperial: "Imperial",
    loading: "Calculating...",
    errorTitle: "Something went wrong",
    footer: "PowerTunePro",
    displacement: "Displacement",
    rl: "R/L Ratio",
    sprocket: "Sprocket Ratio",
    tires: "Tire and Rim",
    placeholder: "UI will be wired next",
    calculate: "Calculate",
    boreLabel: "Bore",
    strokeLabel: "Stroke",
    cylindersLabel: "Cylinders",
    baselineLabel: "Baseline cc (optional)",
  },
  pt_BR: {
    appTitle: "PowerTunePro Calculators",
    unitMetric: "Metrico",
    unitImperial: "Imperial",
    loading: "Calculando...",
    errorTitle: "Algo deu errado",
    footer: "PowerTunePro",
    displacement: "Cilindrada",
    rl: "Relacao R/L",
    sprocket: "Relacao Coroa-Pinhao",
    tires: "Aro e Pneu",
    placeholder: "UI sera conectada em breve",
    calculate: "Calcular",
    boreLabel: "Diametro",
    strokeLabel: "Curso",
    cylindersLabel: "Cilindros",
    baselineLabel: "Base cc (opcional)",
  },
  es_ES: {
    appTitle: "PowerTunePro Calculators",
    unitMetric: "Metrico",
    unitImperial: "Imperial",
    loading: "Calculando...",
    errorTitle: "Algo salio mal",
    footer: "PowerTunePro",
    displacement: "Cilindrada",
    rl: "Relacion R/L",
    sprocket: "Relacion Corona-Pinon",
    tires: "Llanta y Neumatico",
    placeholder: "La UI se conectara pronto",
    calculate: "Calcular",
    boreLabel: "Diametro",
    strokeLabel: "Carrera",
    cylindersLabel: "Cilindros",
    baselineLabel: "Base cc (opcional)",
  },
};

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
} | null>(null);

function resolveLanguage(value?: string | null): Language {
  if (value === "pt_BR" || value === "en_US" || value === "es_ES") {
    return value;
  }
  return "en_US";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en_US");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial = resolveLanguage(params.get("lang"));
    setLanguage(initial);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const next = resolveLanguage((event.data as { language?: string })?.language);
      if (next !== language) {
        setLanguage(next);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [language]);

  const value = useMemo(() => {
    const dict = dictionaries[language];
    return {
      language,
      setLanguage,
      t: (key: string) => dict[key] || key,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}