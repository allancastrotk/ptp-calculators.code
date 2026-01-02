# UI/UX Style Guide (Pilot)

Este documento define a identidade visual "pilot" usada nas calculadoras gratuitas do PowerTunePro.
Ele serve como referencia tecnica para manter consistencia visual e evitar perda de detalhes em refactors.

## Objetivo

- Visual tecnico, industrial, maduro.
- Boa legibilidade em embed (iframe) e pagina standalone.
- Componentes simples, sem dependencias externas.

## Tokens e paleta

- Primario (cobre queimado): `--ptp-primary` [#C7783A]
- Contraste primario: `--ptp-primary-contrast` [#24160E]
- Texto: `--ptp-text` [#F3EFE9]
- Texto secundario: `--ptp-muted` [#B7ACA2]
- Superficie: `--ptp-surface` [#1B1612]
- Superficie alternativa: `--ptp-surface-alt` [#231C16]
- Borda (sutil): `--ptp-border` [#C9783A3D]
- Foco: `--ptp-focus` [#C7783A59]
- Azul blueprint (detalhes): [#285A82]
- Metrico (accent): `--ptp-metric` [#6DA0C7]

## Backgrounds e embed

- Pagina standalone usa gradiente radial escuro de [#1C2130] para [#14110E].
- Em embed (iframe), o `body` e `html` ficam transparentes (`ptp-embed`),
  para que o host controle o fundo.

## Cards

- Cards sao o "bloco principal" do conteudo.
- Estilo "pilot":
  - Gradiente diagonal (135deg) com azul blueprint [#285A82] no canto superior/esquerdo
    e azul bem escuro [#0B121C] no canto inferior/direito.
  - Sombra suave para profundidade.
  - Sem borda explicita.

## Inputs

- Sem borda visivel.
- Fundo sutil com sombra curta.
- Texto e label centralizados.
- Foco: contorno com `--ptp-focus`.

## Botoes

- Primario com cobre queimado [#C7783A].
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
