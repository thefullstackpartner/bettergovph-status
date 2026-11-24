import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/bettergovph/bettergov/main/src/data/websites.json';

type BetterGovWebsite = {
  name: string;
  slug: string;
  website: string | null;
  type: string;
  parent_department: string | null;
};

type MonitorRecord = {
  slug: string;
  name: string;
  agency: string;
  department: string | null;
  category: string;
  type: 'http';
  url: string;
  tier: 'critical' | 'standard';
  method: 'GET';
  degradedMs: number;
  source: 'curated' | 'bettergov-websites';
  enabled: boolean;
};

export function mapTypeToCategory(rawType: string): string {
  switch (rawType) {
    case 'constitutional':
      return 'constitutional-sucs';
    case 'diplomatic':
    case 'foreign-service':
      return 'diplomatic';
    case 'legislative':
      return 'legislative';
    default:
      return 'executive';
  }
}

export function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `https://${parsed.hostname.toLowerCase()}${parsed.pathname === '/' ? '/' : parsed.pathname}`;
  } catch {
    return null;
  }
}

export function toTitleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
}

function parseArgs(argv: string[]) {
  let input: string | null = null;
  let probe = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) {
      input = argv[++i];
    } else if (argv[i] === '--probe') {
      probe = true;
    }
  }
  return { input, probe };
}

async function loadSource(input: string | null): Promise<BetterGovWebsite[]> {
  if (input) {
    return JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  }
  const res = await fetch(DEFAULT_SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${DEFAULT_SOURCE_URL}: ${res.status}`);
  }
  return (await res.json()) as BetterGovWebsite[];
}

async function probeUrls(records: MonitorRecord[]) {
  console.log(`Probing ${records.length} imported URLs (concurrency 15)...`);
  let idx = 0;
  let ok = 0;
  let dead = 0;
  const concurrency = 15;

  async function worker() {
    while (idx < records.length) {
      const current = records[idx++];
      try {
        const res = await fetch(current.url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });
        await res.body?.cancel();
        if (res.status < 400) ok++;
        else {
          dead++;
          console.log(`  [${res.status}] ${current.slug} -> ${current.url}`);
        }
      } catch (err) {
        dead++;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [ERR] ${current.slug} -> ${current.url} (${msg})`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`Probe complete: ${ok} reachable, ${dead} unreachable.`);
}

async function main() {
  const { input, probe } = parseArgs(process.argv.slice(2));

  const curatedPath = path.resolve('src/data/monitors/curated.json');
  const curated: MonitorRecord[] = JSON.parse(
    fs.readFileSync(curatedPath, 'utf8')
  );
  const seenHosts = new Set(curated.map(m => normalizeHost(m.url)));
  const seenSlugs = new Set(curated.map(m => m.slug));

  const rawEntries = await loadSource(input);
  const grouped = new Map<string, MonitorRecord[]>();

  for (const entry of rawEntries) {
    if (!entry.website) continue;
    const url = normalizeWebsiteUrl(entry.website);
    if (!url) continue;

    const host = normalizeHost(url);
    if (seenHosts.has(host)) continue;

    const baseSlug = entry.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!baseSlug) continue;

    let slug = baseSlug;
    let suffix = 2;
    while (seenSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    seenHosts.add(host);
    seenSlugs.add(slug);

    const category = mapTypeToCategory(entry.type);
    const agencyName = toTitleCase(entry.name);
    const record: MonitorRecord = {
      slug,
      name: agencyName,
      agency: agencyName,
      department: entry.parent_department
        ? toTitleCase(entry.parent_department)
        : null,
      category,
      type: 'http',
      url,
      tier: 'standard',
      method: 'GET',
      degradedMs: 3000,
      source: 'bettergov-websites',
      enabled: true,
    };

    const list = grouped.get(category) ?? [];
    list.push(record);
    grouped.set(category, list);
  }

  const schema = JSON.parse(
    fs.readFileSync(
      path.resolve('src/data/schema/monitors.schema.json'),
      'utf8'
    )
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const allImported: MonitorRecord[] = [];
  for (const [category, records] of grouped.entries()) {
    records.sort((a, b) => a.slug.localeCompare(b.slug));
    if (!validate(records)) {
      throw new Error(
        `Validation failed for ${category}: ${ajv.errorsText(validate.errors)}`
      );
    }
    allImported.push(...records);
  }

  const outDir = path.resolve('src/data/monitors/imported');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [category, records] of [...grouped.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const outFile = path.join(outDir, `${category}.json`);
    fs.writeFileSync(outFile, JSON.stringify(records, null, 2) + '\n');
    console.log(`Wrote ${records.length} monitors -> ${outFile}`);
  }

  console.log(`Total imported monitors: ${allImported.length}`);
  if (probe) {
    await probeUrls(allImported);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('import-bettergov-websites.ts');
if (isMain) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
