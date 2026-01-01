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
\n## Host examples\n\nLanguage handoff (on iframe load):\n`js\niframe.addEventListener('load', () => {\n  iframe.contentWindow.postMessage({ language: 'pt_BR' }, 'https://vercel.example.com');\n});\n`\n\nAuto-resize listener:\n`js\nwindow.addEventListener('message', (event) => {\n  if (event.origin !== 'https://vercel.example.com') return;\n  if (event.data?.type === 'ptp:resize') {\n    iframe.style.height = ${event.data.height}px;\n  }\n});\n`\n\nLanguage ACK (optional):\n`js\nwindow.addEventListener('message', (event) => {\n  if (event.origin !== 'https://vercel.example.com') return;\n  if (event.data?.type === 'ptp:lang:ack') {\n    // optional: confirm applied language\n  }\n});\n`\n