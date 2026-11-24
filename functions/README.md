# BetterGovPH Status Cloudflare Worker

This folder contains the single Cloudflare Worker serving both the `/api/*` endpoints and scheduled uptime checks.

## Bindings & Secrets

| Name | Type | Required | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Secret | Yes | Supabase project REST endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Yes | Service role key for `bgovph_*` RPCs and queries |
| `CHECK_QUEUE` | Queue | Optional | Fans out batches of <=40 checks (falls back to inline single-batch check if missing) |
| `API_RATE_LIMITER` | Rate Limit | Optional | Limits dynamic `/api/*` requests to 120 req / 60s per IP |
| `TRIGGER_SECRET` | Secret | Optional | Bearer token for `POST /api/trigger` |

## HTTP Security

All `/api/*` routes pass through `lib/request-security.ts`:

- CORS is restricted to `bettergov.ph`, `*.bettergov.ph`, `*.workers.dev` over HTTPS, and `localhost` / `127.0.0.1` for local development.
- Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` fails clearly with HTTP `503`.

## Scheduled Checks & Tiering

The Worker cron (`*/5 * * * *`) selects due monitors:

- `critical` monitors run every 5 minutes.
- `standard` monitors run every 15 minutes (`minute % 15 === 0`).
- A daily cron (`15 16 * * *`, 00:15 Asia/Manila) calls `bgovph_prune_checks(30)`.
