# Test plan: share-the-database-connection

Derived by `change-test-writer` from `specs/shared-infrastructure/spec.md` (ADDED only) at commit `7fd2f7e`, before implementation. This file is not an artifact the OpenSpec schema defines; `openspec instructions apply` does not surface it.

The pass is additive: it wrote six new spec files and edited, deleted or disabled no existing test. No implementation was written; `libs/shared/infrastructure/` contains only the spec files below (no `package.json`, `project.json`, config or sources), and creating those is task 1.1/1.2.

## Tests written

Selecting a test: `pnpm nx <target> <project> -- <file> -t "<test name>"` (Vitest). The library's tests run once task 1.1 makes `shared-infrastructure` a project with a `test` target; until then `pnpm exec vitest run --root libs/shared/infrastructure` runs them.

| File                                                  | Project / target                 |
| ----------------------------------------------------- | -------------------------------- |
| `libs/shared/infrastructure/src/project.spec.ts`      | `shared-infrastructure` / `test` |
| `libs/shared/infrastructure/src/layout.spec.ts`       | `shared-infrastructure` / `test` |
| `libs/shared/infrastructure/src/package.spec.ts`      | `shared-infrastructure` / `test` |
| `libs/shared/infrastructure/src/boundaries.spec.ts`   | `shared-infrastructure` / `test` |
| `apps/api/src/database/shared-database-token.spec.ts` | `api` / `test`                   |
| `apps/api-e2e/src/shared-infrastructure.spec.ts`      | `api-e2e` / `e2e`                |

## Scenarios (9 in the delta specs, 9 accounted for)

### Requirement: The API's database is provided under a shared token

**S1. The library is a workspace project with the declared tags** — covered.

- `project.spec.ts` › "shared-infrastructure is among the listed workspace projects" — specified. Runs `pnpm exec nx show projects --json`.
- `project.spec.ts` › "it carries the tags scope:shared and type:infrastructure" — specified. Runs `nx show project shared-infrastructure --json`.
- State now: fails, project absent (target absent).
- Task: 1.1.

**S2. The API's database is resolved through the shared token** — covered.

- `shared-database-token.spec.ts` › "the provider for DATABASE is a Drizzle database whose connection is configured with exactly DATABASE_URL" — specified. It asserts `is(db, NodePgDatabase)` (the "is a Drizzle database" clause) and `$client.options.connectionString === url`.
- That the pool exposes its options as `$client.options` is an assumption carried over from `database.module.spec.ts` (derived, test mechanics).
- State now: the suite fails to load because `@basis/shared-infrastructure` cannot be found (target absent).
- Tasks: 1.2, 3.1.

### Requirement: Only infrastructure libraries and the API depend on the shared infrastructure

**S3. An infrastructure library may import it** — covered.

- `boundaries.spec.ts` › "the constraints for type:infrastructure and a context scope (scope:identity) allow a dependency on type:infrastructure and scope:shared" — specified.
- No context library exists, so the test reads the computed `@nx/enforce-module-boundaries` constraint table, the same way `libs/shared/testing/src/boundaries.spec.ts` does. It evaluates the table with the rule's semantics, using a local evaluator (see the discriminators below).
- State now: **fails on a wrong value**. The current table refuses the dependency. This is the real discriminating red, on the property task 2.1 changes.
- Task: 2.1.

**S4. The API may import it** — covered.

- `boundaries.spec.ts` › "a source file in apps/api importing @basis/shared-infrastructure is not reported" — specified. Lints a virtual `apps/api/src/sample.ts`.
- `boundaries.spec.ts` › "the constraints for the API project allow it (derived: shows the lint result is not merely an unresolved import)" — derived. Evaluates the table for `type:app` + `scope:api`.
- State now: **both pass before implementation**. Investigated as an alarm. The lint is clean only because the import resolves to no workspace project yet, which is why the derived table check exists. The table check passes because the current `type:app`/`scope:api` rows already admit `scope:shared` libraries of any type. The behaviour already exists, and this change need not alter it. These tests are regression guards, not evidence of new work. The lint result becomes meaningful once the library exists; S5's lint test shows the import then resolves.

