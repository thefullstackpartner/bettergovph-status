const WORKER_URL = process.env.WORKER_URL ?? 'http://127.0.0.1:5525';

function parseArgs(argv: string[]) {
  let intervalSec = 300; // 5 minutes
  let includeStandard = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--interval' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n >= 10) intervalSec = n;
    } else if (argv[i] === '--all') {
      includeStandard = true;
    }
  }
  return { intervalSec, includeStandard };
}

async function triggerBatch(tier: 'critical' | 'standard', offset = 0) {
  const res = await fetch(
    `${WORKER_URL}/api/trigger?tier=${tier}&offset=${offset}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as {
    ok: boolean;
    mode: string;
    scheduledCount: number;
    totalDue: number;
    batches: number;
  };
}

async function runTick(tick: number, includeStandard: boolean) {
  const ts = new Date().toLocaleTimeString('en-PH', {
    hour12: false,
    timeZone: 'Asia/Manila',
  });

  try {
    const crit = await triggerBatch('critical', 0);
    console.log(
      `[${ts}] critical: checked ${crit.scheduledCount}/${crit.totalDue} portals (${crit.mode})`
    );

    if (includeStandard && tick % 3 === 0) {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${ts}] trigger failed (is functions:dev running?): ${msg}`);
  }
}

async function main() {
  const { intervalSec, includeStandard } = parseArgs(process.argv.slice(2));
  console.log(
    `Local check runner started (every ${intervalSec}s${includeStandard ? ', including standard tier every 3rd tick' : ', critical tier only'}). Press Ctrl+C to stop.`
  );

  let tick = 0;
  await runTick(tick++, includeStandard);

  setInterval(() => {
    void runTick(tick++, includeStandard);
  }, intervalSec * 1000);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
