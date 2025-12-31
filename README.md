# powertunepro-calculators

This repository is a workspace/monorepo for the PowerTunePro calculator services.

Purpose
- Prepare a clean workspace for future implementation of PowerTunePro calculators.
- This step is only environment/workspace preparation — no calculator logic implemented.

Structure
- `backend-api/` — Minimal FastAPI service intended to be deployed to Render (contains a `/health` endpoint).
- `frontend-api/` — Minimal Next.js + TypeScript app intended to be deployed to Vercel (contains a placeholder index page).

Notes
- Backend and frontend are intentionally minimal and kept separate.
- Do NOT implement calculator logic, databases, or authentication at this stage.
- Future steps will add calculator endpoints and UI components in separate iterations.

Deployment and access model: Render is internal-only and accepts requests only from Vercel (BFF), the site embeds the Vercel UI via iframe, and the four calculators are permanently free.

Repository
- This repository is already versioned with Git.
- Codex is the technical executor for ongoing changes from this point forward.
