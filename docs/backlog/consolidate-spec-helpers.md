---
kind: fix
waits_on: []
design_with: []
workstream: none
recorded_by: add-api-cross-cutting-basics
re_checked: 2026-11-08
---

Several spec helpers are copied between test files because no change has moved them into the shared test arrangement: linting a virtual source against the root ESLint config, reading a manifest's runtime dependencies, reading Nx's view of a project, checking that nothing listens at an address, a capturing Nest logger, capturing standard output, running the migration process, running the rendering command (`tools/delivery`), parsing the built API's JSON log lines, a fake HTTP host for `ProblemFilter`, a valid HC Webhook delivery or JSON object of a given size, rows from a query, and starting the built API (`apps/api-e2e/src/database-startup.spec.ts` keeps its own copy of `apps/api-e2e/src/support/api-process.ts`'s `startApi`). Move each into `libs/shared/testing` (generic; it may take `eslint` as a dependency) or `apps/api-e2e/src/support/`, and move the specs onto it, changing only where they take their arrangement from. It may be taken one helper family at a time.

- **Kind**: It moves test arrangement, owes no specification delta and needs no decision, though it touches specs of several archived changes.
- **Recorded by**: `add-api-cross-cutting-basics`, whose derived tests added the second or third copy of each; moving the existing copies edits other changes' tests, outside its scope.
