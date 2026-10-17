# Test plan: scaffold-workspace

Derived before implementation from `specs/shared-core/spec.md` and `specs/change-scope/spec.md` by an author who has not seen the implementation. This file is not an OpenSpec schema artifact: it does not appear among `openspec instructions apply`'s context files and must be read on purpose before implementing.

## Names the implementation must match

The design leaves these open; the tests fix them, and the implementation must use exactly these names.

- `tools/change-scope/src/docs-only.ts` exports **`classify(paths: readonly string[], exceptions?: readonly string[]): 'docs-only' | 'full'`**, where `exceptions` defaults to the declared list, and **`DOCUMENTATION_EXCEPTIONS: readonly string[]`**, the declared list.
- The spec imports the module as **`./docs-only.ts`** (with the `.ts` extension), so the project's `tsconfig` must permit it (`allowImportingTsExtensions`, or `rewriteRelativeImportExtensions`). See unresolved question Q3.
- `libs/shared/core/src/index.ts` exports **`success`**, **`failure`** and the type **`Result`**; the spec imports nothing else (it does not use `Failure` or `Success` directly).
- `success(value)` and `failure(value)` must infer their result's type from a contextual return type, since the narrowing test writes `found ? success(7) : failure('not-found')` as the body of a function declared to return `Result<string, number>`.

## Test files

- `libs/shared/core/src/lib/result.spec.ts`
- `tools/change-scope/src/docs-only.spec.ts`

Select a single test with Vitest's file filter and name filter, e.g. `pnpm vitest run libs/shared/core/src/lib/result.spec.ts -t "a success carries its value"`, or through Nx once the project names exist: `pnpm nx test <project> -- -t "<test name>"`. Test names below are the full Vitest names (`describe` + `it`).

The type-level assertions (`expectTypeOf`, `// @ts-expect-error`) in the two narrowing tests are enforced by the **`typecheck`** target over the spec file, not by the `test` target: Vitest's runtime treats `expectTypeOf` as a no-op. That scenario is satisfied only when both `test` and `typecheck` pass.

## Scenario coverage

21 scenarios in the delta specs; 21 accounted for below (21 covered, 0 uncovered).

### specs/shared-core/spec.md (8 scenarios)

| #   | Requirement                               | Scenario                                     | Test(s) in `result.spec.ts`                                                                                                                                                      |
| --- | ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A result is either a success or a failure | A success carries its value                  | `Result: a result is either a success or a failure > a success carries its value`                                                                                                |
| 2   | same                                      | A failure carries its value                  | `Result: a result is either a success or a failure > a failure carries its value`                                                                                                |
| 3   | same                                      | A falsy value is still carried               | `Result: a result is either a success or a failure > a falsy value is still carried by success: %s` and `... by failure: %s` (each over `0`, `""`, `false`, `null`, `undefined`) |
| 4   | A result reports which it is              | A success reports success                    | `Result: a result reports which it is > a success reports success`                                                                                                               |
| 5   | same                                      | A failure reports failure                    | `Result: a result reports which it is > a failure reports failure`                                                                                                               |
| 6   | same                                      | A check narrows the value's type             | `Result: a result reports which it is > a check narrows the value type` (typecheck-enforced)                                                                                     |
| 6b  | same                                      | A check narrows when both types are the same | `Result: a result reports which it is > a check narrows when both types are the same` (typecheck-enforced)                                                                       |
| 7   | The shared core depends on nothing        | The shared core is used without a framework  | `Result: the shared core depends on nothing > the shared core is used without a framework`                                                                                       |

Fixture-driven discriminator for scenario 7's static manifest read: `Result: the shared core depends on nothing > the dependency check detects a declared runtime dependency (fixture)`.

### specs/change-scope/spec.md (13 scenarios)

| #   | Requirement                                              | Scenario                               | Test(s) in `docs-only.spec.ts`                                                                                  |
| --- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 8   | Documentation-only only when every path is documentation | Markdown only                          | `classify: a change is documentation-only only when every path is documentation > markdown only`                |
| 9   | same                                                     | A change record                        | `... > a change record`                                                                                         |
| 10  | same                                                     | Markdown beside code                   | `... > markdown beside code`                                                                                    |
| 11  | same                                                     | YAML outside the change records        | `... > yaml outside the change records`                                                                         |
| 12  | same                                                     | A suffix in another case               | `... > a suffix in another case`                                                                                |
| 13  | same                                                     | A path that is not repository-relative | `... > a path that is not repository-relative: %s` (over `openspec/../x.yaml`, `/abs/docs/a.md`, `./docs/a.md`) |
| 14  | same                                                     | A deleted or renamed source file       | `... > a deleted or renamed source file`                                                                        |
| 15  | same                                                     | Nothing changed                        | `... > nothing changed`                                                                                         |
| 16  | Declared exceptions are never documentation              | A declared exception                   | `classify: declared exceptions are never documentation > a declared exception`                                  |
| 17  | same                                                     | Nothing is excepted by default         | `classify: declared exceptions are never documentation > nothing is excepted by default`                        |
| 18  | Runs without installed dependencies and fails closed     | Verdict on standard input              | `docs-only command: runs without installed dependencies and fails closed > verdict on standard input`           |
| 19  | same                                                     | Empty input                            | `docs-only command: ... > empty input`                                                                          |
| 20  | same                                                     | Mixed input                            | `docs-only command: ... > mixed input`                                                                          |

