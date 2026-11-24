-- Track WAF-blocked checks separately in daily and hourly bar rollups.

alter table public.bgovph_daily_stats
  add column if not exists waf integer not null default 0;

create or replace function public.bgovph_record_checks(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_prev public.bgovph_monitor_state%rowtype;
  v_has_prev boolean;
  v_fail integer;
  v_ok integer;
  v_incident_id bigint;
  v_day date;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    return;
  end if;

  for rec in
    select
      x.monitor_slug,
      coalesce(x.checked_at, now()) as checked_at,
      x.status::public.bgovph_check_status as status,
      x.http_status,
      x.response_ms,
      x.error,
      x.colo
    from jsonb_to_recordset(p_results) as x(
      monitor_slug text,
      checked_at timestamptz,
      status text,
      http_status smallint,
      response_ms integer,
      error text,
      colo text
    )
    where x.monitor_slug is not null
    order by coalesce(x.checked_at, now()) asc
  loop
    insert into public.bgovph_checks (
      monitor_slug, checked_at, status, http_status, response_ms, error, colo
    ) values (
      rec.monitor_slug, rec.checked_at, rec.status, rec.http_status, rec.response_ms, rec.error, rec.colo
    );

    v_day := (rec.checked_at at time zone 'Asia/Manila')::date;

    insert into public.bgovph_daily_stats (
      monitor_slug, day, total, up, degraded, waf, down, sum_ms, max_ms
    ) values (
      rec.monitor_slug,
      v_day,
      1,
      case when rec.status = 'up' then 1 else 0 end,
      case when rec.status = 'degraded' and coalesce(rec.error, '') <> 'waf_403' then 1 else 0 end,
      case when rec.status = 'degraded' and rec.error = 'waf_403' then 1 else 0 end,
      case when rec.status = 'down' then 1 else 0 end,
      coalesce(rec.response_ms, 0),
      coalesce(rec.response_ms, 0)
    )
    on conflict (monitor_slug, day) do update set
      total = bgovph_daily_stats.total + 1,
      up = bgovph_daily_stats.up + excluded.up,
      degraded = bgovph_daily_stats.degraded + excluded.degraded,
      waf = bgovph_daily_stats.waf + excluded.waf,
      down = bgovph_daily_stats.down + excluded.down,
      sum_ms = bgovph_daily_stats.sum_ms + excluded.sum_ms,
      max_ms = greatest(bgovph_daily_stats.max_ms, excluded.max_ms);

    select * into v_prev
    from public.bgovph_monitor_state
    where monitor_slug = rec.monitor_slug
    for update;

    v_has_prev := found;

    if not v_has_prev then
      v_fail := case when rec.status = 'down' then 1 else 0 end;
      v_ok := case when rec.status <> 'down' then 1 else 0 end;
      v_incident_id := null;
    else
      v_incident_id := v_prev.open_incident_id;
      if rec.status = 'down' then
        v_fail := v_prev.consecutive_fail + 1;
        v_ok := 0;
        if v_fail >= 2 and v_incident_id is null then
          insert into public.bgovph_incidents (monitor_slug, started_at, cause)
          values (
            rec.monitor_slug,
            rec.checked_at,
            coalesce(rec.error, case when rec.http_status is not null then 'http_' || rec.http_status::text else 'down' end)
          )
          returning id into v_incident_id;
        end if;
      else
        v_ok := v_prev.consecutive_ok + 1;
        v_fail := 0;
        if v_ok >= 2 and v_incident_id is not null then
          update public.bgovph_incidents
          set resolved_at = rec.checked_at
          where id = v_incident_id and resolved_at is null;
          v_incident_id := null;
        end if;
      end if;
    end if;

    insert into public.bgovph_monitor_state (
      monitor_slug, status, consecutive_fail, consecutive_ok,
      last_checked_at, last_http_status, last_response_ms, last_error, last_colo,
      open_incident_id
    ) values (
      rec.monitor_slug, rec.status, v_fail, v_ok,
      rec.checked_at, rec.http_status, rec.response_ms, rec.error, rec.colo,
      v_incident_id
    )
    on conflict (monitor_slug) do update set
      status = excluded.status,
      consecutive_fail = excluded.consecutive_fail,
      consecutive_ok = excluded.consecutive_ok,
      last_checked_at = excluded.last_checked_at,
      last_http_status = excluded.last_http_status,
      last_response_ms = excluded.last_response_ms,
      last_error = excluded.last_error,
      last_colo = excluded.last_colo,
      open_incident_id = excluded.open_incident_id;
  end loop;
end;
$$;

create or replace function public.bgovph_get_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with states as (
    select
      monitor_slug, status::text, consecutive_fail, consecutive_ok,
      last_checked_at, last_http_status, last_response_ms, last_error, last_colo,
      open_incident_id
    from public.bgovph_monitor_state
  ),
  u24 as (
    select
      monitor_slug,
      count(*)::int as total_24h,
      count(*) filter (where status <> 'down')::int as ok_24h,
      round(avg(response_ms))::int as avg_ms_24h
    from public.bgovph_checks
    where checked_at >= now() - interval '24 hours'
    group by monitor_slug
  ),
  bars as (
    select
      monitor_slug,
      jsonb_agg(
        jsonb_build_object(
          'day', to_char(day, 'YYYY-MM-DD'),
          'total', total,
          'up', up,
          'degraded', degraded,
          'waf', waf,
          'down', down,
          'avgMs', case when total > 0 then round(sum_ms::numeric / total)::int else 0 end
        )
        order by day asc
      ) as bars_90d
    from public.bgovph_daily_stats
    where day >= ((now() at time zone 'Asia/Manila')::date - 89)
    group by monitor_slug
  ),
  hourly as (
    select
      monitor_slug,
      jsonb_agg(
        jsonb_build_object(
          'hour', to_char(hour_bucket at time zone 'UTC', 'YYYY-MM-DD"T"HH24":00:00Z"'),
          'total', total,
          'up', up,
          'degraded', degraded,
          'waf', waf,
          'down', down,
          'avgMs', avg_ms
        )
        order by hour_bucket asc
      ) as hourly_24h
    from (
      select
        monitor_slug,
        date_trunc('hour', checked_at) as hour_bucket,
        count(*)::int as total,
        count(*) filter (where status = 'up')::int as up,
        count(*) filter (where status = 'degraded' and coalesce(error, '') <> 'waf_403')::int as degraded,
        count(*) filter (where status = 'degraded' and error = 'waf_403')::int as waf,
        count(*) filter (where status = 'down')::int as down,
        coalesce(round(avg(response_ms))::int, 0) as avg_ms
      from public.bgovph_checks
      where checked_at >= date_trunc('hour', now() - interval '23 hours')
      group by monitor_slug, date_trunc('hour', checked_at)
    ) h
    group by monitor_slug
  )
  select jsonb_build_object(
    'states', coalesce((select jsonb_agg(to_jsonb(states)) from states), '[]'::jsonb),
    'u24', coalesce((select jsonb_agg(to_jsonb(u24)) from u24), '[]'::jsonb),
    'bars', coalesce((select jsonb_agg(to_jsonb(bars)) from bars), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(to_jsonb(hourly)) from hourly), '[]'::jsonb),
    'openIncidents', (select count(*)::int from public.bgovph_incidents where resolved_at is null)
  );
$$;

revoke all on function public.bgovph_record_checks(jsonb) from public, anon, authenticated;
revoke all on function public.bgovph_get_summary() from public, anon, authenticated;
