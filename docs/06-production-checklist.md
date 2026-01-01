# Production Checklist

Checklist de validacao para integrar os iframes das calculadoras no powertunepro.com.

Pre-flight
- Confirmar que o dominio do Vercel esta allowlisted no host.
- Confirmar que o browser nunca chama Render diretamente.
- Confirmar que o iframe carrega sozinho no dominio do Vercel.

Idioma
- Query param ?lang=pt_BR aplica idioma inicial.
- postMessage { language } troca idioma apos o load.
- Mensagens de origin nao allowlisted sao ignoradas.

Resize
- ptp:resize recebido apos load.
- ptp:resize recebido apos calcular e apos erro.
- Height do iframe acompanha o conteudo sem scroll interno.

Smoke tests (Vercel-only)
- Displacement: envia valores validos e confirma cc/L/ci + geometria.
- RL: envia valores validos e confirma rl_ratio e rod_stroke_ratio.
- Sprocket: envia dentes validos e confirma ratio.
- Tires: envia medida valida e confirma diameter e width.

Seguranca
- Nenhuma chamada do browser para Render.
- Somente /api/v1/calc/* exposto ao browser.
- Nenhum segredo exposto no client.