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
