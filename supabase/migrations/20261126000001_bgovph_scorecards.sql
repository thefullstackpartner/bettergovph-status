-- Agency & monitor reliability scorecards RPC (availability, incidents, MTTR).
-- Every object uses the `bgovph_` prefix.

create or replace function public.bgovph_get_scorecards(p_days integer default 30)
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
  monitor_stats as (
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
  incident_stats as (
    select
      i.monitor_slug,
      count(*)::integer as incident_count,
      count(*) filter (where i.resolved_at is null)::integer as open_incidents,
      round(
        avg(extract(epoch from (i.resolved_at - i.started_at)))
        filter (where i.resolved_at is not null and i.resolved_at >= i.started_at)
      )::integer as mttr_sec
    from public.bgovph_incidents i
    cross join bounds b
    where i.started_at >= b.since_ts
    group by i.monitor_slug
  )
  select jsonb_build_object(
    'days', (select days from bounds),
    'monitors', coalesce((select jsonb_agg(to_jsonb(monitor_stats)) from monitor_stats), '[]'::jsonb),
    'incidents', coalesce((select jsonb_agg(to_jsonb(incident_stats)) from incident_stats), '[]'::jsonb)
  );
$$;
