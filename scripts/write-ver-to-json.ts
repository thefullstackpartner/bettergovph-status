import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let headCommit = 'dev';
try {
  headCommit = execSync('git rev-parse HEAD', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // Repo may not have commits yet.
}

const outPath = path.resolve('src/version.json');
fs.writeFileSync(
  outPath,
  JSON.stringify({ head_commit: headCommit }, null, 2) + '\n'
);
