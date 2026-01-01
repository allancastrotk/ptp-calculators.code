import React, { createContext, useContext, useMemo, useState } from "react";

export type Language = "pt_BR" | "en_US" | "es_ES";

export type I18nContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const dictionaries: Record<Language, Record<string, string>> = {
  en_US: {
    appTitle: "PowerTunePro Calculators",
    unitMetric: "Metric",
    unitImperial: "Imperial",
    unitLocked: "Unit system not applicable",
    unitOutputImperial: "Outputs in inches",
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
    rodLengthLabel: "Rod length",
    sprocketLabel: "Front teeth",
    crownLabel: "Rear teeth",
    vehicleTypeLabel: "Vehicle type",
    rimLabel: "Rim",
    widthLabel: "Width",
    aspectLabel: "Aspect",
    rimWidthLabel: "Rim width (optional)",
    flotationLabel: "Flotation size (optional)",
    required: "Required",
  },
  pt_BR: {
    appTitle: "PowerTunePro Calculators",
    unitMetric: "Metrico",
    unitImperial: "Imperial",
    unitLocked: "Sistema nao aplicavel",
    unitOutputImperial: "Saida em polegadas",
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
    rodLengthLabel: "Comprimento da biela",
    sprocketLabel: "Dentes dianteiro",
    crownLabel: "Dentes traseiro",
    vehicleTypeLabel: "Tipo de veiculo",
    rimLabel: "Aro",
    widthLabel: "Largura",
    aspectLabel: "Perfil",
    rimWidthLabel: "Tala do aro (opcional)",
    flotationLabel: "Medida flotation (opcional)",
    required: "Obrigatorio",
  },
  es_ES: {
    appTitle: "PowerTunePro Calculators",
    unitMetric: "Metrico",
    unitImperial: "Imperial",
    unitLocked: "Sistema no aplicable",
    unitOutputImperial: "Salida en pulgadas",
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
    rodLengthLabel: "Longitud de biela",
    sprocketLabel: "Dientes delantero",
    crownLabel: "Dientes trasero",
    vehicleTypeLabel: "Tipo de vehiculo",
    rimLabel: "Llanta",
    widthLabel: "Ancho",
    aspectLabel: "Perfil",
    rimWidthLabel: "Ancho de llanta (opcional)",
    flotationLabel: "Medida flotation (opcional)",
    required: "Requerido",
  },
};

const LanguageContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en_US");

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[language];
    return {
      language,
      setLanguage,
      t: (key: string) => dict[key] || key,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}