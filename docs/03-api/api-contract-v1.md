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
- `baseline_cc` (opcional): numero (cc) para comparacao original vs new
- `compression` (opcional): objeto com dados de taxa

Regras e unidades:
- Suporta entrada em mm ou inches quando `unit_system=imperial` ou `auto`.
- `normalized_inputs` sempre em mm.
- Calculo deve replicar o legado (mesma formula, tolerancia e arredondamento).

Resultados recomendados:
- `displacement_cc` (cm3)
- `displacement_l`
- `displacement_ci` (cubic inches) quando `unit_system=imperial` ou solicitado
- `geometry` (square/oversquare/undersquare)
- `diff_percent` (se `baseline_cc` for informado)
- `compression` (opcional):
  - `compression_ratio`
  - `clearance_volume`
  - `swept_volume`
  - `trapped_volume` (quando 2T)
  - `crankcase_compression_ratio` (quando 2T e `crankcase_volume`)
  - `compression_mode`: `four_stroke` ou `two_stroke`

Campos de `compression` (inputs):
- `mode` (opcional): `simple` ou `advanced`. Se ausente, backend assume `advanced` quando houver campos avancados preenchidos; caso contrario, assume `simple`.
- `chamber_volume` (cc ou cu in)
- `gasket_thickness` (mm ou in)
- `gasket_bore` (mm ou in)
- `deck_height` (mm ou in)
- `piston_volume` (cc ou cu in)
- `exhaust_port_height` (mm ou in, opcional para 2T)
- `transfer_port_height` (mm ou in, opcional para 2T)
- `crankcase_volume` (cc ou cu in, opcional para 2T)

### rl

Request `inputs`:
- `bore`: numero (mm ou in)
- `stroke`: numero (mm ou in)
- `rod_length`: numero (mm ou in)
- `baseline` (opcional): objeto com os mesmos campos para comparacao original vs new
- `compression` (opcional): objeto com dados de taxa

Regras e unidades:
- `rl_ratio` e `rod_stroke_ratio` sao adimensionais.
- `unit_system` nao altera o calculo, apenas a normalizacao e labels.

Resultados obrigatorios:
- `rl_ratio` (engineering): `(stroke / 2) / rod_length`
- `rod_stroke_ratio` (US): `rod_length / stroke`
- `displacement_cc`
- `geometry` (square/oversquare/undersquare)
- `smoothness` (rough/normal/smooth)
- `diff_rl_percent` (quando `baseline` for informado)
- `diff_displacement_percent` (quando `baseline` for informado)
- `compression` (opcional):
  - `compression_ratio`
  - `clearance_volume`
  - `swept_volume`
  - `trapped_volume` (quando 2T)
  - `crankcase_compression_ratio` (quando 2T e `crankcase_volume`)
  - `compression_mode`: `four_stroke` ou `two_stroke`

Campos de `compression` (inputs):
- `mode` (opcional): `simple` ou `advanced`. Se ausente, backend assume `advanced` quando houver campos avancados preenchidos; caso contrario, assume `simple`.
- `chamber_volume` (cc ou cu in)
- `gasket_thickness` (mm ou in)
- `gasket_bore` (mm ou in)
- `deck_height` (mm ou in)
- `piston_volume` (cc ou cu in)
- `exhaust_port_height` (mm ou in, opcional para 2T)
- `transfer_port_height` (mm ou in, opcional para 2T)
- `crankcase_volume` (cc ou cu in, opcional para 2T)

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
- `diff_ratio_percent` e `diff_ratio_absolute` (quando `baseline` for informado)
- `diff_chain_length_percent` e `diff_chain_length_absolute` (quando `baseline` for informado)
- `diff_center_distance_percent` e `diff_center_distance_absolute` (quando `baseline` for informado)

### tires

Request `inputs`:
- `vehicle_type`: `Car | Motorcycle | LightTruck | TruckCommercial | Kart | Kartcross`
- `rim_in`: numero (polegadas)
- `width_mm`: numero (mm) ou `flotation` quando aplicavel
- `aspect_percent`: numero (%) quando aplicavel
- `flotation` (opcional):
  - `NNxWWRZZ` ou `NNxWW-ZZ` quando `vehicle_type=LightTruck|Kart|Kartcross`
  - `NN.NN-ZZ` quando `vehicle_type=Motorcycle`
- `rim_width_in` (opcional): numero (polegadas)
- `baseline` (opcional): objeto com os mesmos campos para comparacao original vs new

Regras e unidades:
- Aceita medidas metricas e flotacao (quando aplicavel), mantendo o legado.
- `normalized_inputs` deve incluir equivalente metrico de todas as entradas.
- `unit_system=imperial` permite retornar inches; `metric` retorna mm.
- Para Motorcycle em flotation, assume aspect ratio implicito de 100% (diametro = rim + 2 * width).

Resultados recomendados:
- `diameter` (mm ou in, conforme `unit_system`)
- `width` (mm ou in, conforme `unit_system`)
- `diff_diameter` e `diff_diameter_percent` (quando `baseline` for informado)
- `diff_width` e `diff_width_percent` (quando `baseline` for informado)

## Compatibilidade com legado

- O objetivo e manter resultados matematicos identicos ao legado.
- Tolerancias e arredondamentos devem ser preservados.
- Mudancas de comportamento devem gerar nova versao (v2).

## Access Control and Trust Boundaries

Normativo:
- A API do Render e PRIVATE e INTERNAL-ONLY.
- O Render deve aceitar requisicoes apenas do Vercel (server-to-server).
- Render NAO deve ser chamado diretamente por browsers.
- CORS nao e considerado mecanismo de seguranca suficiente.
- Autenticacao entre Vercel e Render deve usar header secreto (X-PTP-Internal-Key) e pode aceitar Authorization: Bearer <key> como fallback; assinatura HMAC com timestamp e opcional.
- O BFF permite apenas origens allowlisted (site, Vercel UI, localhost de desenvolvimento).
- Qualquer uso externo da API do Render e considerado fora de escopo e nao suportado.
