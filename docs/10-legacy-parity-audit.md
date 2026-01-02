# Legacy Parity Audit (RL, Sprocket, Tires)

Auditoria formal de paridade entre o legado (ZIP) e o modelo atual (Render + Vercel).

Escopo: somente RL, Sprocket e Tires. O legado e a fonte de verdade.

## RL (Rod/Stroke)

Fontes: `zip/_rodstroke.zip` (`rodstroke.js`, `rodstroke-original.html`, `rodstroke-new.html`).

Paridade OK
- Inputs: diametro (bore), curso (stroke), biela (rod) em mm.
- Outputs: deslocamento (cc), geometria (square/oversquare/undersquare), RL ratio + suavidade.
- Regras: smoothness por thresholds (>=0.30 rough, >=0.25 normal, else smooth).
- Geometria com tolerancia 0.03 sobre (bore vs stroke).
- Fluxo original/new com baseline (localStorage no legado).

Diferencas encontradas
- Legado nao exibe rod/stroke ratio; o modelo novo expoe `rod_stroke_ratio`.
- Legado nao possui sistema de unidades (somente mm); o modelo novo aceita `unit_system` na API.
- Taxa de compressao e extensao v1 (nao existe no legado).
- Taxa de compressao inclui `compression.mode` (`simple`/`advanced`) para variar o nivel de detalhe (extensao v1).

Correcoes aplicadas
- UI/UX expande para `unit_system` (metric/imperial) mantendo calculo adimensional; legado continua em mm.

Pontos ambiguos do legado
- Nenhuma ambiguidade adicional observada no JS/HTML.

## Sprocket (Coroa/Pinhao)

Fontes: `zip/_sprocket.zip` (`sprocket.js`, `sprocket-original.html`, `sprocket-new.html`).

Paridade OK
- Inputs: pinhao (dentes), coroa (dentes), passo da corrente (opcional), numero de elos (opcional, par).
- Outputs: relacao, comprimento da corrente, distancia entre eixos.
- Diffs: percentuais e absolutos por item quando baseline existe.
- Regras: passo da corrente mapeado por codigo (415/420/428/520/525/530/630).
- Centro de eixos calculado iterativamente e clampado entre 620 e 680 mm.
- Unidade exibida: cm para pt/es e in para en_US.

Diferencas encontradas
- Nenhuma divergencia funcional relevante.

Correcoes aplicadas
- Comparacao padronizada para exibir valores Original/New + delta absoluto e percentual.

Pontos ambiguos do legado
- O “wearFactor” 0.98 so e aplicado no conjunto new; mantido.

## Tires (Aro/Pneu)

Fontes: `zip/_tires.zip` (`tires.js`, `tires-original.html`, `tires-new.html`, `tires-database.js`).

Paridade OK
- Inputs: tipo de veiculo, aro, largura, perfil, tala opcional.
- Flotation existe no JS do legado e e limitado ao veiculo Utility (checkbox oculto no HTML).
- Outputs: diametro do conjunto e largura do conjunto.
- Diffs: percentuais + absolutos quando baseline existe.
- Unidade exibida: mm para pt/es, in para en_US.

Diferencas encontradas
- O modelo atual expande categorias (LightTruck, TruckCommercial, Kart, Kartcross), inexistentes no legado.
- O modelo atual expande o parser de flotation para aceitar `NNxWW-ZZ` (alem de `NNxWWRZZ`), o que nao existe no legado.
- O modelo atual adiciona flotation para Motorcycle (`NN.NN-ZZ`), inexistente no legado.

Correcoes aplicadas
- UI/UX ajustada para manter logica de selects e comparacao identica ao fluxo do legado.
- Validacao de flotation para Motorcycle adicionada apenas no modelo novo, mantendo o legado intacto.

Pontos ambiguos do legado
- O checkbox de flotation aparece oculto no HTML, mas o JS suporta o fluxo completo (comportamento implicito).

## Resumo geral

- Paridade funcional mantida para regras, formulas e arredondamentos do legado.
- Divergencias atuais sao extensoes documentadas (categorias adicionais e formato de flotation).
- Flotation para Motorcycle e extensao documentada do modelo novo.
