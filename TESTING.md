# Testing

## Test Suites

| Suite | Tool | Command | Purpose |
| --- | --- | --- | --- |
| Data validation | Ajv + JSON Schema | `npm run validate:data` | Validates `categories.json` and `monitors/**/*.json` |
| Typecheck | TypeScript | `npm run typecheck` | Checks both SPA (`tsconfig.app.json`) and Worker (`functions/tsconfig.json`) |
| Unit & Component | Vitest + Testing Library | `npm run test:unit` | Tests check runners, state machine, scheduler, monitor cross-validation, and UI components |
| SQL / DB | `psql` | `node scripts/run-local-sql.mjs supabase/tests/bgovph_record_checks.sql` | Verifies 2-strike incident logic and daily rollups in Postgres |
| End-to-End | Playwright | `npm run test:e2e` | Verifies homepage, filtering, and monitor detail navigation |
| Accessibility | Playwright + axe-core | `npm run test:a11y` | Checks WCAG 2.1 AA compliance |

## Running Everything

```bash
npm run validate:data && npm run typecheck && npm run lint && npm run test:unit && npm run build
```
