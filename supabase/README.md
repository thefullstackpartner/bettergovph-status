# Supabase Setup

## Prefix Convention

Every database object in this project uses the `bgovph_` prefix:

- Enum: `bgovph_check_status`
- Tables: `bgovph_checks`, `bgovph_daily_stats`, `bgovph_monitor_state`, `bgovph_incidents`
- Functions: `bgovph_record_checks`, `bgovph_prune_checks`, `bgovph_get_summary`

## Local Development

```bash
# Apply schema to local Supabase (bgovph_* objects only)
npm run db:migrate:local

# Run SQL verification test
node scripts/run-local-sql.mjs supabase/tests/bgovph_record_checks.sql

# Cleanly remove all bgovph_* objects without affecting other tables
npm run db:down:local
```

## Staging & Production

1. Create a dedicated free Supabase project in Singapore (`ap-southeast-1`).
2. Run `supabase/migrations/20261124000000_bgovph_init.sql` in the SQL Editor or via `supabase db push`.
3. Copy the Project URL and Service Role Key into Cloudflare Worker secrets.