Scenario 14 is exercised as stated: the classifier takes paths as given, so a deleted path or a rename's source side is just a path in the list; producing that list (`git diff --name-only --no-renames`) is the callers', not the classifier's, and is not in this spec.

### Tests beyond the scenarios

`docs-only.spec.ts`, under `classify: a change is documentation-only ...`: `a .yaml file directly under openspec/ is documentation`; `a .yaml file outside openspec/ is not documentation`; `a .yaml suffix in another case is not documentation`; `a path with an empty or .. segment is not documentation: %s`; `one non-documentation path anywhere in the list makes it full`; `.yml under openspec/ is not documentation`; `a nested directory named openspec is not the change records`. Under `classify: declared exceptions ...`: `the declared list is empty when the capability is introduced`; `a declared exception among documentation still makes the list full`; `an exception does not affect paths it does not name`. Under `docs-only command: ...`: `runs from a copy outside the workspace, where no dependency can resolve`; `blank lines between paths are ignored`; `the output check rejects anything but the bare verdict (fixture)`.

## Assertion classification

**Specified** (traces to a scenario or to requirement text):

- Every scenario assertion in rows 1 to 20 and 6b.
- Row 6b: in all four branches (`isSuccess()` true and false, `isFailure()` true and false) over `Result<string, string>`, `result` is not `never` and `result.value` is exactly `string` (scenario: "`value` a `string` in every branch, and neither branch's result is narrowed to an impossible type"). The runtime checks that each branch is reached for the expected input and carries the expected value are derived scaffolding to make every branch execute, not part of the scenario's claim.
- `isSuccess()`/`isFailure()` returning exactly one `true` inside the falsy-value tests (requirement: "it is a success, or a failure respectively").
- Narrowing after `isFailure()` in the narrowing test (requirement text: "after `isFailure()` returns `true` its `value` has the failure type"; the scenario names only `isSuccess()`).
- `libs/shared/core/package.json` declares no `dependencies` entry (scenario 7: "declares no runtime dependency").
- `.yaml` under `openspec/` is documentation; `.yaml` outside it (`docs/a.yaml`, `openspec.yaml`, `openspecs/a.yaml`) is not; `.YAML` is not; empty and `..` segments (`docs//a.md`, `docs/a.md/../b.md`, `docs/../AGENTS.md`) are not; one non-documentation path anywhere makes the list `full` (requirement 1 text).
- `DOCUMENTATION_EXCEPTIONS` equals `[]` (requirement 2: "The list is empty when this capability is introduced"). A later change adding an entry supersedes this assertion and must report it as such, not edit it silently.
- An exception among other documentation still yields `full` (requirement 2: "a list containing any of them as `full`").
- Blank lines between paths are ignored (requirement 3: "ignoring blank lines").
- The command run from a copy in a fresh temporary directory, with that directory as working directory, gives the same verdict (requirement 3: "with Node.js alone and no installed dependencies"). Mechanism derived: it relies on design decision 11's "in one file"; a classifier split across files, or importing any package, fails it.

