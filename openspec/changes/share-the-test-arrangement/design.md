## Context

`AGENTS.md` records the shared test arrangement as none, and `docs/backlog.md`'s `share-the-test-arrangement` leaves the location to the operator. `eslint.config.mjs` holds the tag table of ADR-0012 §7 as `depConstraints`, applied to every file, plus a variant without external-import bans for test and configuration files. No spec today repeats a builder, fixture or fake; `fakeFetch` in `tools/delivery/src/await-version.spec.ts` is the only fake and has one user.

## Goals / Non-Goals

**Goals:**

- One recorded home for shared arrangement, usable by the specs of every library and app, unusable by production code.
- The boundary enforced by lint, so it fails in CI rather than in review.

**Non-Goals:**

- Writing builders, fakes or fixtures nothing uses yet; each arrives with the first second user.
- Per-context testing libraries and shared fakes of application ports; a port's fake stays in the spec that uses it until a change decides where such fakes live.
- Use by `tools/*` specs; tools stay outside the tag table's reach, and their one fake has one user.
- Testcontainers helpers for integration tests; they arrive with the first database change.
- Changing the `test` target, runners or the test-path glob.

## Decisions

1. **Location: `libs/shared/testing`, tags `scope:shared` and `type:testing`.** It matches the backlog's example and the existing `libs/shared/*` layout. Alternatives: a `tools/testing` project (tooling may depend on nothing, but specs must depend on this), and a top-level `testing/` directory (not an Nx project, so no boundary rules apply to it).
2. **`type:testing` is a new tag, not `type:util`.** A `type:util` library is legal for production code; only a distinct tag can be restricted.
3. **Tags are per-project, so the production/test split is a file-level rule.** `@nx/enforce-module-boundaries` cannot tell a spec from a source file in the same project. Every library and app type's row therefore lists `type:testing` among its allowed dependencies, and a `no-restricted-imports` block bans `@basis/shared-testing` in every file except `**/*.spec.{ts,tsx}`, `**/tests/**`, and the `vitest.config.*`, `vite.config.*` and `eslint.config.*` files.
4. **The `type:testing` row depends on nothing** (`onlyDependOnLibsWithTags: []`). Every library type may import it from a spec, so any dependency of it on a workspace library closes a project cycle that `@nx/enforce-module-boundaries` reports (a `shared-core` spec importing testing, testing importing `shared-core`). It is therefore generic helpers only, with no domain types, and cannot reach a context. Relaxing the row is a later change that checks the cycle. `type:tooling` and `scope:tooling` rows are unchanged: tools do not use it.
5. **Ships empty.** A helper-less index plus the lint spec below. Alternative: seed it with a speculative clock or builder helper, which invents an interface nothing needs, the failure this change exists to prevent.
6. **Consumers declare it as a `devDependency` (`workspace:*`)** so the Nx graph sees the edge; the file-level rule keeps it out of production code even where the dependency is declared. The README states this, and the first consumer adds the line.
7. **Verification is a lint spec**: `libs/shared/testing` carries a spec that lints sample sources through ESLint's Node API against the repository configuration and asserts the requirements' scenarios. The scenarios are about the configuration's behaviour, so exercising the configuration is the lowest level that shows them.
8. **Documentation:** `AGENTS.md` _Testing Strategy_ states the location; ADR-0012's library table and tag table gain a row each. This amends the ADR's tables, not a decision, so no superseding ADR.

## Risks / Trade-offs

- [A file-level rule can be sidestepped by a relative import of the library's files] → the library exposes only its package entry; a relative path across projects is already a boundary violation.
- [The lint spec's virtual files need the Nx project graph to resolve `@basis/shared-testing`] → if `lintText` cannot resolve it, lint fixture files kept under the spec's own directory, excluded from the project's other targets.
- [`enforceBuildableLibDependency` may reject a spec in a buildable library importing a non-buildable one] → the library mirrors `shared-core`, so it has the same build target; task 2.1 verifies with a consumer fixture.
- [An empty library may look unused] → its README states the rule for what enters it and the lint spec keeps it exercised.
