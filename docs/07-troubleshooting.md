# Troubleshooting

Common issues and how to validate them without exposing Render or secrets.

## 403 from BFF (/api/v1/calc/*)

Symptoms:
- The UI shows an error and the BFF responds with HTTP 403.
- Render logs show no corresponding POST.

Likely causes:
- `Origin` header is not allowlisted.
- `Origin` is missing and the `Host` header is not allowlisted.

What to check:
- Ensure the request origin is one of:
  - https://powertunepro.com
  - https://www.powertunepro.com
  - https://ptp-calculators.vercel.app
  - http://localhost:3000
- If testing directly on Vercel, the origin should be `https://ptp-calculators.vercel.app`.
- Check Vercel function logs for entries like:
  - `blocked origin: <origin> host: <host>`

## Render cold start vs. BFF block

Symptoms:
- First request feels slow or times out.
- Subsequent requests succeed.

Notes:
- Render may cold-start after idle. This should not produce a 403 in the BFF.
- If you see a 403, fix the origin allowlist first.

## 500/502 from BFF

Symptoms:
- BFF responds with 500 `server_misconfigured` or 502 `upstream_unavailable`.

Likely causes:
- `RENDER_API_BASE` or `PTP_INTERNAL_KEY` missing in Vercel env.
- Render service unavailable or sleeping.

What to check:
- Vercel project env vars exist (do not print values):
  - `RENDER_API_BASE`
  - `PTP_INTERNAL_KEY`
- Render health endpoint responds and logs show requests only from Vercel.

## Log-based validation (Vercel + Render)

- Vercel function logs:
  - Expect 200 from `/api/v1/calc/*` when origin is allowed.
  - If blocked, the log should show the origin/host combination.
- Render logs:
  - Expect POST `/v1/calc/*` only when BFF requests succeed.
  - No direct browser calls should appear.