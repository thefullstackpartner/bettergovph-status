const WORKER_URL = process.env.WORKER_URL ?? 'http://127.0.0.1:5525';

function parseArgs(argv: string[]) {
  let intervalSec = 300; // 5 minutes
  let includeStandard = false;
  let includeFreshness = false;
  let freshnessOnly = false;
  let once = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--interval' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n >= 10) intervalSec = n;
    } else if (argv[i] === '--all') {
      includeStandard = true;
    } else if (argv[i] === '--freshness') {
      includeFreshness = true;
    } else if (argv[i] === '--freshness-only') {
      freshnessOnly = true;
      includeFreshness = true;
    } else if (argv[i] === '--once') {
      once = true;
    }
  }
  return { intervalSec, includeStandard, includeFreshness, freshnessOnly, once };
}

interface TriggerResponse {
  ok: boolean;
  mode: string;
  scheduledCount: number;
  totalDue: number;
  batches: number;
}

async function triggerEndpoint(pathAndQuery: string): Promise<TriggerResponse> {
  const headers: Record<string, string> = {};
  if (process.env.TRIGGER_SECRET) {
    headers.Authorization = `Bearer ${process.env.TRIGGER_SECRET}`;
  }
  const res = await fetch(`${WORKER_URL}${pathAndQuery}`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as TriggerResponse;
}

async function triggerBatch(tier: 'critical' | 'standard', offset = 0) {
  return triggerEndpoint(`/api/trigger?tier=${tier}&offset=${offset}`);
}

async function triggerFreshnessAll(ts: string) {
  let offset = 0;
  let total = 1;
  while (offset < total) {
    const res = await triggerEndpoint(`/api/trigger?kind=freshness&offset=${offset}`);
    total = res.totalDue;
    if (res.scheduledCount === 0) break;
    offset += res.scheduledCount;
    console.log(`[${ts}] freshness: checked ${offset}/${total} portals (${res.mode})`);
  }
}

async function runTick(
  tick: number,
  opts: {
    includeStandard: boolean;
    includeFreshness: boolean;
    freshnessOnly: boolean;
  }
) {
  const ts = new Date().toLocaleTimeString('en-PH', {
    hour12: false,
    timeZone: 'Asia/Manila',
  });

  try {
    if (!opts.freshnessOnly) {
      const crit = await triggerBatch('critical', 0);
      console.log(
        `[${ts}] critical: checked ${crit.scheduledCount}/${crit.totalDue} portals (${crit.mode})`
      );

      if (opts.includeStandard && tick % 3 === 0) {
        let offset = 0;
        let total = 1;
        while (offset < total) {
          const std = await triggerBatch('standard', offset);
          total = std.totalDue;
          if (std.scheduledCount === 0) break;
          offset += std.scheduledCount;
          console.log(
            `[${ts}] standard: checked ${offset}/${total} portals`
          );
        }
      }
    }

    // Run freshness every tick in freshness-only mode, or every 6h (72 ticks @ 5m) alongside uptime.
    if (opts.includeFreshness && (opts.freshnessOnly || tick % 72 === 0)) {
      await triggerFreshnessAll(ts);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${ts}] trigger failed (is functions:dev running?): ${msg}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    opts.freshnessOnly
      ? `Local freshness runner started (${opts.once ? 'single run' : `every ${opts.intervalSec}s`}).`
      : `Local check runner started (every ${opts.intervalSec}s${opts.includeStandard ? ', including standard tier every 3rd tick' : ', critical tier only'}${opts.includeFreshness ? ', + freshness' : ''}). Press Ctrl+C to stop.`
  );

  let tick = 0;
  await runTick(tick++, opts);

  if (opts.once) return;

  setInterval(() => {
    void runTick(tick++, opts);
  }, opts.intervalSec * 1000);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
