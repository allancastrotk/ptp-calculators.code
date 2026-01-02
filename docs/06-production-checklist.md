# Production Checklist

Checklist de validacao para integrar os iframes das calculadoras no powertunepro.com.

Pre-flight
- Confirmar que o dominio do Vercel esta allowlisted no host.
- Confirmar que o browser nunca chama Render diretamente.
- Confirmar que o iframe carrega sozinho no dominio do Vercel.
- Confirmar que o embed usa sempre /widgets/<calc>-original + /widgets/<calc>-new.

Idioma
- Query param ?lang=pt_BR aplica idioma inicial.
- postMessage { language } troca idioma apos o load.
- Mensagens de origin nao allowlisted sao ignoradas.

Resize
- ptp:resize recebido apos load.
- ptp:resize recebido apos calcular e apos erro.
- Height do iframe acompanha o conteudo sem scroll interno.

Smoke tests (Vercel-only)
- Displacement: calcular Original e New, validar cc/L/ci + geometria e diffs.
- RL: calcular Original e New, validar RL + rod/stroke + diffs.
- Sprocket: calcular Original e New, validar ratio + chain length + center distance + diffs.
- Tires: calcular Original e New, validar diameter + width + diffs.

Seguranca
- Nenhuma chamada do browser para Render.
- Somente /api/v1/calc/* exposto ao browser.
- Nenhum segredo exposto no client.
