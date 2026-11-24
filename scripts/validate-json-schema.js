import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { glob } from 'glob';

const [, , schemaPath, pattern] = process.argv;

if (!schemaPath || !pattern) {
  console.error(
    'Usage: node scripts/validate-json-schema.js <schema.json> "<glob>"'
  );
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync(path.resolve(schemaPath), 'utf8'));
const validate = ajv.compile(schema);

const files = await glob(pattern, { windowsPathsNoEscape: true });
if (files.length === 0) {
  console.error(`No files matched pattern: ${pattern}`);
  process.exit(1);
}

let hasError = false;
for (const file of files.sort()) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ok = validate(data);
  if (!ok) {
    hasError = true;
    console.error(`FAIL ${file}`);
    console.error(ajv.errorsText(validate.errors, { separator: '\n  ' }));
  } else {
    console.log(`OK   ${file}`);
  }
}

if (hasError) process.exit(1);
