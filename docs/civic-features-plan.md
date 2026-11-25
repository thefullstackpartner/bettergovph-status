# Civic & Reliability Features Implementation Plan

A phased implementation plan for features proven by international government/civic status monitors (UK `GOV.UK`, US GSA `Site Scanning` / `Pulse`, Singapore `WOGAA` / `Singpass`, Estonia `RIA`), tailored to BetterGovPH Status's Cloudflare Workers + Supabase architecture.

> **Tracking:** Mark each task `- [x]` as it is completed and verified with `npm run typecheck && npm run lint && npm run test:unit` (plus `npm run validate:data` when `src/data` changes).

---

## Phase 1 — Quick Wins (Fits Current Worker + Supabase Stack)

### 1.1 RSS / Atom Incident & Monitor Feeds
Enable citizens, journalists, and agency IT teams to subscribe to outages without polling.

- [x] Add `functions/agent/feeds.ts` to render valid RSS 2.0 / Atom XML for global incidents (`/incidents.rss`) and per-monitor incidents (`/api/monitors/:slug/feed.xml`) using `getSiteUrl(c)`
- [x] Mount `/incidents.rss` and `/api/monitors/:slug/feed.xml` in `functions/index.ts` with edge caching (`Cache-Control: s-maxage=60`)
- [x] Update `functions/agent/openapi.ts` and `functions/agent/llms.ts` to document the new feed endpoints
- [x] Update `run_worker_first` in `wrangler.jsonc` and the dev proxy in `vite.config.ts` for `/incidents.rss`
- [x] Add RSS feed link tags (`<link rel="alternate" type="application/rss+xml" ...>`) and subscribe buttons on `/incidents` and `/monitors/:slug`
- [x] Add unit tests in `functions/__tests__/` verifying valid XML output, escaping, and empty-incident handling

### 1.2 Planned Maintenance Windows (Data-as-Code)
Distinguish scheduled agency maintenance from unplanned outages so SLA metrics stay accurate.

- [x] Create `src/data/schema/maintenance.schema.json` and `src/data/maintenance.json` for declaring scheduled maintenance windows (`slug`, `title`, `startAt`, `endAt`, `impact`, optional `sourceUrl`)
- [x] Update `npm run validate:data` script to validate `src/data/maintenance.json` against its JSON Schema
- [x] Update `functions/lib/snapshot.ts` and `functions/lib/scheduler.ts` so checks during an active maintenance window report `maintenance_scheduled` (and avoid opening unplanned outage incidents)
- [x] Display an active/upcoming **Scheduled Maintenance** banner and badge in the SPA (`Home`, `MonitorDetail`, `Incidents`)
- [x] Document maintenance PR format in `src/data/monitors/README.md`
- [x] Add unit tests covering active, upcoming, and expired maintenance windows

### 1.3 Agency Reliability Scorecards & CSV/JSON Exports
Turn existing 365-day `bgovph_daily_stats` data into actionable public accountability reports.

- [ ] Add a Supabase RPC migration (`supabase/migrations/*_bgovph_scorecards.sql`) computing per-monitor and per-category monthly/quarterly metrics: Uptime %, Incident Count, Mean Time to Recovery (MTTR), and Freshness compliance
- [ ] Add `GET /api/scorecards` (with `?period=30d|90d|month` and `?format=json|csv`) in `functions/api/scorecards.ts`, edge-cached
- [ ] Update `functions/agent/openapi.ts` and `functions/agent/llms.ts` with the `/api/scorecards` contract
- [ ] Build a `/scorecards` (or `/reports`) page in `src/pages/` using existing `src/components/ui` components, with agency/category rankings and one-click CSV/JSON download
- [ ] Add unit tests for MTTR calculation, CSV serialization, and migration `bgovph_` naming compliance

---

## Phase 2 — High-Impact Citizen & Agency Engagement

### 2.1 Crowdsourced Citizen Issue Reports ("Is it broken for you?")
Catch functional failures (broken login, OTP, appointment booking, payment) when the homepage still returns `200 OK`.

