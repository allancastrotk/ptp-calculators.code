# RL Calculator

Documentacao funcional e matematica baseada exclusivamente no legado HTML/JS em `legado/_rodstroke.zip`.

## 1) Objetivo da calculadora
Calcula a relacao R/L do conjunto biela-virabrequim a partir de diametro (bore), curso (stroke) e comprimento de biela (rod length). E destinada a entusiastas avancados, tecnicos e profissionais automotivos para comparar conjuntos "original" vs "new", avaliar suavidade (rough/normal/smooth) e classificar geometria (quadrado, superquadrado, subquadrado).

## 2) Entradas (inputs)

Tabela de parametros e restricoes observadas no legado:

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Bore (diametro) | `input type="number"` | mm (ou in) | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder `58.0` |
| Stroke (curso) | `input type="number"` | mm (ou in) | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder `50.0` |
| Rod length (comprimento da biela) | `input type="number"` | mm (ou in) | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder `100.0` |

Taxa de compressao (extensao v1, opcional):

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Compression mode | `compression.mode` | adimensional | `simple` ou `advanced` | `simple` usa apenas `chamber_volume`; `advanced` usa junta/deck/pistao |
| Chamber volume | `compression.chamber_volume` | cc (ou cu in) | > 0 | Volume da camara |
| Gasket thickness | `compression.gasket_thickness` | mm (ou in) | > 0 | Espessura da junta |
| Gasket bore | `compression.gasket_bore` | mm (ou in) | > 0 | Diametro do furo da junta |
| Deck height | `compression.deck_height` | mm (ou in) | pode ser 0 | Altura do deck |
| Piston volume | `compression.piston_volume` | cc (ou cu in) | pode ser negativo | Dome (negativo) ou dish (positivo) |
| Exhaust port height | `compression.exhaust_port_height` | mm (ou in) | opcional | Se informado junto/sozinho, ativa modo 2T |
| Transfer port height | `compression.transfer_port_height` | mm (ou in) | opcional | Se informado junto/sozinho, ativa modo 2T |
| Crankcase volume | `compression.crankcase_volume` | cc (ou cu in) | opcional | Usado para taxa do carter (2T) |

Detalhes de modo (modelo atual):
- O fluxo original/new e feito via dois widgets separados (Original e New).
- O widget New recebe o baseline via `postMessage` do host (bridge por `pageId`).
- A API v1 aceita `inputs.baseline` para calcular variacoes; nao ha `localStorage` no modelo novo.

Idioma e UI:
- Idioma pode ser definido por `?lang=pt_BR|en_US|es_ES` ou por `postMessage` com `{ language }`.
- O idioma altera rotulos e mensagens, nao altera calculos.

## 3) Saidas (outputs)

Tabela de resultados exibidos:

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Deslocamento | `cc` ou `cu in` | `toFixed(2)` | Calculado sem numero de cilindros |
| RL (engineering) | adimensional | `toFixed(2)` | Exibido como `RL: {valor} (smoothness)` |
| Rod/Stroke (US) | adimensional | `toFixed(2)` | Deve ser exibido em conjunto com RL |
| Geometria | texto | nome localizavel | Quadrado, Superquadrado, Subquadrado |
| Suavidade | texto | nome localizavel | Rough, Normal, Smooth |
| Variacao RL | `%` | `toFixed(2)` | Apenas no modo "new" |
| Variacao Deslocamento | `%` | `toFixed(2)` | Apenas no modo "new" |

Taxa de compressao (extensao v1, opcional):

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Compression ratio | adimensional | `toFixed(2)` | Baseada em volume varrido e volume de folga |
| Clearance volume | cc (ou cu in) | `toFixed(2)` | Volume de folga total |
| Swept volume | cc (ou cu in) | `toFixed(2)` | Volume varrido total |
| Trapped volume | cc (ou cu in) | `toFixed(2)` | Apenas quando modo 2T |
| Crankcase compression | adimensional | `toFixed(2)` | Apenas quando modo 2T e `crankcase_volume` informado |

Detalhes adicionais:
- As linhas de variacao usam classes visuais `increase`, `decrease`, `no-change`.
- Sem baseline, o widget New mostra um aviso leve para calcular o Original.

## 4) Formulas matematicas

