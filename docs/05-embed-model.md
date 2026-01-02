# Embed Model

Defines the iframe embed model for powertunepro.com calculators and the recommended integration pattern.

## Overview

All calculators are delivered as iframes embedded in powertunepro.com pages. The iframe always points to Vercel. The host page does not call calculation APIs and only embeds the UI. The embed must be stable, consistent across calculators, and require minimal configuration.

## Recommended embed pattern

- Use a single, shared embed loader (conceptual) for all calculators to avoid duplication and divergence.
- The host page decides the target calculator and passes parameters (calculator slug, language, optional theme) to the iframe.
- Avoid per-widget manual configuration; keep the API consistent across all calculators.

## Language passing

Preferred: host detects language and sends it to the iframe via `postMessage`.

Alternative: pass language by query string, e.g. `?lang=pt_BR`, for environments that cannot use `postMessage`.

## postMessage security

When using `postMessage`:
- Validate `event.origin` against the allowed host list.
- Never use `targetOrigin="*"`; always use the exact host origin.
- Reject messages without the expected shape (e.g., missing `language`).

## Auto-resize strategy

Use a lightweight `postMessage` protocol to synchronize iframe height:
- The iframe sends its current content height to the host after load and on layout changes.
- The host updates the iframe `height` accordingly.
- The host should validate origin before applying changes.

This approach prevents scrollbars and keeps the embed aligned with the host layout without manual tuning.

## Communication scope

Host <-> iframe communication is limited to language handoff and auto-resize. No calculator API calls occur from the host.

## Host examples

Language handoff (on iframe load):

```js
iframe.addEventListener('load', () => {
  iframe.contentWindow.postMessage({ language: 'pt_BR' }, 'https://ptp-calculators.vercel.app');
});
```

Auto-resize listener:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://ptp-calculators.vercel.app') return;
  if (event.data?.type === 'ptp:resize') {
    iframe.style.height = `${event.data.height}px`;
  }
});
```

Language ACK (optional):

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://ptp-calculators.vercel.app') return;
  if (event.data?.type === 'ptp:lang:ack') {
    // optional: confirm applied language
  }
});
```

Testing directly on Vercel uses origin https://ptp-calculators.vercel.app and must be allowlisted by the BFF.

## Production snippets (widgets)

O padrao correto para embed e sempre usar widgets separados (Original + New). As paginas `/displacement`, `/rl`, `/sprocket` e `/tires` continuam existindo para uso standalone, mas nao devem ser usadas em embed.
O script canonico do host esta documentado em `docs/11-host-bridge-script.md`.

O host deve allowlistar apenas o dominio da UI do Vercel e nunca chamar o Render diretamente. Use https://ptp-calculators.vercel.app como dominio da UI.

## Displacement widgets (Original/New)

Use dois iframes. O host gera um `pageId` compartilhado e faz bridge do resultado do Original para o New.

```html
<div id="ptp-displacement-widgets">
  <iframe
    id="ptp-iframe-displacement-original"
    src="https://ptp-calculators.vercel.app/widgets/displacement-original?lang=pt_BR&pageId=ptp-displacement-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
  <iframe
    id="ptp-iframe-displacement-new"
    src="https://ptp-calculators.vercel.app/widgets/displacement-new?lang=pt_BR&pageId=ptp-displacement-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
</div>
<script>
  const uiOrigin = "https://ptp-calculators.vercel.app";
  const pageId = `ptp-displacement-${Math.random().toString(36).slice(2)}`;
  const originalIframe = document.getElementById("ptp-iframe-displacement-original");
  const newIframe = document.getElementById("ptp-iframe-displacement-new");

  originalIframe.src = `${uiOrigin}/widgets/displacement-original?lang=pt_BR&pageId=${pageId}`;
  newIframe.src = `${uiOrigin}/widgets/displacement-new?lang=pt_BR&pageId=${pageId}`;

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

    if (
      event.data?.type === "ptp:calc:displacement:originalResult" &&
      event.data?.pageId === pageId
    ) {
      newIframe.contentWindow.postMessage(
        {
          type: "ptp:calc:displacement:baseline",
          pageId,
          payload: event.data.payload,
        },
        uiOrigin
      );
    }
  });
</script>
```
Nota: o `pageId` e recomendado para evitar colisao quando houver multiplos pares de widgets na mesma pagina. Sem `pageId`, os widgets ainda funcionam, mas a comparacao entre Original e New nao e habilitada.