**S5. Other layers may not import it** — covered.

- `boundaries.spec.ts` › "a source file in a type:core library importing @basis/shared-infrastructure is reported" — specified. State now: fails, because the import resolves to no project (target absent). Task: 1.1.
- `boundaries.spec.ts` › "the constraints for %s (in scope:identity) do not allow a dependency on it" — specified. There is one case each for `type:domain`, `type:application`, `type:contracts`, `type:util` and `type:data-access`.
- `boundaries.spec.ts` › "the constraints for %s do not allow a dependency on it" — specified, for "the web app" and "the mobile app". The tags are assumed (question 2).
- State now: the seven constraint cases **pass before implementation**. Investigated: those types are already refused, and they guard task 2.1 against widening the rule too far.
- For web and mobile, the pass may only mean that no row applies to the assumed tags. A source no row applies to is refused by the rule, so the test cannot tell this apart from a deliberate refusal (question 2).

### Requirement: The shared infrastructure is split into driving and driven

**S6. The layout holds** — covered.

- `layout.spec.ts` › "every non-spec source file other than src/index.ts is under src/driving/ or src/driven/" — specified. Also asserts the premise that `index.ts` exists.
- `layout.spec.ts` › "DATABASE is defined in a file under src/driven/" — specified. It imports `DATABASE` from `src/index.ts`, imports each non-spec file under `src/driven/`, and requires at least one to export the identical value. This executes the modules rather than grepping them.
- `layout.spec.ts` › "DATABASE is a Symbol (derived from design decision 3)" — derived.
- State now: all three fail (`src/index.ts` absent; target absent).
- Task: 1.2.

### Requirement: The built API runs with the shared infrastructure

**S7. The built API starts** — covered.

- `shared-infrastructure.spec.ts` › "the built API starts: GET /health answers 200 with DATABASE_URL naming a database where nothing listens" — specified.
- `shared-infrastructure.spec.ts` › "the built API resolves @basis/shared-infrastructure to a JavaScript file in the library's dist/" — specified, from the requirement text "resolve it at runtime from the library's compiled output". Node's `import.meta.resolve` runs from `apps/api/dist`, and the result must be a `.js` file under `libs/shared/infrastructure/dist/`.
- State now: the health test **passes before implementation** because the API does not import the library yet; the behaviour already exists, as in `database-startup.spec.ts`. It shows the change keeps the API starting. The resolution test fails because the package is not found (target absent), and it is the discriminating half.
- Tasks: 1.2, 3.1.

**S8. The deployed package starts** — covered.

- `shared-infrastructure.spec.ts` › "starts: GET /health answers 200 from node dist/main.js in the package pnpm deploy --filter api --prod writes" — specified.
- It runs `pnpm deploy --filter api --prod <dir>`, where `<dir>` is a fresh empty directory under the OS temp dir. That puts it outside the workspace, so nothing resolves from the workspace's `node_modules`, and the directory is removed afterwards.
- It asserts that the deploy exits 0 and that `@basis/shared-infrastructure` resolves, from `<dir>/dist`, to a `.js` file under a `shared-infrastructure/dist/` path inside `<dir>`. This part is specified by the requirement's "in the package `pnpm deploy` produces".
- It then starts `<dir>/dist/main.js` through the shared `startApi({ entry })` and asserts `GET /health` returns 200.
- State now: `pnpm deploy` succeeded, and the resolution failed because the package is not found (target absent). The health step was not reached.
- Tasks: 1.1, 3.1. Task 3.2 checks with `dist/` deleted.

**S9. The library's package exposes compiled output** — covered.

- `package.spec.ts` › "its exports resolve to JavaScript files under dist/, not to TypeScript sources" — specified.
  - Every runtime export target must be a `.js`/`.mjs`/`.cjs` file under `./dist/`.
  - Targets under a `types` condition must be `.d.ts`/`.d.mts`/`.d.cts` under `./dist/` (derived reading of "not TypeScript sources").
  - An extra export such as `"./package.json"` would be reported (derived consequence).
- `package.spec.ts` › "main and types point under dist/, and files lists dist (derived from design decision 5)" — derived.
- State now: both fail because `package.json` is absent (target absent).
- Task: 1.1.