Relacoes canonicas (adimensionais):
- R/L (engineering): `R/L = (stroke / 2) / rod_length`
- Rod/Stroke (US): `rod_length / stroke`
- Ambas representam a mesma geometria com convencoes diferentes; ambas devem ser exibidas nos resultados.

Deslocamento (cc):
- `displacement = (pi * bore^2 / 4) * stroke / 1000`
- `bore` e `stroke` em mm; divisao por 1000 converte de mm3 para cm3 (cc).
- Observacao: o legado nao multiplica por numero de cilindros.

Classificacao de geometria:
- Tolerancia: `0.03` (3%).
- Regra: se `abs(bore - stroke) / stroke <= 0.03` -> Quadrado.
- Caso contrario: se `bore > stroke` -> Superquadrado; senao -> Subquadrado.

Suavidade (smoothness):
- `rodRatio >= 0.30` -> rough
- `rodRatio >= 0.25` -> normal
- caso contrario -> smooth

Taxa de compressao (extensao v1):
- Volume varrido: `swept = (pi * bore^2 / 4) * stroke / 1000`
- Volume de folga: `clearance = chamber + gasket + deck + piston`
- Taxa (4T): `(swept + clearance) / clearance`
- Taxa (2T): usa `trapped_swept` com base no menor valor entre `exhaust_port_height` e `transfer_port_height`.

## 5) Regras de negocio

Comparacao original vs new:
- O backend calcula `diff_rl_percent` e `diff_displacement_percent` quando `baseline` e informado.
- O frontend exibe delta absoluto e percentual (em linha com a UI padrao das calculadoras).
- O baseline e transportado pelo host (bridge entre widgets).

Valores invalidos:
- Se qualquer campo estiver vazio, nao numerico, ou <= 0, a calculadora exibe a mensagem de erro e mostra o box de resultado.
- Comportamento implicito: valores de resultado anteriores nao sao limpos explicitamente quando ocorre erro.

Comportamento do ponto de vista do usuario:
- O usuario precisa clicar em "Calcular" para obter resultados.
- A comparacao do widget New depende do baseline enviado pelo widget Original (via host).


Implementacao atual (API v1):
- A resposta exposta inclui `rl_ratio`, `rod_stroke_ratio`, `displacement_cc`, `geometry` e `smoothness`.
- A comparacao original vs new e feita via `inputs.baseline`, retornando `diff_rl_percent` e `diff_displacement_percent`.
- Taxa de compressao e opcional; quando habilitada, retorna `compression` nos resultados.
- `compression.mode` controla o nivel de detalhe: `simple` considera apenas `chamber_volume` (ignora junta/deck/pistao), `advanced` considera todos os campos.
- Se `compression.mode` nao for informado, o backend assume `advanced` quando houver campos avancados preenchidos; caso contrario, assume `simple`.
## 6) Sistema de unidades

- As relacoes R/L e Rod/Stroke sao adimensionais e independem do sistema de unidades.
- O legado usa mm para entrada, mas qualquer unidade consistente preserva o resultado.
- A exibicao de deslocamento usa `cc` no modo metrico e `cu in` no modo imperial.
- A API v1 aceita `unit_system=metric|imperial`; conversoes sao feitas no backend.
- A UI converte entradas/saidas quando o usuario alterna a unidade (sem alterar a fonte de verdade no backend).

## 7) Observacoes de legado e compatibilidade

Compatibilidade obrigatoria:
- No legado, o modo "original" armazena em `localStorage` com chave `rodstrokeCalcOriginal` e formato `{ rodRatio, displacement, geometry, smoothness }`.
- No modelo novo, o baseline e trafegado via `postMessage` entre widgets; nao ha persistencia no browser.
- Arredondamento com `toFixed(2)` para deslocamento, RL e variacoes percentuais.
- Tolerancia de 3% para classificacao de geometria.

Comportamentos implicitos:
- Se `stroke` for zero, o calculo de geometria teria divisao por zero, mas o legado bloqueia `stroke <= 0`, evitando isso.
- Os campos aceitam apenas valores positivos; zeros sao invalidados mesmo com `min=0`.
- A linha de variacao inclui simbolos/icones antes do percentual (comportamento visual implicito).

Pontos pendentes de confirmacao:
- Exibicao explicita de Rod/Stroke (US) nao aparece no legado; necessario confirmar como apresentar sem quebrar compatibilidade.
- Taxa de compressao nao existe no legado; extensao v1 necessita validacao futura.
