# Roadmap

Planned phases and milestones for implementing the calculators and platform features.

Status
- Fase 1 (Documentacao): concluida
  - Calculators docs: displacement, rl, calculator-3 (sprocket), calculator-4 (tires)
  - API contract v1
  - i18n strategy
  - embed model
- Fase 2 (Core gratuito + BFF): concluida
- Fase 3 (UI funcional): concluida (sem alinhamento visual final)
- Free Calculators - Migration Closed
- Correcao das calculadoras gratuitas (paridade + UX): concluida
- Proximos passos: Ferramenta paga (modelos 2T/4T avancados) e alinhamento visual final do site.

Smoke test (manual) - Displacement (Browser -> Vercel -> Render)
- Endpoint publico (BFF): POST /api/v1/calc/displacement
- Confirmar que o browser nao acessa Render diretamente.
- Exemplos de payload:

Metric:
{
  "unit_system": "metric",
  "language": "pt_BR",
  "inputs": { "bore": 58.0, "stroke": 50.0, "cylinders": 4 }
}

Imperial:
{
  "unit_system": "imperial",
  "language": "en_US",
  "inputs": { "bore": 2.283, "stroke": 1.969, "cylinders": 4 }
}

Estrutura esperada de resposta (sem valores exatos):
{
  "calculator": "displacement",
  "unit_system": "metric|imperial",
  "normalized_inputs": {
    "bore_mm": 0,
    "stroke_mm": 0,
    "cylinders": 0,
    "baseline_cc": null,
    "compression": null
  },
  "results": {
    "displacement_cc": 0,
    "displacement_l": 0,
    "displacement_ci": 0,
    "geometry": "square|oversquare|undersquare",
    "diff_percent": null,
    "compression": null
  },
  "warnings": [],
  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }
}

Smoke test (manual) - RL (Browser -> Vercel only)
- Endpoint publico (BFF): POST /api/v1/calc/rl
- Confirmar que o browser nao acessa Render diretamente.
- Exemplos de payload:

Minimo:
{
  "unit_system": "metric",
  "language": "pt_BR",
  "inputs": { "bore": 58.0, "stroke": 50.0, "rod_length": 100.0 }
}

Variando unit_system (RL ignora unidades):
{
  "unit_system": "imperial",
  "language": "en_US",
  "inputs": { "bore": 2.283, "stroke": 1.969, "rod_length": 3.937 }
}

Estrutura esperada de resposta (sem valores exatos):
{
  "calculator": "rl",
  "unit_system": "metric|imperial",
  "normalized_inputs": {
    "bore_mm": 0,
    "stroke_mm": 0,
    "rod_length_mm": 0,
    "baseline": null,
    "compression": null
  },
  "results": {
    "rl_ratio": 0,
    "rod_stroke_ratio": 0,
    "displacement_cc": 0,
    "geometry": "square|oversquare|undersquare",
    "smoothness": "rough|normal|smooth",
    "diff_rl_percent": null,
    "diff_displacement_percent": null,
    "compression": null
  },
  "warnings": [],
  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }
}

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
  "results": {
    "ratio": 0,
    "chain_length_mm": null,
    "chain_length_in": null,
    "center_distance_mm": null,
    "center_distance_in": null,
    "diff_ratio_percent": null,
    "diff_ratio_absolute": null,
    "diff_chain_length_percent": null,
    "diff_chain_length_absolute": null,
    "diff_center_distance_percent": null,
    "diff_center_distance_absolute": null
  },
  "warnings": [],
  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }
}

Smoke test (manual) - Tires (Browser -> Vercel only)
- Endpoint publico (BFF): POST /api/v1/calc/tires
- Confirmar que o browser nao acessa Render diretamente.
- Exemplo de payload:
{
  "unit_system": "metric",
  "language": "pt_BR",
  "inputs": { "vehicle_type": "Car", "rim_in": 17, "width_mm": 190, "aspect_percent": 55 }
}

Estrutura esperada de resposta (sem valores exatos):
{
  "calculator": "tires",
  "unit_system": "metric|imperial",
  "normalized_inputs": {
    "vehicle_type": "Car",
    "rim_in": 0,
    "width_mm": 0,
    "aspect_percent": 0,
    "flotation": null,
    "rim_width_in": null,
    "baseline": null
  },
  "results": {
    "diameter": 0,
    "width": 0,
    "diff_diameter": null,
    "diff_diameter_percent": null,
    "diff_width": null,
    "diff_width_percent": null
  },
  "warnings": [],
  "meta": { "version": "v1", "timestamp": "...", "source": "legacy-compatible" }
}
