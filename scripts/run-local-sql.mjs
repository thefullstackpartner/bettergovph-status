import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/run-local-sql.mjs <path-to-sql>');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');
execFileSync(
  'docker',
  ['exec', '-i', 'supabase_db_theresetclinic', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  { input: sql, stdio: ['pipe', 'inherit', 'inherit'] }
);
