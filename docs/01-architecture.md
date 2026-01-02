# Architecture

System architecture notes for the backend and frontend boundary and deployment targets.

The system uses a single backend API on Render and a Next.js frontend on Vercel, embedded via iframe. All calculations are executed in the backend, and the frontend acts as a thin client aligned with the v1 API contract.

Trust boundaries and allowed flow:
- Allowed: powertunepro.com -> Vercel (UI + API Routes) -> Render (calculations).
- Prohibited: Browser -> Render.
- Prohibited: Third-party sites -> Vercel API.
- The site only embeds the Vercel UI and does not call calculation APIs directly.

Allowed origins for BFF:
- https://powertunepro.com
- https://www.powertunepro.com
- https://ptp-calculators.vercel.app
- http://localhost:3000\nAutenticacao interna:\n- O BFF envia X-PTP-Internal-Key e Authorization: Bearer <key> como fallback (server-to-server).\n