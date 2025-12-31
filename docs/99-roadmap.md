# RoadmapPlanned phases and milestones for implementing the calculators and platform features.Status- Fase 1 (Documentacao): concluida  - Calculators docs: displacement, rl, calculator-3 (sprocket), calculator-4 (tires)  - API contract v1  - i18n strategy  - embed model- Fase 2 iniciada: Displacement backend + BFF concluidos- Fase 2: RL calculator implemented (backend + BFF)- Proximo passo: Fase 2 (Implementacao): backend core + endpoints v1 + frontend integrationSmoke test (manual) - Displacement (Browser -> Vercel -> Render)- Endpoint publico (BFF): POST /api/v1/calc/displacement- Confirmar que o browser nao acessa Render diretamente.- Exemplos de payload:Metric:{  "unit_system": "metric",  "language": "pt_BR",  "inputs": { "bore": 58.0, "stroke": 50.0, "cylinders": 4 }}Imperial:{  "unit_system": "imperial",  "language": "en_US",  "inputs": { "bore": 2.283, "stroke": 1.969, "cylinders": 4 }}Estrutura esperada de resposta (sem valores exatos):{  "calculator": "displacement",  "unit_system": "metric|imperial",  "normalized_inputs": { "bore_mm": 0, "stroke_mm": 0, "cylinders": 0, "baseline_cc": null },  "results": { "displacement_cc": 0, "displacement_l": 0, "displacement_ci": 0, "geometry": "square|oversquare|undersquare" },  "warnings": [],  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }}TODO tecnico (proxima calculadora: RL)- Resultados devem incluir rl_ratio e rod_stroke_ratio.- Calculo e adimensional (unit_system nao altera).- Compatibilidade total com legado e arredondamentos.- Reutilizar core de validacao existente.Smoke test (manual) - RL (Browser -> Vercel only)- Endpoint publico (BFF): POST /api/v1/calc/rl- Confirmar que o browser nao acessa Render diretamente.- Exemplos de payload:Minimo:{  "unit_system": "metric",  "language": "pt_BR",  "inputs": { "stroke": 50.0, "rod_length": 100.0 }}Variando unit_system (RL ignora unidades):{  "unit_system": "imperial",  "language": "en_US",  "inputs": { "stroke": 1.969, "rod_length": 3.937 }}Estrutura esperada de resposta (sem valores exatos):{  "calculator": "rl",  "unit_system": "metric|imperial",  "normalized_inputs": { "stroke_mm": 0, "rod_length_mm": 0, "bore_mm": null },  "results": { "rl_ratio": 0, "rod_stroke_ratio": 0 },  "warnings": [],  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }}- Fase 2: Sprocket calculator implemented (backend + BFF)
Smoke test (manual) - Sprocket (Browser -> Vercel only)
- Endpoint publico (BFF): POST /api/v1/calc/sprocket
- Confirmar que o browser nao acessa Render diretamente.
- Exemplo de payload:
{
  "unit_system": "metric",
  "language": "pt_BR",
  "inputs": { "sprocket_teeth": 14, "crown_teeth": 38 }
}

Estrutura esperada de resposta (sem valores exatos):
{
  "calculator": "sprocket",
  "unit_system": "metric|imperial",
  "normalized_inputs": {
    "sprocket_teeth": 0,
    "crown_teeth": 0,
    "chain_pitch": null,
    "chain_links": null,
    "baseline": null
  },
  "results": {\n    "ratio": 0,\n    "chain_length_mm": null,\n    "chain_length_in": null,\n    "center_distance_mm": null,\n    "center_distance_in": null,\n    "diff_ratio_percent": null,\n    "diff_ratio_absolute": null,\n    "diff_chain_length_percent": null,\n    "diff_chain_length_absolute": null,\n    "diff_center_distance_percent": null,\n    "diff_center_distance_absolute": null\n  }\n,
  "warnings": [],
  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }
}