- [ ] Add `bgovph_citizen_reports` table and rate-limited insert/aggregation RPCs in `supabase/migrations/` (storing only `slug`, `category`, `created_at`, and hashed IP/bucket—no PII)
- [ ] Add `POST /api/monitors/:slug/report` (with strict per-IP/per-slug rate limiting and Turnstile/origin validation via `functions/lib/request-security.ts`)
- [ ] Include recent 1h/24h citizen report counts in `GET /api/monitors/:slug` and `functions/lib/snapshot.ts`
- [ ] Add an anonymous **"Report an issue"** modal/widget on `/monitors/:slug` (`Can't log in`, `Form/Payment error`, `Very slow`, `Down for me`) and show a subtle warning badge when reports spike
- [ ] Add daily cleanup of old raw citizen reports (>30d) in `functions/index.ts` `scheduled` prune job
- [ ] Update `functions/agent/openapi.ts` and add unit tests for rate limiting and report aggregation

### 2.2 Webhook, Telegram, Discord & Email Incident Notifications
Notify subscribed agency IT teams and civic watchers as soon as an incident opens or resolves.

- [ ] Add `bgovph_subscriptions` and `bgovph_notification_log` tables in `supabase/migrations/` (supporting webhook URLs, Discord/Slack/Telegram targets, and verified email targets, scoped by `all`, `critical`, or specific `slug`s)
- [ ] Build a lightweight notification dispatcher (`functions/lib/notifications.ts`) invoked when `processBatch` opens or resolves an incident (respecting Worker 50-subrequest limits via Queue or `ctx.waitUntil`)
- [ ] Add management endpoints (e.g., `POST /api/subscriptions`, `DELETE /api/subscriptions/:token`) with email/webhook verification and secret-safe handling
- [ ] Add a **Subscribe to Alerts** drawer/page in the SPA for choosing portals and notification channels
- [ ] Add unit tests for payload formatting, retry/deduplication guards, and signature/token validation

---

## Phase 3 — Deep Infrastructure & Multi-Vantage Probes

### 3.1 SSL/TLS Certificate Expiry & Transport Security Hygiene
Catch expiring certificates and broken HTTPS redirects *before* they cause a full outage.

- [ ] Design a lightweight TLS/security metadata check (either via a scheduled GitHub Action / external Node probe pushing to a secured `POST /api/ingest/security` endpoint, since Cloudflare Workers `fetch()` does not expose raw peer certificate expiry dates)
- [ ] Add `bgovph_security_posture` table in `supabase/migrations/` storing `tls_expires_at`, `https_redirect_ok`, `hsts_enabled`, and `checked_at`
- [ ] Surface expiring-soon warnings (<30d, <14d, <7d) on `/monitors/:slug` and `/dashboard` Watchlist
- [ ] Update `functions/agent/openapi.ts` and `functions/agent/llms.ts` for any new public read fields
- [ ] Add unit tests for expiry threshold classification and ingest payload validation

### 3.2 Multi-Vantage / Domestic PH ISP Reachability Probe
Distinguish *"Down for everyone"* from *"WAF blocking Cloudflare"* or *"Geo-blocked for overseas Filipinos"*.

- [ ] Add a `vantage` column (e.g., `cloudflare-edge`, `ph-domestic`) to `bgovph_checks` via `supabase/migrations/` (defaulting to `cloudflare-edge` for existing rows)
- [ ] Add a secured ingest endpoint (`POST /api/ingest/vantage`) authenticated with a dedicated secret (matching `POST /api/trigger` security standards)
- [ ] Deploy a scheduled lightweight secondary probe from a domestic PH network / non-Cloudflare runner for `waf_blocked` and `critical` portals
- [ ] Update `functions/lib/snapshot.ts` and monitor status badges to surface dual-vantage state (e.g., *"Reachable in PH · Blocked from Edge"* or *"Down for Overseas Users"*)
- [ ] Add unit tests for dual-vantage status reconciliation in `functions/__tests__/`