### Fixture-driven discriminators (all pass now, as they must)

These run the local checks over material the test supplies, so a green real-content check is shown to discriminate.

- `layout.spec.ts` › "shared-infrastructure: the layout check discriminates (fixture-driven)": four tests.
- `package.spec.ts` › "shared-infrastructure: the exports check discriminates (fixture-driven)": six tests.
- `boundaries.spec.ts` › "shared-infrastructure: the constraint evaluator discriminates (fixture-driven)": five tests. These mirror `@nx/enforce-module-boundaries` 23.3.0's `findConstraintsFor`, `hasTag` and only/empty-only/not-tag checks. The one semantic not reproduced is the rule's transitive `notDependOnLibsWithTags` check, because the target library has no dependencies of its own.

Their cases are derived (each chosen because it falsifies the check on the property it asserts).

S1's two tests, the S2 test and S8's test execute the behaviour (the Nx CLI, Nest DI, `pnpm deploy` with Node resolution), so they are not static checks and need no fixture.

### Deliberately untested

- Design decision 4: the connection is created without `{ schema }`, and `Database` has no schema type parameter. Neither is stated in the delta spec. A type-level assertion would constrain design rather than the spec. Typecheck covers assignability.
- Design decision 2: `src/index.ts` "only re-exports". Not in the spec.
- The library's `build` target and `apps/api`'s `dependsOn: ["^build"]`: task 1.1 verifies these by command. S7 and S8 observe them, since they fail without the built output.
- ADR-0012 table amendments and the README: documentation, not behaviour.

## Obsolete tests

**Not applicable:** the change carries only `ADDED` deltas, so no requirement is superseded.

**Existing tests affected by the design (not obsolete; candidates for human confirmation).** Design decision 3 says `apps/api`'s module "re-exports none", so `DATABASE` will no longer be importable from `./database.module.js`. Task 3.1 directs updating "every import of `DATABASE` in `apps/api` specs and `tests/`". These files import it today, and would fail to compile or load once the export is removed:

- `apps/api/src/database/database.module.spec.ts` (`import { DATABASE } from './database.module.js';`). Its tests: "the application refuses to start, naming DATABASE_URL, when it is unset", "the application refuses to start, naming DATABASE_URL, when it is empty", and "the URL the connection is configured with is exactly DATABASE_URL".
- `apps/api/tests/integration/database.integration.spec.ts` (`import { DATABASE } from '../../src/database/database.module.js';`). Its tests: "a query reaches the database: current_database() is the database DATABASE_URL names" and "closing the API releases its connections".

Evidence: the import lines quoted above, against design decision 3.

The behaviour these tests assert (`api-persistence`) is unchanged, so they are not superseded. Only where they take the token from changes. Changing that import is the implementer's step under task 3.1 and must leave every assertion as it is. This pass did not touch them.

## Unresolved project questions

1. **What a context's scope tag looks like.** No context library exists, and the convention files do not name the tag. **Assumption:** `scope:identity`, the first context the proposal names, matched literally or by whatever wildcard rows the config uses. **Depends:** `boundaries.spec.ts` S3 test and the five S5 constraint cases (`CONTEXT_SCOPE`).
2. **The web and mobile apps' tags.** Neither app exists, and the convention files do not record their tags. **Assumption:** `type:app` + `scope:web` and `type:app` + `scope:mobile`, by analogy with `api` (`type:app`, `scope:api`, read from `nx show project api`). Their cases pass now, possibly only because no row applies to those tags. **Depends:** `boundaries.spec.ts` › "the constraints for the web app / the mobile app do not allow a dependency on it" (`WEB_APP`, `MOBILE_APP`).
3. **Stack skill.** The library carries no TypeScript/Vitest/Nest skill, so the tests rest on the testing floor and the project's existing specs as idiom.
4. **Running Nx and pnpm from inside a test.** `project.spec.ts` and the S8 test spawn `pnpm` (on `PATH` when run through `pnpm nx`) with `NX_DAEMON=false`. **Assumption:** CI's `test` and `e2e` runs have `pnpm` on `PATH`, and `pnpm deploy` runs offline from the store. It completed here in about 1.2s. **Depends:** the two `project.spec.ts` tests and the S8 test.

