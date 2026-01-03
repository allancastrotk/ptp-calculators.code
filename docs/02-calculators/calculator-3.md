# Calculator 3 (Sprocket Ratio)

Documentacao funcional e matematica baseada exclusivamente no legado HTML/JS em `zip/_sprocket.zip`.
Calculator-3 refere-se a calculadora de relacao coroa/pinhao (Sprocket Ratio).

## 1) Objetivo da calculadora
Calcula a relacao coroa-pinhao (ratio) e, quando informado passo de corrente e numero de elos, calcula comprimento de corrente e distancia entre eixos. E destinada a entusiastas avancados, tecnicos e profissionais para comparar conjuntos "original" vs "new" e suas variacoes.

## 2) Entradas (inputs)

Tabela de parametros e restricoes observadas no legado:

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Pinhao (sprocket) | `input type="number"` | dentes | `min=1`, `step=1`, inteiro positivo obrigatorio | Erro se nao inteiro |
| Coroa (crown) | `input type="number"` | dentes | `min=1`, `step=1`, inteiro positivo obrigatorio | Erro se nao inteiro |
| Passo da corrente | `select` | codigo (415, 420, 428, 520, 525, 530, 630) | opcional; deve estar na lista | Se invalido -> erro |
| Numero de elos | `input type="number"` | elos | opcional; inteiro positivo e par | Se impar -> erro |

Detalhes de modo (modelo atual):
- O fluxo original/new e feito via dois widgets separados (Original e New).
- O widget New recebe o baseline via `postMessage` do host (bridge por `pageId`).
- A API v1 aceita `inputs.baseline` para calcular variacoes; nao ha `localStorage` no modelo novo.

Idioma e UI:
- Idioma pode ser definido por `?lang=pt_BR|en_US|es_ES` ou por `postMessage` com `{ language }`.
- O idioma altera rotulos, mensagens e unidade exibida, nao altera calculos.

## 3) Saidas (outputs)

Tabela de resultados exibidos:

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Relacao (ratio) | adimensional | `toFixed(2)` | `crown / sprocket` |
| Comprimento da corrente | `mm` ou `in` | `toFixed(2)` | `-` se inputs opcionais ausentes |
| Distancia entre eixos | `mm` ou `in` | `toFixed(2)` | `-` se inputs opcionais ausentes |
| Variacao de relacao | `%` e absoluto | `toFixed(2)` | Apenas no modo "new" |
| Variacao de comprimento | `%` e absoluto | `toFixed(2)` | Apenas no modo "new" |
| Variacao de distancia | `%` e absoluto | `toFixed(2)` | Apenas no modo "new" |

Detalhes adicionais:
- Linhas de variacao usam classes visuais `increase`, `decrease`, `no-change`.
- Se nao houver valor "original", o modo "new" mostra erro e nao calcula variacoes.

## 4) Formulas matematicas

Relacao coroa-pinhao:
- `ratio = crown / sprocket`

Passo da corrente (mapeamento legado):
- 415, 420, 428 -> `12.7 mm`
- 520, 525, 530 -> `15.875 mm`
- 630 -> `19.05 mm`

Comprimento da corrente:
- `chainLengthMM = chainLinks * chainPitchMM`

Distancia entre eixos (iterativa):
- `Z1 = sprocket`, `Z2 = crown`, `p = chainPitchMM`, `L = chainLinks`
- Estimativa inicial: `C = (chainLengthMM - (pi * (Z1 + Z2) * p / 2)) / 2`
- Iteracao (ate 1000 passos ou erro < 0.01):
  - `Lcalc = 2 * (C / p) + (Z1 + Z2) / 2 + (Z2 - Z1)^2 / (4 * pi^2 * (C / p))`
  - `C += (L - Lcalc) * p * wearFactor / 2`
- `wearFactor = 1.0` no modo "original"; `0.98` no modo "new"
- Resultado final: `centerDistanceMM = clamp(C, 620, 680)`

Conversoes de unidade (exibicao):
- Se idioma `en_US`: `mm -> in` usando `/ 25.4`
- Caso contrario: `mm -> cm` usando `/ 10`

## 5) Regras de negocio

Validacao:
- Pinhao e coroa devem ser inteiros positivos; caso contrario mostra `error_invalid_input`.
- Passo da corrente deve estar na lista; caso contrario mostra `error_invalid_chain_pitch`.
- Numero de elos, se informado, deve ser inteiro positivo e par; caso contrario mostra `error_invalid_input` + `error_invalid_chain_links`.

Calculo condicional:
- Relacao sempre calculada quando pinhao e coroa sao validos.
- Comprimento da corrente e distancia entre eixos so sao calculados se passo e elos forem informados e validos; caso contrario exibem `-`.

Comparacao original vs new:
- A API v1 aceita `inputs.baseline` e retorna diffs absolutos e percentuais.
- O frontend exibe os deltas no formato padrao (valor + percentual).
- Variacoes de comprimento e distancia so aparecem se ambos os valores (novo e original) existirem e `chainLinks > 0`.

Implementacao atual (API v1):
- A comparacao e feita via `inputs.baseline` (objeto com os campos do conjunto original).
- O backend retorna `diff_ratio_percent`/`diff_ratio_absolute`, `diff_chain_length_percent`/`diff_chain_length_absolute` e `diff_center_distance_percent`/`diff_center_distance_absolute`.
- Os demais resultados seguem `ratio`, `chain_length_mm`/`chain_length_in` e `center_distance_mm`/`center_distance_in`.
## 6) Sistema de unidades

- A relacao e adimensional.
- O legado calcula tudo em mm e converte para exibicao.
- No modelo novo, a UI permite alternar `unit_system` (metric/imperial) para exibir mm ou in.
- A unidade exibida nao altera os calculos.

## 7) Observacoes de legado

Compatibilidade obrigatoria:
- Chave de armazenamento `sprocketCalcOriginal` e formato `{ ratio, chainLengthMM, centerDistanceMM }`.
- Arredondamento com `toFixed(2)` em todas as saidas numericas.
- Clamping de `centerDistanceMM` para o intervalo `[620, 680]`.
- Iteracao para resolver `C` com tolerancia de `0.01` e ate 1000 iteracoes.

Comportamentos implicitos:
- Se passo ou elos nao forem informados, o legado exibe `-` para comprimento e distancia.
- As variacoes exibem um icone antes do percentual (comportamento visual implicito).
- O modo "new" aplica `wearFactor = 0.98`, reduzindo a distancia calculada na iteracao.

Pontos pendentes de confirmacao:
- Se o clamping `[620, 680]` representa mm reais ou um limite empirico especifico do legado.
