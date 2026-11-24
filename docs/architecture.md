# Architecture

## Overview

BetterGovPH Status splits responsibilities between Cloudflare's edge and Supabase Postgres:

- **Cloudflare Worker (`functions/`)**: Runs scheduled triggers (`*/5 * * * *`), fans out batches of up to 40 monitors via Cloudflare Queues, executes HTTP(S) probes, caches `status:summary` in KV, and serves `/api/*` + static SPA assets.
- **Supabase Postgres (`supabase/`)**: Stores 30 days of raw checks (`bgovph_checks`), permanent Asia/Manila daily rollups (`bgovph_daily_stats`), 2-strike state (`bgovph_monitor_state`), and incidents (`bgovph_incidents`).

## Why a Single RPC per Batch

Each Queue consumer batch checks up to 40 monitors in parallel and then makes a single HTTPS RPC call to `bgovph_record_checks(jsonb)`. This keeps outbound subrequests per Worker invocation under the 50-subrequest free-tier limit (40 HTTP probes + 1 Supabase RPC = 41).
