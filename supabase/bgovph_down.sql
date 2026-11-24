-- Clean teardown of all bettergovph-status database objects.
-- Only drops objects prefixed with `bgovph_`.

drop function if exists public.bgovph_get_summary();
drop function if exists public.bgovph_prune_checks(integer);
drop function if exists public.bgovph_record_checks(jsonb);

drop table if exists public.bgovph_incidents;
drop table if exists public.bgovph_monitor_state;
drop table if exists public.bgovph_daily_stats;
drop table if exists public.bgovph_checks;

drop type if exists public.bgovph_check_status;