## RL widgets (Original/New)

```html
<div id="ptp-rl-widgets">
  <iframe
    id="ptp-iframe-rl-original"
    src="https://ptp-calculators.vercel.app/widgets/rl-original?lang=pt_BR&pageId=ptp-rl-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
  <iframe
    id="ptp-iframe-rl-new"
    src="https://ptp-calculators.vercel.app/widgets/rl-new?lang=pt_BR&pageId=ptp-rl-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
</div>
<script>
  const uiOrigin = "https://ptp-calculators.vercel.app";
  const pageId = `ptp-rl-${Math.random().toString(36).slice(2)}`;
  const originalIframe = document.getElementById("ptp-iframe-rl-original");
  const newIframe = document.getElementById("ptp-iframe-rl-new");

  originalIframe.src = `${uiOrigin}/widgets/rl-original?lang=pt_BR&pageId=${pageId}`;
  newIframe.src = `${uiOrigin}/widgets/rl-new?lang=pt_BR&pageId=${pageId}`;

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

    if (event.data?.type === "ptp:calc:rl:originalResult" && event.data?.pageId === pageId) {
      newIframe.contentWindow.postMessage(
        {
          type: "ptp:calc:rl:baseline",
          pageId,
          payload: event.data.payload,
        },
        uiOrigin
      );
    }
  });
</script>
```

## Sprocket widgets (Original/New)

```html
<div id="ptp-sprocket-widgets">
  <iframe
    id="ptp-iframe-sprocket-original"
    src="https://ptp-calculators.vercel.app/widgets/sprocket-original?lang=pt_BR&pageId=ptp-sprocket-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
  <iframe
    id="ptp-iframe-sprocket-new"
    src="https://ptp-calculators.vercel.app/widgets/sprocket-new?lang=pt_BR&pageId=ptp-sprocket-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
</div>
<script>
  const uiOrigin = "https://ptp-calculators.vercel.app";
  const pageId = `ptp-sprocket-${Math.random().toString(36).slice(2)}`;
  const originalIframe = document.getElementById("ptp-iframe-sprocket-original");
  const newIframe = document.getElementById("ptp-iframe-sprocket-new");

  originalIframe.src = `${uiOrigin}/widgets/sprocket-original?lang=pt_BR&pageId=${pageId}`;
  newIframe.src = `${uiOrigin}/widgets/sprocket-new?lang=pt_BR&pageId=${pageId}`;

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

    if (event.data?.type === "ptp:calc:sprocket:originalResult" && event.data?.pageId === pageId) {
      newIframe.contentWindow.postMessage(
        {
          type: "ptp:calc:sprocket:baseline",
          pageId,
          payload: event.data.payload,
        },
        uiOrigin
      );
    }
  });
</script>
```

## Tires widgets (Original/New)

```html
<div id="ptp-tires-widgets">
  <iframe
    id="ptp-iframe-tires-original"
    src="https://ptp-calculators.vercel.app/widgets/tires-original?lang=pt_BR&pageId=ptp-tires-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
  <iframe
    id="ptp-iframe-tires-new"
    src="https://ptp-calculators.vercel.app/widgets/tires-new?lang=pt_BR&pageId=ptp-tires-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
</div>
<script>
  const uiOrigin = "https://ptp-calculators.vercel.app";
  const pageId = `ptp-tires-${Math.random().toString(36).slice(2)}`;
  const originalIframe = document.getElementById("ptp-iframe-tires-original");
  const newIframe = document.getElementById("ptp-iframe-tires-new");

  originalIframe.src = `${uiOrigin}/widgets/tires-original?lang=pt_BR&pageId=${pageId}`;
  newIframe.src = `${uiOrigin}/widgets/tires-new?lang=pt_BR&pageId=${pageId}`;

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

    if (event.data?.type === "ptp:calc:tires:originalResult" && event.data?.pageId === pageId) {
      newIframe.contentWindow.postMessage(
        {
          type: "ptp:calc:tires:baseline",
          pageId,
          payload: event.data.payload,
        },
        uiOrigin
      );
    }
  });
</script>
```
