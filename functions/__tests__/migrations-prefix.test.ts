import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('supabase migration bgovph_ prefix guard', () => {
  it('only creates, alters, or drops objects prefixed with bgovph_', () => {
    const migrationsDir = path.resolve('supabase/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);

    const ddlPattern =
      /^\s*(?:create(?:\s+or\s+replace)?|alter|drop)\s+(?:table|type|index|function|view)\s+(?:if\s+(?:not\s+)?exists\s+)?(?:public\.)?([a-z0-9_]+)/gim;

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      for (const match of sql.matchAll(ddlPattern)) {
        const objectName = match[1];
        expect(
          objectName.startsWith('bgovph_'),
          `Non-prefixed DDL target "${objectName}" in ${file}`
        ).toBe(true);
      }
    }
  });
});
