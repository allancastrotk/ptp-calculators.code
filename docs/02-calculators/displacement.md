# Displacement Calculator

Documentacao funcional e matematica baseada exclusivamente no legado HTML/JS em `zip/_displacement.zip`.

## 1) Objetivo da calculadora
Calcula a cilindrada total do motor a partir de diametro (bore), curso (stroke) e numero de cilindros. E destinada a entusiastas avancados, tecnicos e profissionais automotivos, e e usada para comparar configuracoes de motor (original vs new) e classificar a geometria do conjunto (quadrado, superquadrado, subquadrado).

## 2) Entradas (inputs)

Tabela de parametros e restricoes observadas no legado:

| Parametro | Campo | Unidade | Restricoes | Observacoes |
| --- | --- | --- | --- | --- |
| Bore (diametro) | `input type="number"` | mm | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder muda por modo |
| Stroke (curso) | `input type="number"` | mm | `min=0`, `step=0.1`, validacao exige valor finito e > 0 | Placeholder muda por modo |
| Cylinders (numero de cilindros) | `select` | adimensional | opcoes fixas 1..6; valor vazio invalido | Opcao inicial "Selecione" |

Detalhes de modo:
- Modo "original": armazena resultados em `localStorage` com chave `displacementCalcOriginal`.
- Modo "new": nao armazena resultados; usa o valor salvo do modo "original" para calcular variacao percentual.

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
| Cilindrada | `cm3` | `toFixed(2)` | Renderizado como `cm3` |
| Geometria | texto | nome localizavel | Quadrado, Superquadrado, Subquadrado |
| Variacao percentual | `%` | `toFixed(2)` | Apenas no modo "new" |

Detalhes adicionais:
- Variacao percentual usa classes visuais `increase`, `decrease`, `no-change`.
- Se nao houver valor "original", o modo "new" mostra mensagem de comparacao.

## 4) Formulas matematicas

Cilindrada total (cm3):
- `displacement = (pi * bore^2 / 4) * stroke * cylinders / 1000`
- `bore` e `stroke` em mm; divisao por 1000 converte de mm3 para cm3.

Classificacao de geometria:
- Tolerancia: `0.03` (3%).
- Regra: se `abs(bore - stroke) / stroke <= 0.03` -> Quadrado.
- Caso contrario: se `bore > stroke` -> Superquadrado; senao -> Subquadrado.

## 5) Regras de negocio

Comparacao original vs new:
- No modo "original", salva `{ displacement, geometry }` no `localStorage`.
- No modo "new", se existir valor salvo, calcula `% diff = (new - original) / original * 100` e exibe com 2 casas decimais.
- Se nao existir valor salvo, exibe a mensagem "Calcule primeiro a versao Original para comparar.".

Valores invalidos:
- Se qualquer campo estiver vazio, nao numerico, ou <= 0, a calculadora exibe a mensagem de erro e mostra o box de resultado.
- Comportamento implicito: valores de resultado anteriores nao sao limpos explicitamente quando ocorre erro.

Comportamento do ponto de vista do usuario:
- O usuario precisa clicar em "Calcular" para obter resultados.
- A comparacao do modo "new" depende de ter executado a versao "original" antes (mesmo browser/localStorage).

## 6) Observacoes de legado

Compatibilidade obrigatoria:
- Chave de armazenamento `displacementCalcOriginal` e formato `{ displacement, geometry }`.
- Prefixo literal `"? "` antes de "Cilindrada" na linha de variacao no modo "new".
- Tolerancia de 3% para classificacao de geometria.
- Arredondamento com `toFixed(2)` tanto para cilindrada quanto para variacao percentual.

Comportamentos implicitos:
- Se `stroke` for zero, o calculo de geometria teria divisao por zero, mas o legado bloqueia `stroke <= 0`, evitando isso.
- A opcao de cilindros e limitada a 1..6 e nao aceita valores fora desse conjunto.

Pontos pendentes de confirmacao:
- Se a unidade "cm3" deve permanecer como `cm3` na UI final ou se deve ser renderizada de outra forma.
