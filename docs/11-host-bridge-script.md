# Host Bridge Script (Widgets Original/New)

Este documento descreve o script canonico do host para conectar dois iframes (Original + New) de cada calculadora.
O objetivo e manter baseline isolado por visitante usando `pageId`, sem armazenar dados no backend.

## Tipos de mensagem

Mensagens do iframe (calculadora) para o host:
- `ptp:resize` (altura do iframe)
- `ptp:lang:ack` (idioma aplicado)
- `ptp:calc:<calc>:originalResult` (payload do resultado original)

Mensagens do host para o iframe:
- `{ language: "pt_BR" | "en_US" | "es_ES" }`
- `ptp:calc:<calc>:baseline` (payload original repassado ao New)

## Snippet generico (host)

Substitua:
- `<calc>` pelo slug (`displacement`, `rl`, `sprocket`, `tires`)
- `ptp-iframe-<calc>-original` / `ptp-iframe-<calc>-new`

```html
<div id="ptp-<calc>-widgets">
  <iframe
    id="ptp-iframe-<calc>-original"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
  <iframe
    id="ptp-iframe-<calc>-new"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
</div>
<script>
  const uiOrigin = "https://ptp-calculators.vercel.app";
  const pageId = `ptp-<calc>-${Math.random().toString(36).slice(2)}`;

  const originalIframe = document.getElementById("ptp-iframe-<calc>-original");
  const newIframe = document.getElementById("ptp-iframe-<calc>-new");

  originalIframe.src = `${uiOrigin}/widgets/<calc>-original?lang=pt_BR&pageId=${pageId}`;
  newIframe.src = `${uiOrigin}/widgets/<calc>-new?lang=pt_BR&pageId=${pageId}`;

  originalIframe.addEventListener("load", () => {
    originalIframe.contentWindow.postMessage({ language: "pt_BR" }, uiOrigin);
  });
  newIframe.addEventListener("load", () => {
    newIframe.contentWindow.postMessage({ language: "pt_BR" }, uiOrigin);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== uiOrigin) return;

    if (event.data?.type === "ptp:resize") {
      if (event.source === originalIframe.contentWindow) {
        originalIframe.style.height = `${event.data.height}px`;
      }
      if (event.source === newIframe.contentWindow) {
        newIframe.style.height = `${event.data.height}px`;
      }
    }

    if (event.data?.type === "ptp:lang:ack") {
      // opcional: confirmar idioma aplicado
    }

    if (event.data?.type === `ptp:calc:<calc>:originalResult` && event.data?.pageId === pageId) {
      newIframe.contentWindow.postMessage(
        {
          type: `ptp:calc:<calc>:baseline`,
          pageId,
          payload: event.data.payload,
        },
        uiOrigin
      );
    }
  });
</script>
```

## Troubleshooting

- `ptp:resize` nao recebido: verifique allowlist de origin e se o iframe usa `ptp:embed`.
- Baseline nao chega no New: confirme `pageId` identico em ambos iframes.
- Idioma nao altera: confirme `language` enviado no `postMessage` e `ptp:lang:ack`.

## Seguranca

- Nunca use `targetOrigin="*"`.
- Permita apenas `https://ptp-calculators.vercel.app` no host.
- O host nunca chama o Render diretamente.
