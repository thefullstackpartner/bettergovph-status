import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allMonitors, categories } from '../lib/monitors';

describe('monitor data cross-validation', () => {
  it('has unique monitor slugs across all files', () => {
    const seen = new Set<string>();
    for (const m of allMonitors) {
      expect(seen.has(m.slug), `Duplicate slug: ${m.slug}`).toBe(false);
      seen.add(m.slug);
    }
  });

  it('has unique normalized hostnames across all monitors', () => {
    const seen = new Set<string>();
    for (const m of allMonitors) {
      const host = new URL(m.url).hostname.toLowerCase().replace(/^www\./, '');
      expect(seen.has(host), `Duplicate host: ${host}`).toBe(false);
      seen.add(host);
    }
  });

  it('references only valid categories', () => {
    const valid = new Set(categories.map(c => c.slug));
    for (const m of allMonitors) {
      expect(valid.has(m.category), `Unknown category: ${m.category}`).toBe(
        true
      );
    }
  });

  it('keeps imported filenames aligned with their category', () => {
    const dir = path.resolve('src/data/monitors/imported');
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const expectedCategory = file.replace(/\.json$/, '');
      const items = JSON.parse(
        fs.readFileSync(path.join(dir, file), 'utf8')
      ) as Array<{ category: string }>;
      for (const item of items) {
        expect(item.category).toBe(expectedCategory);
      }
    }
  });
});
