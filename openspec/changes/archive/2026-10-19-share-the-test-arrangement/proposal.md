## Why

The project has no shared test arrangement: each spec declares its own builders, fixtures and fakes, and copies drift from the interface they stand in for. `docs/backlog.md` records `share-the-test-arrangement` as cheapest while the suite is small, and the first feature changes (`identity`, `metrics`) will otherwise each declare their own port fakes.

## What Changes

- Add the library `libs/shared/testing` (`@basis/shared-testing`), tagged `scope:shared` and a new `type:testing`, as the one place shared test arrangement lives.
- Add the `type:testing` row to the module-boundary configuration and let every library and app type depend on it; the library itself depends on no other workspace library.
- Keep production code from importing the library: only spec files and test configuration may, enforced by ESLint rather than by convention.
- Record the library's location under _Testing Strategy_ in `AGENTS.md` as the shared test arrangement, and add it to ADR-0012's library and tag tables.
- The library ships with no helpers: the existing specs repeat no builder, fixture or fake (the nearest, `fakeFetch` in `tools/delivery`, has one user), so nothing is moved. Arrangement enters it when a spec needs it a second time. A fake of a port stays declared in the spec that uses it, listed in that change's `test-plan.md`, until a later change decides otherwise.

## Capabilities

### New Capabilities

- `shared-testing`: where shared test arrangement lives, who may import it, and the guarantee that production code cannot.

### Modified Capabilities

None.

## Impact

- New project `libs/shared/testing`; `eslint.config.mjs` (tag constraints and a file-level import restriction); `tsconfig.json` references; `AGENTS.md` (_Testing Strategy_); `docs/adr/0012-context-structure.md` (tables); `docs/backlog.md` (entry deleted at archive).
- No runtime, API or dependency change.
