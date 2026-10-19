# Test plan: share-the-test-arrangement

Spec file: `libs/shared/testing/src/boundaries.spec.ts` (the only file written). Run with `pnpm nx test shared-testing` once task 1.1 creates the project; individual tests are selected by name with `-t`. Level: the scenarios describe the root `eslint.config.mjs`'s behaviour, so each lints a virtual sample source through ESLint's Node API (design decision 7). Samples are never written to disk; they are given a path inside a real project (`shared-core`, `api`) or inside `libs/shared/testing`.

Situation per `testing`: the lint tests execute the configuration on sample material (second/first situation). The `depConstraints` table test is a static read of configuration (third situation); see Discriminators.

## Scenario accounting (6 scenarios in the delta, 6 accounted for)

| #   | Scenario                                                                                     | Status    | Tests (name filter for `-t`)                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The location is recorded (AGENTS.md names `libs/shared/testing` and `@basis/shared-testing`) | Uncovered | Reason: a documentation fact in `AGENTS.md`, not behaviour any lint/test run exercises; verifying it by reading Markdown from a spec would be a static read that fails/passes on prose. Covered by task 3.2 and review. Deliberately untested.                                                                                              |
| 2   | The library is a workspace project with the declared tags                                    | Uncovered | Reason: observable only through the Nx project graph (`nx show project`), a CLI/graph fact; no spec in the glob may reasonably shell out to Nx, and tags are indirectly exercised by tests 3-8 (the boundary rules resolve `libs/shared/testing` files to a `type:testing` project). Verified by task 1.1's command. Deliberately untested. |
| 3   | A spec in a library imports the shared arrangement                                           | Covered   | `Shared test arrangement: a spec may use it` (all tests, incl. the `it.each` over a `shared-core` spec and an `api` spec, and the `depConstraints` rows for each of the eight source types)                                                                                                                                                 |
| 4   | A production source file imports the shared arrangement                                      | Covered   | `Shared test arrangement: production code cannot import it > a non-spec source file in a library importing it is an error`; `... in an app importing it is an error`; `... the error comes from the file-level restriction`                                                                                                                 |
| 5   | A file under a tests directory is test code                                                  | Covered   | `Shared test arrangement: production code cannot import it > a file under a tests directory is test code`                                                                                                                                                                                                                                   |
| 6   | The shared arrangement imports a workspace library                                           | Covered   | `Shared test arrangement: it depends on no other workspace library > a file in libs/shared/testing importing @basis/shared-core ...`; `a spec in libs/shared/testing importing @basis/shared-core ...`                                                                                                                                      |

## Assertion classification

