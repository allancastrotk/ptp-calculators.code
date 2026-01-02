# Calculator 4 (Tire and Rim Comparator)

Documentacao funcional e matematica baseada exclusivamente no legado HTML/JS em `zip/_tires.zip`.

## 1) Objetivo da calculadora
Compara conjuntos aro-pneu (original vs new) e retorna diametro total e largura do conjunto. Destina-se a entusiastas avancados, tecnicos e profissionais para avaliar compatibilidade de medidas.

## 2) Entradas (inputs)

Tabela de parametros e restricoes observadas no legado:

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Tipo de veiculo | `select` | enum | obrigatorio | Opcoes: Car, Motorcycle, Utility (populadas do banco) |
| Aro (rim) | `select` | pol (in) | obrigatorio | Opcoes dependem do veiculo |
| Largura (width) | `select` | mm | obrigatorio (padrao) | Opcoes dependem de veiculo e aro |
| Perfil (aspect) | `select` | % | obrigatorio (padrao) | Opcoes dependem de veiculo, aro e largura |
| Flotation | `checkbox` + `select` | polegadas | opcional | Disponivel apenas para Utility; UI oculta por padrao |
| Tala do aro (rim width) | `input type="number"` | pol (in) | opcional | `step=0.5`, `min=0` |

Dependencias de selecao (legado):
- Selecao de veiculo habilita opcoes de aro.
- Selecao de aro habilita opcoes de largura.
- Selecao de largura habilita opcoes de perfil.
- Para Utility com flotation ativo, a largura/perfil sao ocultados e o select de flotation e populado a partir do banco.

Modo:
- Modo "original": armazena resultados em `localStorage` com chave `tireCalcOriginal`.
- Modo "new": nao armazena resultados; usa o valor salvo do modo "original" para calcular variacoes.

Idioma e UI:
- Idioma pode ser definido por `?lang=pt_BR|en_US|es_ES` ou por `postMessage` com `{ language }`.
- O idioma altera rotulos e unidade exibida, nao altera calculos.

## 3) Saidas (outputs)

Tabela de resultados exibidos:

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Diametro | `mm` ou `in` | `toFixed(2)` | Baseado em rim/width/aspect ou flotation |
| Largura do conjunto | `mm` ou `in` | `toFixed(2)` | Usa max(width, rimWidth) quando rimWidth informado |
| Variacao de diametro | `mm` ou `in` + `%` | `toFixed(2)` | Apenas no modo "new" |
| Variacao de largura | `mm` ou `in` + `%` | `toFixed(2)` | Apenas no modo "new" |

Detalhes adicionais:
- Linhas de variacao usam classes visuais `increase`, `decrease`, `no-change`.
- Se nao houver valor "original", o modo "new" mostra mensagem de erro e nao calcula variacoes.

## 4) Formulas matematicas

Calculo padrao (sem flotation):
- `diameterMM = rimIn * 25.4 + 2 * widthMM * (aspect / 100)`
- `widthMM = width`
- `rimWidthMM = rimWidthIn * 25.4` (se informado)
- `assemblyWidthMM = max(widthMM, rimWidthMM)` quando rimWidth informado; caso contrario `widthMM`

Calculo com flotation (Utility):
- Parse de string `NNxWWRZZ` (ex.: `31x10.5R15`):
  - `overallIn = NN`
  - `widthIn = WW`
  - `rimIn = ZZ` (nao usado no calculo)
- `diameterMM = overallIn * 25.4`
- `widthMM = widthIn * 25.4`

Conversao de unidade para exibicao:
- Se idioma `en_US`: `mm -> in` usando `/ 25.4`
- Caso contrario: `mm` direto (sem conversao)

## 5) Regras de negocio

Validacao:
- Veiculo, aro e (quando flotation nao esta ativo) largura e perfil sao obrigatorios.
- Se algum campo obrigatorio nao for selecionado, exibe `error_fill_all`.
- Se flotation ativo e a medida for invalida, exibe `error`.

Banco de dados:
- Se `TIRES_DB` nao carregar, exibe `errorDatabase` e mostra o box de resultados.
- A API v1 valida veiculo/aro/largura/perfil e flotation contra a mesma base do legado (sem banco externo).

Comparacao original vs new:
- No modo "original", salva `{ diameterMM, assemblyWidthMM }` no `localStorage`.
- No modo "new", se existir valor salvo, calcula:
  - `diffDiameterMM = new - original`
  - `diffWidthMM = new - original`
  - Percentuais: `diff / original * 100`, com `toFixed(2)`.
- Se nao existir valor salvo, exibe `errorOriginalFirst` e nao calcula variacoes.


Implementacao atual (API v1):
- A resposta exposta inclui `diameter` e `width` (sem sufixo de unidade), alem de `diff_diameter`, `diff_diameter_percent`, `diff_width` e `diff_width_percent` quando `baseline` e informado.
- As unidades de `diameter`/`width` seguem o `unit_system` resolvido (metric -> mm, imperial -> in).
- Nao ha circunferencia na resposta v1.
## 6) Sistema de unidades

- Entradas sao mistas: aro e tala em polegadas; largura em mm; perfil em %.
- Calculos internos usam mm.
- Saidas: `pt_BR` e `es_ES` mostram `mm`; `en_US` mostra `in`.
- As relacoes sao independentes de unidades quando conversao e aplicada corretamente.

## 7) Observacoes de legado

Compatibilidade obrigatoria:
- Chave `tireCalcOriginal` e formato `{ diameterMM, assemblyWidthMM }`.
- Arredondamento com `toFixed(2)` em todas as saidas numericas.
- Bases de selecao de medidas devem respeitar o banco `TIRES_DB`.

Comportamentos implicitos:
- O checkbox de flotation esta oculto no HTML (`display: none`), mas o JS suporta o fluxo completo.
- O parse de flotation ignora o valor do aro informado na string (usa apenas diameter e width).
- Se rimWidth nao for informado, a largura do conjunto e igual a largura do pneu.

Pontos pendentes de confirmacao:
- Se a opcao de flotation deve permanecer escondida na UI ou ser exposta futuramente.
