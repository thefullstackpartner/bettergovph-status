# Adding Check Types

The MVP ships with `http` checks (`functions/checks/http.ts`). To add a new check type (for example `keyword`, `tls`, `dns`, or `tcp`):

1. **Schema**: Add the new type name and any type-specific properties to `src/data/schema/monitors.schema.json`.
2. **Types**: Update `MonitorDefinition` in `functions/types.ts`.
3. **Runner**: Create `functions/checks/<type>.ts` implementing `CheckRunner`.
4. **Registry**: Register the runner in `functions/checks/index.ts`.
5. **Tests**: Add unit tests in `functions/__tests__/`.
