-- Dashboard aggregation RPC and 1-year daily stats retention pruning.
-- Every object uses the `bgovph_` prefix.

create index if not exists bgovph_daily_stats_day_idx
  on public.bgovph_daily_stats (day desc, monitor_slug);

-- Returns pre-aggregated per-monitor totals, daily network trends, and incident
-- stats for the requested window (clamped to 1..365 days).
create or replace function public.bgovph_get_dashboard(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      least(greatest(coalesce(p_days, 30), 1), 365) as days,
      ((now() at time zone 'Asia/Manila')::date - (least(greatest(coalesce(p_days, 30), 1), 365) - 1)) as since_day,
      (now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))) as since_ts
  ),
  monitors as (
    select
      d.monitor_slug,
      sum(d.total)::bigint as total,
      sum(d.up)::bigint as up,
      sum(d.degraded)::bigint as degraded,
      sum(d.waf)::bigint as waf,
      sum(d.down)::bigint as down,
      sum(d.sum_ms)::bigint as sum_ms,
      max(d.max_ms)::integer as max_ms
    from public.bgovph_daily_stats d
    cross join bounds b
    where d.day >= b.since_day
    group by d.monitor_slug
  ),
  daily as (
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      sum(d.total)::bigint as total,
      sum(d.up)::bigint as up,
      sum(d.degraded)::bigint as degraded,
      sum(d.waf)::bigint as waf,
      sum(d.down)::bigint as down,
      case
        when sum(d.total) > 0 then round(sum(d.sum_ms)::numeric / sum(d.total))::integer
        else 0
      end as avg_ms
    from public.bgovph_daily_stats d
    cross join bounds b
    where d.day >= b.since_day
    group by d.day
    order by d.day asc
  ),
  window_incidents as (
    select
      i.monitor_slug,
      i.started_at,
      i.resolved_at,
      coalesce(nullif(trim(i.cause), ''), 'unknown') as cause
    from public.bgovph_incidents i
    cross join bounds b
    where i.started_at >= b.since_ts
  ),
  incident_summary as (
    select
      count(*)::integer as total_incidents,
      count(*) filter (where resolved_at is null)::integer as open_incidents,
      round(
        avg(extract(epoch from (resolved_at - started_at)))
        filter (where resolved_at is not null and resolved_at >= started_at)
      )::integer as avg_resolution_sec
    from window_incidents
  ),
  incidents_by_monitor as (
    select
      monitor_slug,
      count(*)::integer as count
    from window_incidents
    group by monitor_slug
  ),
  top_causes as (
    select
      cause,
      count(*)::integer as count
    from window_incidents
    group by cause
    order by count(*) desc, cause asc
    limit 10
  )
  select jsonb_build_object(
    'days', (select days from bounds),
    'monitors', coalesce((select jsonb_agg(to_jsonb(monitors)) from monitors), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily)) from daily), '[]'::jsonb),
    'incidents', jsonb_build_object(
      'totalIncidents', (select total_incidents from incident_summary),
      'openIncidents', (select open_incidents from incident_summary),
      'avgResolutionSec', (select avg_resolution_sec from incident_summary),
      'byMonitor', coalesce((select jsonb_agg(to_jsonb(incidents_by_monitor)) from incidents_by_monitor), '[]'::jsonb),
      'topCauses', coalesce((select jsonb_agg(to_jsonb(top_causes)) from top_causes), '[]'::jsonb)
    )
  );
$$;

-- Prunes daily rollup stats older than p_days (default 365). Called by the Worker's daily cron.
create or replace function public.bgovph_prune_daily_stats(p_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.bgovph_daily_stats
  where day < ((now() at time zone 'Asia/Manila')::date - greatest(p_days, 1));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.bgovph_get_dashboard(integer) from public, anon, authenticated;
revoke all on function public.bgovph_prune_daily_stats(integer) from public, anon, authenticated;
