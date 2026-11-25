# BetterGovPH Status Cloudflare Worker

This folder contains the single Cloudflare Worker serving both the `/api/*` endpoints and scheduled uptime checks.

## Bindings & Secrets

| Name                        | Type       | Required | Purpose                                                                                                             |
| --------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Secret     | Yes      | Supabase project REST endpoint                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret     | Yes      | Service role key for `bgovph_*` RPCs and queries                                                                    |
| `CHECK_QUEUE`               | Queue      | Optional | Fans out batches of <=40 checks (falls back to inline single-batch check if missing)                                |
| `API_RATE_LIMITER`          | Rate Limit | Optional | Limits dynamic `/api/*` requests to 120 req / 60s per IP                                                            |
| `TRIGGER_SECRET`            | Secret     | Optional | Bearer token for `POST /api/trigger`                                                                                |
| `SITE_URL`                  | Var        | Optional | Canonical public URL for absolute links in `llms.txt`, `robots.txt`, `sitemap.xml`, OpenAPI. Empty = request origin |

## HTTP Security

All Worker routes pass through `lib/request-security.ts`:

- Public read-only requests (`GET`/`HEAD`, and preflights for them) get `Access-Control-Allow-Origin: *`, so browser-based agents and tools can use the open data.
- Non-GET requests (for example `POST /api/trigger`) are restricted to `bettergov.ph`, `*.bettergov.ph`, `*.workers.dev` over HTTPS, and `localhost` / `127.0.0.1`. Other origins get `403`.
- Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` fails clearly with HTTP `503`. The discovery files (`/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/api/openapi.json`) are built from bundled data and don't need Supabase.

## Agent / LLM surface (`agent/`)

| Route                                                                          | File                | Notes                                                |
| ------------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------- |
| `/llms.txt`, `/.well-known/llms.txt`, `/llms-full.txt`                         | `agent/llms.ts`     | Static, bundled data                                 |
| `/robots.txt`                                                                  | `agent/robots.ts`   | Allows retrieval agents, blocks AI-training crawlers |
| `/sitemap.xml`                                                                 | `agent/sitemap.ts`  | Static pages + every enabled monitor                 |
| `/api/openapi.json`                                                            | `agent/openapi.ts`  | Keep in sync with routes (enforced by test)          |
| `/status.md`, `/api/status.md`, `/api/incidents.md`, `/api/monitors/{slug}.md` | `agent/markdown.ts` | Live data, `text/markdown`                           |

Root-level routes must also appear in `assets.run_worker_first` in `wrangler.jsonc`.

## Scheduled Checks & Tiering

The Worker cron (`*/5 * * * *`) selects due monitors:

- `critical` monitors run every 5 minutes.
- `standard` monitors run every 15 minutes (`minute % 15 === 0`).
- A daily cron (`15 16 * * *`, 00:15 Asia/Manila) calls `bgovph_prune_checks(30)`.
