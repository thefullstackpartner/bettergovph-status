-- Local verification test for bgovph_record_checks & 2-strike incident logic.
begin;

-- 1st down check: should NOT open an incident yet
select public.bgovph_record_checks('[
  {"monitor_slug":"__test_bir","checked_at":"2026-11-24T01:00:00Z","status":"down","http_status":503,"response_ms":420,"error":"unexpected_status","colo":"SIN"}
]'::jsonb);

do $$
declare v_state public.bgovph_monitor_state%rowtype;
begin
  select * into v_state from public.bgovph_monitor_state where monitor_slug = '__test_bir';
  if v_state.consecutive_fail <> 1 or v_state.open_incident_id is not null then
    raise exception 'Expected 1st fail to not open incident, got fail=%, inc=%', v_state.consecutive_fail, v_state.open_incident_id;
  end if;
end $$;

-- 2nd down check: SHOULD open an incident
select public.bgovph_record_checks('[
  {"monitor_slug":"__test_bir","checked_at":"2026-11-24T01:05:00Z","status":"down","http_status":503,"response_ms":510,"error":"unexpected_status","colo":"SIN"}
]'::jsonb);

do $$
declare v_state public.bgovph_monitor_state%rowtype;
begin
  select * into v_state from public.bgovph_monitor_state where monitor_slug = '__test_bir';
  if v_state.consecutive_fail <> 2 or v_state.open_incident_id is null then
    raise exception 'Expected 2nd fail to open incident, got fail=%, inc=%', v_state.consecutive_fail, v_state.open_incident_id;
  end if;
end $$;

-- 1st recovery check: should NOT resolve incident yet
select public.bgovph_record_checks('[
  {"monitor_slug":"__test_bir","checked_at":"2026-11-24T01:10:00Z","status":"up","http_status":200,"response_ms":180,"error":null,"colo":"SIN"}
]'::jsonb);

do $$
declare v_state public.bgovph_monitor_state%rowtype;
begin
  select * into v_state from public.bgovph_monitor_state where monitor_slug = '__test_bir';
  if v_state.consecutive_ok <> 1 or v_state.open_incident_id is null then
    raise exception 'Expected 1st ok to keep incident open, got ok=%, inc=%', v_state.consecutive_ok, v_state.open_incident_id;
  end if;
end $$;

-- 2nd recovery check: SHOULD resolve incident
select public.bgovph_record_checks('[
  {"monitor_slug":"__test_bir","checked_at":"2026-11-24T01:15:00Z","status":"up","http_status":200,"response_ms":160,"error":null,"colo":"SIN"}
]'::jsonb);

do $$
declare
  v_state public.bgovph_monitor_state%rowtype;
  v_inc_count integer;
  v_stats public.bgovph_daily_stats%rowtype;
begin
  select * into v_state from public.bgovph_monitor_state where monitor_slug = '__test_bir';
  if v_state.consecutive_ok <> 2 or v_state.open_incident_id is not null then
    raise exception 'Expected 2nd ok to resolve incident, got ok=%, inc=%', v_state.consecutive_ok, v_state.open_incident_id;
  end if;

  select count(*) into v_inc_count from public.bgovph_incidents
  where monitor_slug = '__test_bir' and resolved_at is not null;
  if v_inc_count <> 1 then
    raise exception 'Expected 1 resolved incident, got %', v_inc_count;
  end if;

  select * into v_stats from public.bgovph_daily_stats
  where monitor_slug = '__test_bir' and day = '2026-11-24';
  if v_stats.total <> 4 or v_stats.up <> 2 or v_stats.down <> 2 then
    raise exception 'Expected 4 total (2 up, 2 down), got total=%, up=%, down=%', v_stats.total, v_stats.up, v_stats.down;
  end if;
end $$;

rollback;
