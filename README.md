# powertunepro-calculators

This repository is a workspace/monorepo for the PowerTunePro calculator services.

Structure
- `backend-api/` - FastAPI service deployed to Render (internal-only).
- `frontend-api/` - Next.js + TypeScript app deployed to Vercel (UI + BFF).

Deployment and access model: Render is internal-only and accepts requests only from Vercel (BFF). The site embeds the Vercel UI via iframe. The four calculators remain permanently free.

UI routes (Vercel): `/displacement`, `/rl`, `/sprocket`, `/tires`.
Widget routes (Vercel): `/widgets/displacement-original|new`, `/widgets/rl-original|new`, `/widgets/sprocket-original|new`, `/widgets/tires-original|new`.
BFF routes (Vercel): `/api/v1/calc/*` (browser -> Vercel only). Embed guidance: see `docs/05-embed-model.md`.

Repository
- This repository is already versioned with Git.
- Codex is the technical executor for ongoing changes from this point forward.
