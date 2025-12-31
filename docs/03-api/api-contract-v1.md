# API Contract v1

Contrato canonico da API v1 para as quatro calculadoras, focado em estabilidade, compatibilidade com legado e suporte a unidades.

## Versionamento e rotas

Base: `/v1/calc/<calculator_slug>`

Slugs canonicos:
- `displacement`
- `rl`
- `sprocket`
- `tires`

## Estrutura padrao de request

Todos os requests devem seguir esta estrutura:

```json
{
  "unit_system": "metric | imperial | auto",
  "language": "pt_BR | en_US | es_ES",
  "inputs": {}
}
```

Regras gerais:
- `unit_system="auto"` significa: backend normaliza para metrico, mas permite entrada imperial quando aplicavel.
- `language` e opcional e usada apenas para labels e mensagens; nao altera calculos.
- `inputs` contem os campos especificos de cada calculadora.

## Estrutura padrao de response

Todos os responses de sucesso devem seguir esta estrutura:

```json
{
  "calculator": "<slug>",
  "unit_system": "metric | imperial",
  "normalized_inputs": {},
  "results": {},
  "warnings": [],
  "meta": {
    "version": "v1",
    "timestamp": "ISO-8601",
    "source": "legacy-compatible"
  }
}
```

Regras gerais:
- `unit_system` no response deve ser resolvido para `metric` ou `imperial`.
- `normalized_inputs` deve estar sempre em metrico quando aplicavel.
- `results` pode incluir metricos e/ou imperiais quando fizer sentido para o cliente.
- `warnings` e opcional e deve ser uma lista previsivel (ex.: campos normalizados, arredondamentos).

## Erros e validacoes

Padrao de erro 400:

```json
{
  "error_code": "string",
  "message": "string",
  "field_errors": [
    { "field": "inputs.<campo>", "reason": "string" }
  ]
}
```

Regras:
- Mensagens devem ser consistentes e previsiveis.
- `field_errors` deve listar todos os campos invalidos quando possivel.

## Contratos por calculadora

### displacement

Request `inputs`:
- `bore`: numero (mm ou in)
- `stroke`: numero (mm ou in)
- `cylinders`: inteiro positivo
- `baseline` (opcional): objeto com os mesmos campos para comparacao original vs new

Regras e unidades:
- Suporta entrada em mm ou inches quando `unit_system=imperial` ou `auto`.
- `normalized_inputs` sempre em mm.
- Calculo deve replicar o legado (mesma formula, tolerancia e arredondamento).

Resultados recomendados:
- `displacement_cc` (cm3)
- `displacement_liters`
- `displacement_cuin` (cubic inches) quando `unit_system=imperial` ou solicitado
- `geometry` (square/oversquare/undersquare)
- `diff_percent` (se `baseline` for informado)

### rl

Request `inputs`:
- `bore`: numero (mm ou in)
- `stroke`: numero (mm ou in)
- `rod_length`: numero (mm ou in)
- `baseline` (opcional): objeto com os mesmos campos para comparacao original vs new

Regras e unidades:
- `rl_ratio` e `rod_stroke_ratio` sao adimensionais.
- `unit_system` nao altera o calculo, apenas a normalizacao e labels.

Resultados obrigatorios:
- `rl_ratio` (engineering): `(stroke / 2) / rod_length`
- `rod_stroke_ratio` (US): `rod_length / stroke`
- `smoothness` (rough/normal/smooth)
- `geometry` (square/oversquare/undersquare)
- `displacement_cc` (compatibilidade legado)
- `diff_percent` (se `baseline` for informado) para RL e displacement

### sprocket

Request `inputs`:
- `sprocket_teeth`: inteiro positivo
- `crown_teeth`: inteiro positivo
- `chain_pitch` (opcional): string entre `415|420|428|520|525|530|630`
- `chain_links` (opcional): inteiro positivo par
- `baseline` (opcional): objeto com os mesmos campos para comparacao original vs new

Regras e unidades:
- `ratio` e adimensional.
- Comprimento de corrente e distancia entre eixos so existem quando `chain_pitch` e `chain_links` sao informados e validos.
- Se `unit_system=imperial`, a exibicao pode ser em inches; normalizacao sempre em mm.

Resultados recomendados:
- `ratio`
- `chain_length_mm` e `chain_length_in` (quando aplicavel)
- `center_distance_mm` e `center_distance_in` (quando aplicavel)
- `diff_percent` e `diff_absolute` (quando `baseline` for informado)

### tires

Request `inputs`:
- `vehicle_type`: `Car | Motorcycle | Utility`
- `rim_in`: numero (polegadas)
- `width_mm`: numero (mm) ou `flotation` quando aplicavel
- `aspect_percent`: numero (%) quando aplicavel
- `flotation` (opcional): string `NNxWWRZZ` quando `vehicle_type=Utility`
- `rim_width_in` (opcional): numero (polegadas)
- `baseline` (opcional): objeto com os mesmos campos para comparacao original vs new

Regras e unidades:
- Aceita medidas metricas e flotacao (quando aplicavel), mantendo o legado.
- `normalized_inputs` deve incluir equivalente metrico de todas as entradas.
- `unit_system=imperial` permite retornar inches; `metric` retorna mm.

Resultados recomendados:
- `diameter_mm` e `diameter_in`
- `width_mm` e `width_in` (largura do conjunto)
- `circumference_mm` e `circumference_in` (quando aplicavel)
- `diff_percent` e `diff_absolute` (quando `baseline` for informado)

## Compatibilidade com legado

- O objetivo e manter resultados matematicos identicos ao legado.
- Tolerancias e arredondamentos devem ser preservados.
- Mudancas de comportamento devem gerar nova versao (v2).