**Derived** (the test author's inference; reviewable, not agreed):

- `peerDependencies` and `optionalDependencies` count as runtime dependencies alongside `dependencies`, so the manifest check rejects them too; `devDependencies` does not count.
- `.yml` under `openspec/` is not documentation (strict reading of "ends in `.yaml`").
- `docs/openspec/a.yaml` is not documentation: "lies under `openspec/`" read as the top-level `openspec/` directory of a repository-relative path.
- An exception does not affect paths it does not name (`classify(['docs/a.md'], ['docs/read-by-a-test.md'])` is `docs-only`).
- "Prints exactly `docs-only` or `full`" admits one trailing line terminator (`\n` or `\r\n`) and nothing else; stderr is not asserted. See Q2.
- The command's helpers: `verdictOutput` regex and its fixture test; a 10-second spawn timeout (a command that blocks on standard input fails rather than hangs).

**Deliberately untested:**

- "The shared core SHALL import no other library of the workspace and no third-party package": not asserted by a unit test, which would have to read the implementation's source. Design decision 3 enforces it through `@nx/enforce-module-boundaries` (`type:core`: `onlyDependOnLibsWithTags: []`, `bannedExternalImports: ['*']`), and the tasks provoke that rule to fail. Scenario 7's test covers the observable half (the entry point is usable with no framework; the manifest declares no dependency).
- "Every caller SHALL treat any other output, or a non-zero exit, as `full`": a property of the hooks and CI, not of the classifier, and not reachable from these unit tests. The tasks' provocation of each caller is where it is shown.
- Whitespace-only lines and CRLF-terminated input lines on standard input: the spec says "blank lines" without defining them; no assertion is made either way.
- "A result SHALL be exactly one of the two" beyond the `isSuccess()`/`isFailure()` checks: no structural assertion (e.g. `instanceof`) is made, since the spec names no classes.

## Discriminator records

- **Manifest read (scenario 7)** is a static read of `libs/shared/core/package.json`. Its fixture-driven discriminator, `the dependency check detects a declared runtime dependency (fixture)`, runs the same helper over in-test manifests that declare dependencies and asserts they are detected. It has not been executed (no runner; see baseline). At authoring the real-file check is red only because the file is absent (target-absent), not on the property; it goes green when the library is generated with no dependency.
- **Command output matcher**: `the output check rejects anything but the bare verdict (fixture)` falsifies the `verdictOutput` matcher on wrong verdicts, prefixed output and two-line output. Not executed (no runner).
- **Narrowing**: `expectTypeOf(...).toEqualTypeOf<number>()` discriminates where the `@ts-expect-error` alone would not (an un-narrowed `string | number` value also fails assignment to `string`, satisfying the directive). Not executed: no TypeScript configuration or Vitest types exist. A syntax-only compile in a scratch directory showed only the expected missing-module and dependent errors.

- **Narrowing when both types are the same (row 6b)**: `expectTypeOf(result).not.toBeNever()` is the discriminator for "narrowed to an impossible type" — `toEqualTypeOf<string>()` on `result.value` alone would surface only as a missing-property error on `never`. Observed red at authoring (2026-10-17) on exactly that property: `pnpm nx typecheck shared-core --skip-nx-cache` failed with 6 errors, all in the two else-branches of this test (lines 111-113 after `isSuccess()`, 125-127 after `isFailure()`): TS2349 on `not.toBeNever` and TS2339 "Property 'value' does not exist on type 'never'". The branches after a `true` check type-check. The runtime half passes (`test`: 18 passed), as expected, since the defect is type-level only.

## Obsolete tests

Not applicable: both delta specs contain `ADDED` requirements only, so nothing is superseded. (Also, no test exists anywhere in the repository; the glob `{apps,libs,tools}/**/*.spec.{ts,tsx}` matched nothing before this pass.)

## Unresolved project questions

- **Q1. No stack skill for TypeScript/Vitest.** The skill library carries none; the tests rest on the testing floor and on Vitest's documented API (`describe`, `it`, `it.each`, `expect`, `expectTypeOf`). Affects both files.
- **Q2. "Prints exactly".** Assumed one trailing line terminator is allowed (a conventional line-oriented command, and `$(...)` strips it). Affects the four command tests that check stdout (scenarios 18, 19, 20 and `runs from a copy outside the workspace...`, `blank lines between paths are ignored`). If the project means no terminator at all, the matcher is a derived assertion to tighten, recorded as such.
- **Q3. Relative import extension.** `docs-only.spec.ts` imports `./docs-only.ts`, matching a module run directly by Node with type stripping (which requires the extension in its own imports). Assumes the project's `tsconfig` allows `.ts` import extensions. `result.spec.ts` imports `../index` without an extension, as the dispatch specified; that assumes a resolution mode that allows extensionless relative imports (`bundler`), or the implementer adds whatever the generated configuration needs without changing what is imported.
- **Q4. ESM.** Both spec files use `import.meta.url`, so each project must compile its spec files as ES modules (`"type": "module"` in the project's `package.json`, or a module setting that does). Affects scenario 7's test and every command test.
- **Q5. Node used for the command.** The command tests spawn `process.execPath`, i.e. the Node running Vitest; provisioning puts that at Node 24. Local Node is v22.20.0 at authoring, which also strips types by default, but the requirement is Node 24 (`.nvmrc`).
- **Q6. Nx project names.** Unknown until generation (`@basis/shared-core`, `change-scope`, or other); the Nx selection form above uses `<project>`.

## Baseline

**Second pass (2026-10-17, scenario 6b only), scoped to project `shared-core`:** before adding the test, `pnpm nx typecheck shared-core --skip-nx-cache` succeeded and `pnpm nx test shared-core --skip-nx-cache` succeeded (17 tests). After adding it, `typecheck` fails with the 6 errors recorded under Discriminator records, all attributable to the new test; `test` passes (18 tests). The other scenarios' baselines were not re-taken on this pass.

**First pass:**

**No baseline was taken.** The workspace does not exist at authoring: no `package.json`, no Nx, no Vitest, no `tsconfig`, and no test file anywhere in the repository. `pnpm nx run-many -t test` cannot execute. Every test in both files will fail on first run in the target-absent state (`../index` and `./docs-only.ts` do not exist; `libs/shared/core/package.json` does not exist), which establishes only that the targets are absent, not that the assertions are sound. A test that passes before its target exists is an alarm to investigate, not coverage.