## Missing shared arrangement

The dispatch named `libs/shared/testing` (`@basis/shared-testing`) and `apps/api-e2e/src/support/api-process.ts` (read-only). `api-process.ts`'s `startApi` (with `entry`), `workspaceRoot` and `builtApiEntry` were used as they stand. Local declarations:

1. **`nx(args)` and `parseJson`** in `libs/shared/infrastructure/src/project.spec.ts`.
   - Stands in for: running the Nx CLI and parsing its JSON.
   - Used by: `project.spec.ts` › both tests.
   - Near-miss: none. A similar spawn appears in `apps/api/src/test-targets.spec.ts` (a test module), whose name and behaviour were not read.
   - Proposed home: `@basis/shared-testing` (generic helper), if promoted.
2. **`listFiles`, `nonSpecSources`, `misplaced`** in `libs/shared/infrastructure/src/layout.spec.ts`.
   - Stands in for: the layout check.
   - Used by: `layout.spec.ts` › S6 tests and its discriminators.
   - Near-miss: none.
   - Proposed home: none. It is specific to this library's layout, but could become generic in `@basis/shared-testing` once context `infrastructure` libraries need the same check.
3. **`exportTargets`, `nonCompiledExports`** in `libs/shared/infrastructure/src/package.spec.ts`.
   - Stands in for: the package-exports check.
   - Used by: `package.spec.ts` › S9 tests and its discriminators.
   - Near-miss: none.
   - Proposed home: `@basis/shared-testing`, if another library gains a build.
4. **`lintBoundaries`** in `libs/shared/infrastructure/src/boundaries.spec.ts`.
   - Stands in for: linting a virtual file through ESLint's Node API.
   - Used by: the S4 lint test and the S5 type:core lint test.
   - Near-miss: found in test module `libs/shared/testing/src/boundaries.spec.ts` (its local `lint`, which also filters `no-restricted-imports`/`no-restricted-syntax`). Not imported from there, per the rule that test modules do not import from one another.
   - Proposed home: `@basis/shared-testing`. A second spec now needs it.
5. **`DepConstraint`, `hasTag`, `allows`, `constraintTable`** in `libs/shared/infrastructure/src/boundaries.spec.ts`.
   - Stands in for: reading and evaluating `@nx/enforce-module-boundaries`' constraint table.
   - Used by: the S3 test, the S4 derived test, the S5 constraint cases and the evaluator discriminators.
   - Near-miss: test module `libs/shared/testing/src/boundaries.spec.ts` reads the table inline and checks only `onlyDependOnLibsWithTags` membership. That would not do, because it ignores wildcard, combo and `notDependOnLibsWithTags` semantics.
   - Proposed home: `@basis/shared-testing`, beside item 4.
6. **`resolveFrom(dir, specifier)`** in `apps/api-e2e/src/shared-infrastructure.spec.ts`.
   - Stands in for: Node ESM resolution from a directory, in a child process.
   - Used by: the S7 resolution test and the S8 test.
   - Near-miss: none in `api-process.ts`.
   - Proposed home: `apps/api-e2e/src/support/` (not `@basis/shared-testing`; it serves the e2e harness).

## Baseline

Scoped, taken before any test was written, at `7fd2f7e` with Node v24.9.0:

- `pnpm nx run-many -t test -p api shared-testing shared-core --skip-nx-cache`: 3/3 projects passed.
- `pnpm nx e2e api-e2e --skip-nx-cache` (builds `api`): passed.

The integration target was not run: no new test is an integration spec, and it needs Docker.

After writing:

- `vitest run --root libs/shared/infrastructure`: 9 failed and 24 passed. The 24 are the 15 discriminators, the S4 tests and the seven S5 constraint cases.
- `nx test api`: the new suite fails to load because the package cannot be found; the 8 existing tests still pass.
- `nx e2e api-e2e`: 2 new tests failed (resolution, deploy) and 12 passed, all existing tests among them.
- `nx lint api api-e2e`: green.
