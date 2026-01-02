# UI/UX Style Guide (Pilot)

Este documento define a identidade visual "pilot" usada nas calculadoras gratuitas do PowerTunePro.
Ele serve como referencia tecnica para manter consistencia visual e evitar perda de detalhes em refactors.

## Objetivo

- Visual tecnico, industrial, maduro.
- Boa legibilidade em embed (iframe) e pagina standalone.
- Componentes simples, sem dependencias externas.

## Tokens e paleta

- Primario (cobre queimado): `--ptp-primary`
- Contraste primario: `--ptp-primary-contrast`
- Texto: `--ptp-text`
- Texto secundario: `--ptp-muted`
- Superficie: `--ptp-surface`
- Superficie alternativa: `--ptp-surface-alt`
- Borda (sutil): `--ptp-border`
- Foco: `--ptp-focus`
- Azul blueprint (detalhes): usado no gradiente do card
- Metrico (accent): `--ptp-metric`

## Backgrounds e embed

- Pagina standalone usa gradiente radial escuro.
- Em embed (iframe), o `body` e `html` ficam transparentes (`ptp-embed`),
  para que o host controle o fundo.

## Cards

- Cards sao o "bloco principal" do conteudo.
- Estilo "pilot":
  - Gradiente diagonal com azul blueprint + azul escuro (quase preto).
  - Sombra suave para profundidade.
  - Sem borda explicita.

## Inputs

- Sem borda visivel.
- Fundo sutil com sombra curta.
- Texto e label centralizados.
- Foco: contorno com `--ptp-focus`.

## Botoes

- Primario com cobre queimado.
- Hover: leve brilho (`brightness`) + contorno com `--ptp-focus`.
- Estado desabilitado: opacidade reduzida.

## Cabecalho de secao

- Titulo grande (28-34px) com peso alto.
- Espacamento inferior maior para separar de inputs.
- Toggle de unidade alinhado a direita no mesmo eixo do titulo.

## Resultados e comparacao

- Resultados ficam dentro do mesmo card do formulario.
- Painel de comparacao aparece somente quando ha dados.
- Labels de resultados traduzidas por i18n.

## Espacamento e alinhamento

- `ptp-stack` controla o empilhamento vertical.
- `ptp-actions` alinha botoes a direita e adiciona margem inferior,
  para separar dos resultados.
- Grid responsivo com 1 coluna no mobile.

## Responsividade

- Titulos reduzem em telas estreitas.
- Cards mantem padding consistente.

## Notas de implementacao

- Variantes visuais sao aplicadas via classe `ptp-variant-pilot`.
- Evitar alterar tokens sem validar em todas as calculadoras.
