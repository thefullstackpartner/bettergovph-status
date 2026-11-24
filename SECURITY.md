# Security Policy

## Reporting a Vulnerability

If you discover a security issue in BetterGovPH Status (for example, exposed secrets, SSRF/redirect issues in probe runners, or API rate-limit bypasses), please report it privately to the maintainers rather than opening a public issue.

## Scope & Operational Boundaries

- All public API endpoints are read-only `GET` routes (except `POST /api/trigger`, which is disabled in production unless a `TRIGGER_SECRET` is configured).
- Supabase service role keys live exclusively in Worker secrets (`wrangler secret put`) and `.dev.vars` (gitignored), never in frontend code.
- Row Level Security (RLS) is enabled on all `bgovph_*` tables with no public policies.
