-- Content freshness tracking for monitored portals.
-- Note: freshness status (fresh / stale / unknown) is NOT stored in the database;
-- it is calculated dynamically at read time against the configured threshold.

create table if not exists public.bgovph_freshness_state (
  monitor_slug text primary key,
  signal_source text,
  content_updated_at timestamptz,
  last_changed_at timestamptz,
  last_checked_at timestamptz,
  content_hash text,
  etag text,
  http_last_modified timestamptz,
  change_count_30d integer not null default 0,
  change_count_90d integer not null default 0,
  probe_error text
);

create table if not exists public.bgovph_freshness_events (
  id bigint generated always as identity primary key,
  monitor_slug text not null,
  detected_at timestamptz not null default now(),
  signal_source text not null,
  content_updated_at timestamptz,
  content_hash text
);

create index if not exists bgovph_freshness_events_slug_time
  on public.bgovph_freshness_events (monitor_slug, detected_at desc);

create or replace function public.bgovph_record_freshness(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_prev public.bgovph_freshness_state%rowtype;
  v_has_prev boolean;
  v_changed boolean;
  v_last_changed_at timestamptz;
  v_content_updated_at timestamptz;
  v_content_hash text;
  v_etag text;
  v_http_last_mod timestamptz;
  v_signal_source text;
  v_c30 integer;
  v_c90 integer;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    return;
  end if;

  for rec in
    select
      x.monitor_slug,
      coalesce(x.checked_at, now()) as checked_at,
      x.signal_source,
      x.content_updated_at,
      x.content_hash,
      x.etag,
      x.http_last_modified,
      x.probe_error
    from jsonb_to_recordset(p_results) as x(
      monitor_slug text,
      checked_at timestamptz,
      signal_source text,
      content_updated_at timestamptz,
      content_hash text,
      etag text,
      http_last_modified timestamptz,
      probe_error text
    )
    where x.monitor_slug is not null
    order by coalesce(x.checked_at, now()) asc
  loop
    select * into v_prev
    from public.bgovph_freshness_state
    where monitor_slug = rec.monitor_slug
    for update;

    v_has_prev := found;

    if rec.probe_error is not null then
      -- Preserve last known freshness signals on transient probe errors (e.g. WAF 403 / timeout).
      if v_has_prev then
        update public.bgovph_freshness_state
        set
          last_checked_at = rec.checked_at,
          probe_error = rec.probe_error
        where monitor_slug = rec.monitor_slug;
      else
        insert into public.bgovph_freshness_state (
          monitor_slug, last_checked_at, probe_error
        ) values (
          rec.monitor_slug, rec.checked_at, rec.probe_error
        );
      end if;
      continue;
    end if;

    v_changed := false;
    if not v_has_prev then
      if rec.content_hash is not null or rec.content_updated_at is not null then
        v_changed := true;
      end if;
    else
      if rec.content_hash is not null and rec.content_hash is distinct from v_prev.content_hash then
        v_changed := true;
      elsif rec.content_updated_at is not null and (
        v_prev.content_updated_at is null or rec.content_updated_at > v_prev.content_updated_at
      ) then
        v_changed := true;
      end if;
    end if;

    if v_changed then
      insert into public.bgovph_freshness_events (
        monitor_slug, detected_at, signal_source, content_updated_at, content_hash
      ) values (
        rec.monitor_slug,
        rec.checked_at,
        coalesce(rec.signal_source, 'content_hash'),
        rec.content_updated_at,
        rec.content_hash
      );
      v_last_changed_at := rec.checked_at;
    else
      v_last_changed_at := case when v_has_prev then v_prev.last_changed_at else null end;
    end if;

    select
      count(*) filter (where detected_at >= now() - interval '30 days')::int,
      count(*) filter (where detected_at >= now() - interval '90 days')::int
    into v_c30, v_c90
    from public.bgovph_freshness_events
    where monitor_slug = rec.monitor_slug;

    v_signal_source := coalesce(rec.signal_source, case when v_has_prev then v_prev.signal_source else null end);
    v_content_updated_at := coalesce(rec.content_updated_at, case when v_has_prev then v_prev.content_updated_at else null end);
    v_content_hash := coalesce(rec.content_hash, case when v_has_prev then v_prev.content_hash else null end);
    v_etag := coalesce(rec.etag, case when v_has_prev then v_prev.etag else null end);
    v_http_last_mod := coalesce(rec.http_last_modified, case when v_has_prev then v_prev.http_last_modified else null end);

    insert into public.bgovph_freshness_state (
      monitor_slug, signal_source, content_updated_at, last_changed_at, last_checked_at,
      content_hash, etag, http_last_modified, change_count_30d, change_count_90d, probe_error
    ) values (
      rec.monitor_slug, v_signal_source, v_content_updated_at, v_last_changed_at, rec.checked_at,
      v_content_hash, v_etag, v_http_last_mod, coalesce(v_c30, 0), coalesce(v_c90, 0), null
    )
    on conflict (monitor_slug) do update set
      signal_source = excluded.signal_source,
      content_updated_at = excluded.content_updated_at,
      last_changed_at = excluded.last_changed_at,
      last_checked_at = excluded.last_checked_at,
      content_hash = excluded.content_hash,
      etag = excluded.etag,
      http_last_modified = excluded.http_last_modified,
      change_count_30d = excluded.change_count_30d,
      change_count_90d = excluded.change_count_90d,
      probe_error = null;
  end loop;
end;
$$;

create or replace function public.bgovph_prune_freshness_events(p_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.bgovph_freshness_events
  where detected_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics v_deleted = row_count;
  return v_deleted;
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
  ),
  freshness as (
    select
      monitor_slug,
      signal_source,
      content_updated_at,
      last_changed_at,
      last_checked_at,
      change_count_30d,
      change_count_90d,
      probe_error
    from public.bgovph_freshness_state
  )
  select jsonb_build_object(
    'states', coalesce((select jsonb_agg(to_jsonb(states)) from states), '[]'::jsonb),
    'u24', coalesce((select jsonb_agg(to_jsonb(u24)) from u24), '[]'::jsonb),
    'bars', coalesce((select jsonb_agg(to_jsonb(bars)) from bars), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(to_jsonb(hourly)) from hourly), '[]'::jsonb),
    'freshness', coalesce((select jsonb_agg(to_jsonb(freshness)) from freshness), '[]'::jsonb),
    'openIncidents', (select count(*)::int from public.bgovph_incidents where resolved_at is null)
  );
$$;

alter table public.bgovph_freshness_state enable row level security;
alter table public.bgovph_freshness_events enable row level security;

revoke all on function public.bgovph_record_freshness(jsonb) from public, anon, authenticated;
revoke all on function public.bgovph_prune_freshness_events(integer) from public, anon, authenticated;
revoke all on function public.bgovph_get_summary() from public, anon, authenticated;
