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

## Production snippets

The host must allowlist only the Vercel UI domain and never call Render directly. Use https://ptp-calculators.vercel.app as the Vercel UI domain.

Displacement

```html
<iframe
  id="ptp-displacement"
  src="https://ptp-calculators.vercel.app/displacement?lang=pt_BR"
  width="100%"
  style="border:0;"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
<script>
  const iframe = document.getElementById('ptp-displacement');
  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage({ language: 'pt_BR' }, 'https://ptp-calculators.vercel.app');
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://ptp-calculators.vercel.app') return;
    if (event.data?.type === 'ptp:resize') {
      iframe.style.height = `${event.data.height}px`;
    }
    if (event.data?.type === 'ptp:lang:ack') {
      // optional: confirm applied language
    }
  });
</script>
```

RL

```html
<iframe
  id="ptp-rl"
  src="https://ptp-calculators.vercel.app/rl?lang=pt_BR"
  width="100%"
  style="border:0;"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
<script>
  const iframe = document.getElementById('ptp-rl');
  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage({ language: 'pt_BR' }, 'https://ptp-calculators.vercel.app');
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://ptp-calculators.vercel.app') return;
    if (event.data?.type === 'ptp:resize') {
      iframe.style.height = `${event.data.height}px`;
    }
    if (event.data?.type === 'ptp:lang:ack') {
      // optional: confirm applied language
    }
  });
</script>
```

Sprocket

```html
<iframe
  id="ptp-sprocket"
  src="https://ptp-calculators.vercel.app/sprocket?lang=pt_BR"
  width="100%"
  style="border:0;"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
<script>
  const iframe = document.getElementById('ptp-sprocket');
  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage({ language: 'pt_BR' }, 'https://ptp-calculators.vercel.app');
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://ptp-calculators.vercel.app') return;
    if (event.data?.type === 'ptp:resize') {
      iframe.style.height = `${event.data.height}px`;
    }
    if (event.data?.type === 'ptp:lang:ack') {
      // optional: confirm applied language
    }
  });
</script>
```

Tires

```html
<iframe
  id="ptp-tires"
  src="https://ptp-calculators.vercel.app/tires?lang=pt_BR"
  width="100%"
  style="border:0;"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
<script>
  const iframe = document.getElementById('ptp-tires');
  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage({ language: 'pt_BR' }, 'https://ptp-calculators.vercel.app');
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://ptp-calculators.vercel.app') return;
    if (event.data?.type === 'ptp:resize') {
      iframe.style.height = `${event.data.height}px`;
    }
    if (event.data?.type === 'ptp:lang:ack') {
      // optional: confirm applied language
    }
  });
</script>
```
## Displacement widgets (Original/New)

Use two separate iframes when you want Original and New on the same host page. The host generates a shared `pageId` and bridges the result from the Original widget to the New widget.

```html
<div id="ptp-displacement-widgets">
  <iframe
    id="ptp-displacement-original"
    src="https://ptp-calculators.vercel.app/widgets/displacement-original?lang=pt_BR&pageId=ptp-displacement-123"
    width="100%"
    style="border:0;"
    loading="lazy"
    referrerpolicy="no-referrer"
  ></iframe>
  <iframe
    id="ptp-displacement-new"
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
  const originalIframe = document.getElementById("ptp-displacement-original");
  const newIframe = document.getElementById("ptp-displacement-new");

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