# Handling WAF-Blocked Portals (`waf_403`) & Allowlisting

Some Philippine government portals (e.g., `https://orus.bir.gov.ph/` behind `awselb/2.0`) return `HTTP 403 Forbidden` to automated `fetch` probes even when they work normally in a browser.

## Current Behavior

- Probes send an honest `User-Agent` (`bettergovph-status/1.0 (+https://bettergovph-status.workers.dev/about)`) defined in `functions/lib/scheduler.ts` and read at most 16 KB of HTML (`functions/checks/http.ts`).
- When a portal responds with `403`, `httpCheck` classifies it as `status: 'degraded'` with `error: 'waf_403'` rather than `down`, and the UI / agent surfaces (`/llms.txt`, `/status.md`) note that the portal may still work in a browser.
- We do **not** spoof browser `User-Agent`s, TLS fingerprints, or bypass WAF/anti-bot challenges.

## Why Shared Cloudflare Worker IPs Can't Be Allowlisted Directly

Because checks run from Cloudflare Workers, outbound `fetch()` requests egress from Cloudflare's shared global edge IP pool. Those IPs rotate and are shared with many other Cloudflare tenants, so an agency cannot safely allowlist them by IP.

## Ethical & Legal Options for Allowlisting

### 1. Shared-Secret Header in AWS WAF (Simplest, No Extra Infra)

Ask the agency's IT/WAF team to add a rate-limited WAF rule that allows requests matching both:

- `User-Agent`: `bettergovph-status/1.0 (+https://bettergovph-status.workers.dev/about)`
- A shared secret header, e.g., `X-Bgovph-Monitor: <secret-token>`
- Scoped to `GET /` (or a dedicated path) with a tight rate limit (e.g., 10 requests per 5 minutes).

Store the token as a Cloudflare Worker secret (`wrangler secret put`) and attach it only to that monitor's origin.

- **Pros:** Works directly from Cloudflare Workers' shared edge IPs with zero extra infrastructure.
- **Cons:** Requires the agency's WAF admin to configure a custom header rule.

### 2. Small Static-IP Egress Proxy / Runner (Best When Agencies Only Allowlist IPs)

Many government IT teams only support IP-based allowlists.

- Keep the Cloudflare Worker as the scheduler, API, and dashboard.
- Route probes (or only probes for WAF-strict portals) through a tiny dedicated VM/proxy with a **static IPv4/IPv6** (ideally hosted in Manila or Singapore).
- Authenticate Worker → proxy requests (e.g., bearer token or mTLS) so it is not an open proxy, and give the agency that single static IP to allowlist.

- **Pros:** Standard IP allowlist for the agency; a Manila-hosted runner also reflects real Philippine citizen latency and avoids geo-blocks.
- **Cons:** Adds a small piece of infrastructure to maintain and secure.

### 3. Dedicated Un-blocked `/health` Endpoint

Ask the agency to expose (or exempt from strict bot rules) a lightweight, read-only `/health` or `/status` endpoint—or `/robots.txt`—that returns `200 OK` without touching sensitive application routes.

- **Pros:** Works from any Cloudflare Worker IP with no secrets or proxies.
- **Cons:** Verifies edge/service reachability rather than the full portal landing page (still a clear improvement over `waf_403`).

### 4. Mutual TLS (mTLS)

Cloudflare Workers support client certificates on outbound `fetch()`, and AWS ALB supports mTLS, allowing the Worker to authenticate cryptographically regardless of egress IP.

- **Pros:** Strong cryptographic authentication without static IPs.
- **Cons:** More operational setup than most agency IT teams want to maintain compared to Option 1 or Option 2.
