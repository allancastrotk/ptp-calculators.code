# UI Hints (Tooltips) — Calculadoras Gratuitas

Este documento lista os hints (tooltips) sugeridos para campos de entrada e resultados.
Organizado por calculadora. Textos curtos, tecnicos e objetivos.

Observacao de terminologia:
- "Hint" = tooltip informativo acionado por um icone "i".
- Onde fizer sentido, usar o mesmo hint para original e novo.

---

## Displacement (Cilindrada)

### Inputs
- Bore (Diametro): Diametro interno do cilindro. Use a unidade selecionada.
- Stroke (Curso): Curso total do pistao (TDC a BDC). Use a unidade selecionada.
- Cylinders: Numero total de cilindros do motor.
- Cilindrada declarada (opcional): Valor informado pelo fabricante para comparacao. Nao altera o calculo.

**Taxa de compressao (TAXA)**
- Modo (Simples/Tecnico): Simples usa apenas volume da camara. Tecnico considera junta/deck/pistao.
- Chamber volume: Volume da camara do cilindro, medido em cc (ou cu in).
- Gasket thickness: Espessura da junta de cabecote.
- Gasket bore: Diametro do furo da junta.
- Deck height: Altura do deck (pistao abaixo/acima do plano do bloco).
- Piston volume: Volume do pistao (dome negativo, dish positivo).
- Exhaust port height (2T): Altura da janela de escape (medida a partir do topo).
- Transfer port height (2T): Altura da janela de transferencia.
- Crankcase volume (2T): Volume do carter (necessario para taxa do carter).

### Resultados
- Displacement (cc): Cilindrada total em centimetros cubicos.
- Displacement (L): Cilindrada total em litros.
- Displacement (cu in): Cilindrada total em polegadas cubicas.
- Geometry: Classificacao entre square / oversquare / undersquare.

**Taxa de compressao (TAXA)**
- Compression ratio: Taxa geometrica (4T) ou efetiva (2T).
- Clearance volume: Volume total de folga no PMS.
- Swept volume: Volume varrido pelo pistao.
- Trapped volume (2T): Volume efetivo varrido ate o fechamento das janelas.
- Crankcase compression: Taxa do carter (2T), quando informado.

---

## RL (Rod/Stroke)

### Inputs
- Bore (Diametro): Diametro interno do cilindro.
- Stroke (Curso): Curso total do pistao.
- Rod length (Biela): Comprimento centro-a-centro da biela.

**Taxa de compressao (TAXA)**
- Modo (Simples/Tecnico): Simples usa apenas volume da camara. Tecnico considera junta/deck/pistao.
- Chamber volume: Volume da camara do cilindro.
- Gasket thickness: Espessura da junta.
- Gasket bore: Diametro do furo da junta.
- Deck height: Altura do deck.
- Piston volume: Volume do pistao.
- Exhaust port height (2T): Altura da janela de escape.
- Transfer port height (2T): Altura da janela de transferencia.
- Crankcase volume (2T): Volume do carter.

### Resultados
- Displacement: Cilindrada por cilindro (sem multiplicar por numero de cilindros).
- Geometry: Classificacao geometrica (square/oversquare/undersquare).
- Smoothness: Indicador de suavidade (rough/normal/smooth).
- R/L ratio: Relacao (stroke/2) / rod_length.
- Rod/Stroke: Relacao rod_length / stroke.

**Taxa de compressao (TAXA)**
- Compression ratio: Taxa geometrica (4T) ou efetiva (2T).
- Clearance volume: Volume total de folga no PMS.
- Swept volume: Volume varrido pelo pistao.
- Trapped volume (2T): Volume efetivo varrido ate o fechamento das janelas.
- Crankcase compression: Taxa do carter (2T), quando informado.

---

## Sprocket (Coroa/Pinhao)

### Inputs
- Pinhao (dentes): Numero de dentes do pinhao.
- Coroa (dentes): Numero de dentes da coroa.
- Passo da corrente: Codigo do passo (415/420/428/520/525/530/630).
- Numero de elos: Total de elos da corrente (par).

### Resultados
- Relacao: Coroa / Pinhao.
- Comprimento da corrente: Comprimento total da corrente com base no passo.
- Distancia entre eixos: Distancia estimada entre pinhao e coroa.

---

## Tires (Aro/Pneu)

### Inputs
- Tipo de veiculo: Categoria de aplicacao (Car, Motorcycle, LightTruck, TruckCommercial, Kart, Kartcross).
- Aro (in): Diametro do aro em polegadas.
- Largura (mm): Largura nominal do pneu (metrico).
- Perfil (%): Altura do flanco como percentual da largura.
- Tala do aro (opcional): Largura do aro para referencia visual.
- Medida Flotation: Medida em polegadas (ex.: 31x10.5-15), quando habilitado.
- Medida (Metrico/Flotation): Alterna formato de entrada quando suportado pela categoria.

### Resultados
- Diametro do conjunto: Diametro total aro + pneu.
- Largura do conjunto: Largura total do conjunto.
- Diferenca pneu/aro: Diferenca entre largura do pneu e tala do aro (referencia visual).

---

## Notas gerais

- Hints de comparacao (Original vs Novo) devem explicar que as variacoes exibem delta absoluto e percentual.
- Para campos opcionais, indicar claramente que nao afetam o calculo se estiverem vazios.
- Todos os hints devem respeitar o idioma selecionado (pt_BR, en_US, es_ES).