- Specified: spec importing it yields no violation (shared-core spec, api spec); non-spec library file and non-spec app file importing it yield an error; a `tests/` file importing it yields no violation; a `libs/shared/testing` file importing `@basis/shared-core` yields a boundary violation.
- Derived (inferred, not stated by a scenario; reconsider only as a recorded change):
  - the production error's `ruleId` is `no-restricted-imports` (design decision 3, not the spec);
  - `vitest.config.mts` and `eslint.config.mjs` in a library may import it (requirement title and design decision 3; no scenario);
  - a _spec_ in `libs/shared/testing` importing `@basis/shared-core` is also a violation (spec says "a file");
  - the violation's `ruleId` is `@nx/enforce-module-boundaries` (design decision 4);
  - the `depConstraints` table test: each of `type:core`, `type:util`, `type:contracts`, `type:domain`, `type:application`, `type:infrastructure`, `type:data-access`, `type:app` has a row whose `onlyDependOnLibsWithTags` includes `type:testing` (design decision 3's mechanism, used as a stand-in, see below);
  - the three "control" tests (a legal import yields no error; a `libs/shared/testing` file with no import is clean) exist to show the harness can report nothing, and are not requirements.
- Deliberately untested: scenarios 1 and 2 (above); a relative-path sidestep of the library (design risk 1, a pre-existing boundary rule); the scenario-3 phrase "in a `type:domain`, `type:application`, `type:infrastructure` library" is not lint-exercised directly, because no such project exists (see Unresolved questions).

## Baseline

Scoped baseline, `shared-core` only (`vitest run` in `libs/shared/core`): 1 file, 18 tests, all passing. No full-suite baseline was taken (`libs/shared/testing` does not exist as a project, so the new spec is not yet collected by `pnpm nx run-many -t test`). The new spec was run with an out-of-tree Vitest config (scratchpad, node, `globals: true`, include `src/**/*.spec.ts`) since the library's own `vitest.config.mts` does not exist yet.

First-run result of the new spec, before any implementation: 20 tests, 13 failed, 7 passed.

- Failing (state: the target is absent; assertions not yet shown to discriminate): all eight `depConstraints` rows tests (no `type:testing` row yet), the two "non-spec file imports it is an error" tests, the `no-restricted-imports` ruleId test, and the two "`libs/shared/testing` imports `@basis/shared-core`" tests (the project and rule do not exist).
- Passing on first run (alarm per `testing` state 4, investigated): the two "spec imports it" tests, the "tests directory" test, the two config-file tests, and the three controls. Cause: `@nx/enforce-module-boundaries` does not report an import it cannot resolve (`@basis/shared-testing` does not exist and is not linked), and `no-restricted-imports` is not yet configured, so "no violation" holds for the wrong reason now. These are therefore not evidence until the library exists. They are paired with red tests that become green only once the library resolves, which is what makes the pair discriminate: the "tests directory", config-file and "spec imports it" cases pass only because the restriction is absent today; after task 2.2 the production-file tests flip to error, which proves the harness resolves the import and the allowed cases are allowed by the file-level exemption rather than by a vacuous harness. Nothing was edited to hide this.

## Discriminators

- The `depConstraints` test is a static read of configuration (third situation). It is red at authoring, on the property "a `type:testing` allowed-dependency row exists". Its red run is the recorded observation that it can fail; no fixture-driven discriminator was written for it (no redirectable target: it reads the repository config by design). It is a stand-in for per-type sample files, which cannot be written while only `type:core` (`shared-core`) and `type:app` (`api`) projects exist, and flagged derived.
- The lint tests execute the configuration over material the tests supply (virtual sources), and each allowed case is paired with a red or controlled counterpart as described above.
- Discriminator not executed: none outstanding beyond the statement that every "no violation" test is vacuously green until task 1.1 and 2.2 land; the post-implementation run (task 3.1) is the confirmation.

## Obsolete tests

Not applicable: every delta is `ADDED`; no `MODIFIED`, `REMOVED` or `RENAMED` delta exists. Nothing existing was edited.

## Unresolved project questions

1. Test target for the new library. The spec lives in `libs/shared/testing`, which has no `vitest.config.mts`/`package.json` yet; the plan assumes the implementation mirrors `libs/shared/core` (`include: ['{src,tests}/**/*.{test,spec}...']`, `globals: true`, node environment) so `src/boundaries.spec.ts` is collected. Tests depending on it: all. The spec imports `describe/it/expect` from `vitest` explicitly and does not rely on globals.
2. Whether `eslint` (used by the spec through its Node API) is resolvable from `libs/shared/testing` and acceptable as an external import for a `type:testing` library (the row bans no externals in the design, so assumed yes; `eslint` is already a root devDependency). Tests depending on it: all.
3. Whether the Nx rule resolves a virtual `lintText` file to a project and `@basis/shared-testing` to the new library (design risk 2). If it does not, the implementation step should switch the tests to fixture files under the spec's directory per the design's fallback; the tests would then change location, not meaning. Tests depending on it: scenarios 4 and 6.
4. No `type:domain`, `type:application`, `type:infrastructure`, `type:util`, `type:contracts` or `type:data-access` project exists yet, so scenario 3 is exercised through a `type:core` library and an app, plus the configuration-table stand-in for the rest.
5. Shared test arrangement: `AGENTS.md` states there is none, so no question is raised for it.

## Missing shared arrangement

One entry. No shared arrangement exists (AGENTS.md states none yet), so no near-miss was possible.

- `lint(relativePath, source)` and the `ESLint` instance, both declared in `libs/shared/testing/src/boundaries.spec.ts`. Stands in for: linting a virtual source file against the repository `eslint.config.mjs` and returning the severity-2 `@nx/enforce-module-boundaries` and `no-restricted-imports` messages. Used by every test in that file (run it with `-t "Shared test arrangement"`). Near-miss: none. Found in another test module: no. Proposed home: none, since the library under change is the shared arrangement and this helper tests its own configuration rules; keep local (single user). Disposition for the implementer: keep local with that reason. **Disposition (apply): kept local — one user, and it tests this library's own configuration rules, so promoting it would put the harness inside what it checks.**
- `importSharedTesting` (a constant sample source) in the same file; same disposition: **kept local**, same reason.

## Notes for the implementation step

- The tests must go from failing to passing for tasks 1.1 (library exists, spec collected), 2.1 (`type:testing` row with no dependencies; `type:testing` listed in every library and app row) and 2.2 (`no-restricted-imports` ban outside `**/*.spec.{ts,tsx}`, `**/tests/**`, `vitest.config.*`, `vite.config.*`, `eslint.config.*`), and finally 3.1 (all 20 green, no `eslint-disable`). The `vitest.config.*`/`eslint.config.*` config-file tests also rely on the ban exempting those two filenames inside a library.
- This manifest is not an artifact the OpenSpec schema knows about; it will not appear among `openspec instructions apply`'s context files and must be read on purpose.
