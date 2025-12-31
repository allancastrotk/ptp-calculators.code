# RL Calculator

Documentacao funcional e matematica baseada exclusivamente no legado HTML/JS em `zip/_rodstroke.zip`.

## 1) Objetivo da calculadora
Calcula a relacao R/L do conjunto biela-virabrequim a partir de diametro (bore), curso (stroke) e comprimento de biela (rod length). E destinada a entusiastas avancados, tecnicos e profissionais automotivos para comparar conjuntos "original" vs "new", avaliar suavidade (rough/normal/smooth) e classificar geometria (quadrado, superquadrado, subquadrado).

## 2) Entradas (inputs)

Tabela de parametros e restricoes observadas no legado:

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Bore (diametro) | `input type="number"` | mm | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder `58.0` |
| Stroke (curso) | `input type="number"` | mm | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder `50.0` |
| Rod length (comprimento da biela) | `input type="number"` | mm | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder `100.0` |

Detalhes de modo:
- Modo "original": armazena resultados em `localStorage` com chave `rodstrokeCalcOriginal`.
- Modo "new": nao armazena resultados; usa o valor salvo do modo "original" para calcular variacoes percentuais.

Idioma e UI:
- Idioma pode ser definido por `?lang=pt_BR|en_US|es_ES` ou por `postMessage` com `{ language }`.
- O idioma altera rotulos e mensagens, nao altera calculos.

## 3) Saidas (outputs)

Tabela de resultados exibidos:

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Deslocamento | `cc` | `toFixed(2)` | Calculado sem numero de cilindros |
| RL (engineering) | adimensional | `toFixed(2)` | Exibido como `RL: {valor} (smoothness)` |
| Rod/Stroke (US) | adimensional | `toFixed(2)` | Pendente de confirmacao (nao exibido no legado) |
| Geometria | texto | nome localizavel | Quadrado, Superquadrado, Subquadrado |
| Variacao RL | `%` | `toFixed(2)` | Apenas no modo "new" |
| Variacao Deslocamento | `%` | `toFixed(2)` | Apenas no modo "new" |

Detalhes adicionais:
- As linhas de variacao usam classes visuais `increase`, `decrease`, `no-change`.
- Se nao houver valor "original", o modo "new" mostra a mensagem "Calcule o conjunto original primeiro!".

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

## 5) Regras de negocio

Comparacao original vs new:
- No modo "original", salva `{ rodRatio, displacement, geometry, smoothness }` no `localStorage`.
- No modo "new", se existir valor salvo, calcula:
  - `% diff RL = (new - original) / original * 100`
  - `% diff displacement = (new - original) / original * 100`
- Se nao existir valor salvo, exibe mensagem de erro e nao calcula comparacoes.

Valores invalidos:
- Se qualquer campo estiver vazio, nao numerico, ou <= 0, a calculadora exibe a mensagem de erro e mostra o box de resultado.
- Comportamento implicito: valores de resultado anteriores nao sao limpos explicitamente quando ocorre erro.

Comportamento do ponto de vista do usuario:
- O usuario precisa clicar em "Calcular" para obter resultados.
- A comparacao do modo "new" depende de ter executado a versao "original" antes (mesmo browser/localStorage).

## 6) Sistema de unidades

- As relacoes R/L e Rod/Stroke sao adimensionais e independem do sistema de unidades.
- O legado usa mm para entrada, mas qualquer unidade consistente preserva o resultado.
- A exibicao de deslocamento usa `cc` e presume entrada em mm.

## 7) Observacoes de legado e compatibilidade

Compatibilidade obrigatoria:
- Chave de armazenamento `rodstrokeCalcOriginal` e formato `{ rodRatio, displacement, geometry, smoothness }`.
- Arredondamento com `toFixed(2)` para deslocamento, RL e variacoes percentuais.
- Tolerancia de 3% para classificacao de geometria.
- Mensagem "Calcule o conjunto original primeiro!" quando o modo "new" nao encontra dados salvos.

Comportamentos implicitos:
- Se `stroke` for zero, o calculo de geometria teria divisao por zero, mas o legado bloqueia `stroke <= 0`, evitando isso.
- Os campos aceitam apenas valores positivos; zeros sao invalidados mesmo com `min=0`.
- A linha de variacao inclui simbolos/icones antes do percentual (comportamento visual implicito).

Pontos pendentes de confirmacao:
- Exibicao explicita de Rod/Stroke (US) nao aparece no legado; necessario confirmar como apresentar sem quebrar compatibilidade.
