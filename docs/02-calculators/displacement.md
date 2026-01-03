# Displacement Calculator

Documentacao funcional e matematica baseada exclusivamente no legado HTML/JS em `zip/_displacement.zip`.

## 1) Objetivo da calculadora
Calcula a cilindrada total do motor a partir de diametro (bore), curso (stroke) e numero de cilindros. E destinada a entusiastas avancados, tecnicos e profissionais automotivos, e e usada para comparar configuracoes de motor (original vs new) e classificar a geometria do conjunto (quadrado, superquadrado, subquadrado).

## 2) Entradas (inputs)

Tabela de parametros e restricoes observadas no legado:

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Bore (diametro) | `input type="number"` | mm (ou in) | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder muda por modo |
| Stroke (curso) | `input type="number"` | mm (ou in) | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder muda por modo |
| Cylinders (numero de cilindros) | `select` | adimensional | opcoes fixas 1..6; valor vazio invalido | Opcao inicial "Selecione" |

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
- A API v1 aceita `inputs.baseline_cc` para comparar com o valor informado; nao ha `localStorage` no modelo novo.

Detalhes de placeholder:
- Original: bore `58.0`, stroke `50.0`.
- New: bore `64.0`, stroke `54.0`.

Idioma e UI:
- Idioma pode ser definido por `?lang=pt_BR|en_US|es_ES` ou por `postMessage` com `{ language }`.
- O idioma altera rotulos e mensagens, nao altera calculos.

## 3) Saidas (outputs)

Tabela de resultados exibidos:

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Displacement (cc) | `cc` | `toFixed(2)` | `displacement_cc` |
| Displacement (L) | `L` | `toFixed(2)` | `displacement_l` |
| Displacement (cu in) | `cu in` | `toFixed(2)` | `displacement_ci` (quando `unit_system=imperial`) |
| Geometria | texto | nome localizavel | Quadrado, Superquadrado, Subquadrado |
| Variacao percentual | `%` | `toFixed(2)` | Apenas quando baseline existe |

Taxa de compressao (extensao v1, opcional):

| Saida | Unidade | Formato | Observacoes |
| --- | --- | --- | --- |
| Compression ratio | adimensional | `toFixed(2)` | Baseada em volume varrido e volume de folga |
| Clearance volume | cc (ou cu in) | `toFixed(2)` | Volume de folga total |
| Swept volume | cc (ou cu in) | `toFixed(2)` | Volume varrido total |
| Trapped volume | cc (ou cu in) | `toFixed(2)` | Apenas quando modo 2T |
| Crankcase compression | adimensional | `toFixed(2)` | Apenas quando modo 2T e `crankcase_volume` informado |

Detalhes adicionais:
- Variacao percentual usa classes visuais `increase`, `decrease`, `no-change`.
- Sem baseline, o widget New mostra um aviso leve para calcular o Original.

## 4) Formulas matematicas

Cilindrada total (cm3):
- `displacement = (pi * bore^2 / 4) * stroke * cylinders / 1000`
- `bore` e `stroke` em mm; divisao por 1000 converte de mm3 para cm3.

Classificacao de geometria:
- Tolerancia: `0.03` (3%).
- Regra: se `abs(bore - stroke) / stroke <= 0.03` -> Quadrado.
- Caso contrario: se `bore > stroke` -> Superquadrado; senao -> Subquadrado.

Taxa de compressao (extensao v1):
- Volume varrido: `swept = (pi * bore^2 / 4) * stroke / 1000`
- Volume de folga: `clearance = chamber + gasket + deck + piston`
- Taxa (4T): `(swept + clearance) / clearance`
- Taxa (2T): usa `trapped_swept` com base no menor valor entre `exhaust_port_height` e `transfer_port_height`.

## 5) Regras de negocio

Comparacao original vs new:
- O backend calcula `diff_percent` quando `baseline_cc` e informado.
- O frontend exibe delta absoluto + percentual (padrao das calculadoras).
- O baseline entre widgets e transportado pelo host (bridge por `pageId`).

Valores invalidos:
- Se qualquer campo estiver vazio, nao numerico, ou <= 0, a calculadora exibe a mensagem de erro e mostra o box de resultado.
- Comportamento implicito: valores de resultado anteriores nao sao limpos explicitamente quando ocorre erro.

Comportamento do ponto de vista do usuario:
- O usuario precisa clicar em "Calcular" para obter resultados.
- A comparacao do widget New depende do baseline enviado pelo widget Original (via host).

Implementacao atual:
- A comparacao Original vs New e feita no frontend (estado local).
- Nao ha persistencia server-side no backend ou no BFF.

Taxa de compressao:
- Opcional; quando habilitada, e calculada no backend.
- O modo 4T e o default; o modo 2T e ativado quando houver alturas de janelas informadas.
- `compression.mode` controla o nivel de detalhe: `simple` considera apenas `chamber_volume` (ignora junta/deck/pistao), `advanced` considera todos os campos.
- Se `compression.mode` nao for informado, o backend assume `advanced` quando houver campos avancados preenchidos; caso contrario, assume `simple`.
## 6) Observacoes de legado

Compatibilidade obrigatoria:
- No legado, o modo "original" armazena em `localStorage` com chave `displacementCalcOriginal` e formato `{ displacement, geometry }`.
- No modelo novo, o baseline e trafegado via `postMessage` entre widgets; nao ha persistencia no browser.
- Prefixo literal `"? "` antes de "Cilindrada" na linha de variacao no modo "new".
- Tolerancia de 3% para classificacao de geometria.
- Arredondamento com `toFixed(2)` tanto para cilindrada quanto para variacao percentual.

Comportamentos implicitos:
- Se `stroke` for zero, o calculo de geometria teria divisao por zero, mas o legado bloqueia `stroke <= 0`, evitando isso.
- A opcao de cilindros e limitada a 1..6 e nao aceita valores fora desse conjunto.

Pontos pendentes de confirmacao:
- Se a unidade "cm3" deve permanecer como `cm3` na UI final ou se deve ser renderizada de outra forma.
- Taxa de compressao nao existe no legado; extensao v1 necessita validacao futura.
