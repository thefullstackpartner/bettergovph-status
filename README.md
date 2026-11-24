# BetterGovPH Status

Source code of **BetterGovPH Status**, an edge-native uptime and performance monitor for Philippine government online portals and services — built on Cloudflare Workers and Supabase, following the design system and repository structure of [BetterGov.ph](https://github.com/bettergovph/bettergov).

## About this project

BetterGovPH Status tracks the availability and latency of critical citizen-facing portals (such as BIR, SSS, PhilHealth, Pag-IBIG, PSA, DFA, and LTO) alongside agency websites from the BetterGov.ph directory.

Goals:

- Real-time visibility into Philippine government online service availability
- Edge-native execution on Cloudflare Workers with low operational cost
- Transparent, open-source monitor definitions reviewed via pull requests
- Accessible, readable public status UI matching the BetterGov.ph design system
- Extensible check architecture ready for keyword, TLS, DNS, and TCP checks

## Features

- Tiered check intervals: **5 minutes** for the **31 curated Critical** citizen portals (`src/data/monitors/curated.json`), **15 minutes** for standard agency websites (`src/data/monitors/imported/*.json`), plus a daily cleanup cron at `16:15 UTC` (`00:15 Asia/Manila`) to prune raw checks older than 30 days
- Uptime Kuma-style 24-hour / 45-day / 90-day uptime bars with color-coded status legend (Operational, Degraded / partial outage, Probe Blocked (WAF), Down / Under Maintenance, No data) and response-time charts (`24h`, `7d`, `30d`, `90d`)
- Quick **All / Critical** tier toggle and clickable overall status filters on the homepage, plus dedicated `/about` methodology & agency allowlisting documentation
- 2-strike incident detection (1st failed check immediately marks the portal **Down** with its cause sub-status such as `Down · Timeout`, while an incident opens on 2 consecutive `down` checks and resolves on 2 consecutive non-down checks) with human-readable cause explanations
- Data-as-code monitor definitions validated by JSON Schema
- Hono-powered Cloudflare Worker API with edge-cached responses (`Cache-Control: s-maxage=60`) to absorb public traffic

### Incident causes

When a monitor fails two consecutive checks, an incident is recorded with one of the following causes (displayed with plain-English explanations in the UI):

| Code | Display Label | Explanation |
| --- | --- | --- |
| `not_found` | Page Not Found (HTTP 404) | Server responded with HTTP `404`; the monitored page may have moved or been removed. |
| `unexpected_status` / `http_<code>` | Unexpected HTTP Error | Server returned another failing HTTP status code (e.g., `5xx` or `4xx`). |
| `maintenance` | Under Maintenance | HTML response matched a maintenance notice. |
| `keyword_missing` | Expected Content Missing | Page loaded but did not contain the configured `expectedKeyword`. |
| `timeout` | Request Timed Out | Server did not respond within the check timeout window (15s default). |
| `dns` | DNS Resolution Failed | Domain name could not be resolved to an IP address. |
| `tls` | TLS / SSL Error | HTTPS connection failed due to a TLS handshake or certificate error. |
| `connect` | Connection Failed | Probe could not establish a network connection to the server. |
| `invalid_http_header` | Malformed HTTP Response | Server returned invalid HTTP headers and the socket `HEAD` fallback could not read a status line. |

## How to Run

```bash
# Install packages
npm install

# Copy local Worker secrets (already pre-configured for local Supabase)
cp .dev.vars.example .dev.vars

# Apply database migrations to local Supabase (bgovph_* objects only)
npm run db:migrate:local
```

Start the frontend and the Worker in two terminals:

```bash
# Terminal 1 — Cloudflare Worker on 127.0.0.1:5525
npm run functions:dev

# Terminal 2 — Vite SPA on http://localhost:5125 (proxies /api/* to Worker)
npm run dev
```

**Access the application at:** `http://localhost:5125`

### Triggering checks locally

Local development does not run the 5-minute cron automatically. You can trigger a check cycle manually in either of two ways:

1. Run `npm run check:trigger` for a one-off critical-tier run, `npm run check:watch` to run critical checks every 5 minutes, or `npm run check:watch:all` to also cycle through all standard-tier monitors every 15 minutes.
2. Call Wrangler's scheduled endpoint: `curl "http://127.0.0.1:5525/__scheduled?cron=*/5+*+*+*+*"`

## Monitor data

Monitor definitions live in committed JSON files validated by JSON Schema:

| File | Holds | Schema |
| --- | --- | --- |
| `src/data/categories.json` | Category taxonomy | `src/data/schema/categories.schema.json` |
| `src/data/monitors/curated.json` | High-traffic citizen portals (`critical` tier, 5m) | `src/data/schema/monitors.schema.json` |
| `src/data/monitors/imported/*.json` | Agency sites imported from BetterGov (`standard` tier, 15m) | `src/data/schema/monitors.schema.json` |

Edit them in a pull request like any other data file. Validate locally with:

```bash
npm run validate:data
```

See [the monitor data notes](src/data/monitors/README.md) for field rules, naming conventions, and agency opt-out instructions.

## Importing from BetterGov

`npm run import:websites` reads `websites.json` from [bettergovph/bettergov](https://github.com/bettergovph/bettergov), normalizes URLs to `https://`, deduplicates against `curated.json`, maps BetterGov `type` values to our categories, and writes deterministic sorted files under `src/data/monitors/imported/`.

```bash
# Refresh from GitHub
npm run import:websites

# Refresh from a local clone and probe each URL once
npm run import:websites -- --input ../bettergov/src/data/websites.json --probe
```

## Database (Supabase)

All database objects use the `bgovph_` prefix so local development can safely share a local Supabase instance without touching existing tables. Raw checks are retained for **30 days** and pruned by a daily Worker cron; daily rollups (`bgovph_daily_stats`) are kept indefinitely.

See [the Supabase notes](supabase/README.md) for local reset (`npm run db:down:local`) and staging/production setup.

## Deploying

1. Create dedicated Supabase projects for staging and production (Singapore region recommended).
2. Apply all migrations in `supabase/migrations/` (`20261124000000_bgovph_init.sql`, `20261124000001_bgovph_waf_bars.sql`) to each project.
3. Provision a Cloudflare Queue (`CHECK_QUEUE`) and add its ID to `wrangler.jsonc`.
4. Set secrets with `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`.
5. Deploy:

```bash
npm run deploy
```

## Testing

This project uses Vitest for unit/data tests and Playwright (with axe-core) for end-to-end and accessibility tests. See [the Testing Guide](./TESTING.md).

## Contributing

Contributions are welcome — new monitor proposals, URL corrections, check types, UI improvements, and documentation. Please see [the Contributing Guide](./CONTRIBUTING.md).

## Code of Conduct

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

## License

- **Code** is released under the [MIT License](./LICENSE).
- **Imported directory data** is adapted from [bettergovph/bettergov](https://github.com/bettergovph/bettergov), whose content is published under CC BY-NC-ND 4.0.
