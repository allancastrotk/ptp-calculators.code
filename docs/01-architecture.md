# Architecture

System architecture notes for the backend and frontend boundary and deployment targets.

The system uses a single backend API on Render and a Next.js frontend on Vercel, embedded via iframe. All calculations are executed in the backend, and the frontend acts as a thin client aligned with the v1 API contract.
