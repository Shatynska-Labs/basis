# Test plan: add-api-cross-cutting-basics

Written by `change-test-writer` from the delta specs as committed in c6d2542, before implementation. This is a repeat pass: it replaces the earlier pass's manifest wholesale. `apps/api/src/config/config.spec.ts`, written by that earlier pass, is treated here as an existing test: it was not edited, and it is accounted for below.

This file is not an OpenSpec schema artifact; `openspec instructions apply` does not surface it.

## How to run a single test

- `apps/api` unit specs: `cd apps/api && pnpm exec vitest run <file> -t "<test name>"` (whole project: `pnpm nx test api`).
- `shared-domain` unit spec (once the project exists, task 3.1): `cd libs/shared/domain && pnpm exec vitest run src/lib/domain-error.spec.ts -t "<test name>"` (whole project: `pnpm nx test shared-domain`).
- `apps/api-e2e`: build first (`pnpm nx build api`), then `cd apps/api-e2e && pnpm exec vitest run --config vitest.e2e.config.mts <file> -t "<test name>"` (whole suite: `pnpm nx e2e api-e2e`).

`-t` matches a substring of the full name (`describe` titles plus `it` title); the names below are the `it` titles, which are unique within their file.

## Scenario coverage

29 scenarios in the delta specs (api-configuration 10, api-logging 3, api-http-errors 13, shared-domain 3); 29 accounted for below, all covered. No scenario is uncovered.

Classification key: **S** specified (traces to a scenario or to the requirement text), **D** derived (inferred; no stated requirement covers it), **U** deliberately untested.

### api-configuration (10)

| #   | Scenario                                      | Test(s)                                                                                                                                                    | Task |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | A complete environment is read                | `apps/api/src/config/config.spec.ts` › "a complete environment is read"                                                                                    | 1.1  |
| 2   | Every invalid variable is named at once       | `config.spec.ts` › "every invalid variable is named at once: DATABASE_URL unset and PORT=abc"                                                              | 1.1  |
| 3   | A missing database URL is refused             | `config.spec.ts` › "a missing database URL is refused: unset", "… empty"                                                                                   | 1.1  |
| 4   | A whitespace database URL is used unchanged   | `config.spec.ts` › "a whitespace database URL is used unchanged"                                                                                           | 1.1  |
| 5   | The port takes its default                    | `config.spec.ts` › "the port takes its default: unset", "… empty"                                                                                          | 1.1  |
| 6   | A malformed port is refused                   | `config.spec.ts` › "a malformed port is refused: PORT=…" (7 cases)                                                                                         | 1.1  |
| 7   | The build identifier takes its default        | `config.spec.ts` › "the build identifier takes its default: unset", "… empty"                                                                              | 1.1  |
| 8   | An invalid port stops the API                 | `apps/api-e2e/src/startup-configuration.spec.ts` › "an invalid port stops the API"                                                                         | 2.2  |
| 9   | Reading the environment elsewhere is reported | `apps/api/src/config/environment-access.spec.ts` › "reading the environment elsewhere is reported: process.env[\"PORT\"] in apps/api/src/health/sample.ts" | 1.3  |
| 10  | The configuration may read the environment    | `environment-access.spec.ts` › "the configuration may read the environment: process.env[\"PORT\"] in apps/api/src/config/sample.ts"                        | 1.3  |

Assertion classification:

- `config.spec.ts` (earlier pass, unchanged): every scenario test above is S. Its other tests are labelled in their names: "the error names variables without echoing their values" D (design decision 1); "creating the application with PORT=abc fails naming PORT, before anything listens" S (requirement text "validate all of them together when the API is created"); "the application provides the validated configuration under APP_CONFIG" D (design decision 1: token and shape); "the bounds themselves are accepted: PORT=1 / 65535" S (requirement text "from 1 to 65535").
- `startup-configuration.spec.ts`:
  - "an invalid port stops the API": exit code is a number and not 0, output contains `PORT`, contains neither `n0t-a-real-pa55word` nor `n0t-a-p0rt` — S. That the exit is not by signal (`typeof code === 'number'`) — D (design decision 3: exit status 1 rather than an abort). "GET /health is never answered" is observed as: the process exits on its own within the window; a process that has exited answers nothing, and with `PORT` invalid there is no port it could have been asked on (see unresolved question 5).
  - "an invalid port is refused by name: PORT appears as a word of its own …" — D: tightens "contains `PORT`" so that Node's own `ERR_SOCKET_BAD_PORT` does not satisfy it (see _Baseline_, first-run pass).
  - "every invalid variable is named in the output: DATABASE_URL unset and PORT invalid" — S (requirement text "name every invalid variable").
  - "what the refused API writes is JSON lines" — D (api-logging's "from process start" applied to a refused start, which no scenario states).
- `environment-access.spec.ts`:
  - scenario tests 9 and 10 — S.
  - "reading the environment elsewhere by dot access / destructuring is reported too" — D (requirement text says "read `process.env`"; the forms are inferred).
  - "a source file at the root of apps/api/src reading it is reported" — S (requirement text: any non-spec source under `apps/api/src`).
  - "the migration process may read it" — S (requirement text).
  - "a spec under apps/api/src may read it" — D (requirement text restricts only non-spec files; that specs are actively allowed is design decision 2, and existing specs read `process.env`).
  - "a source file outside apps/api reading it is not reported by this restriction" — D.
  - "the same file in apps/api/src without the read is clean (control …)" — D (control).

### api-logging (3)

| #   | Scenario                             | Test(s)                                                                       | Task     |
| --- | ------------------------------------ | ----------------------------------------------------------------------------- | -------- |
| 11  | The built API's output is JSON lines | `apps/api-e2e/src/json-logs.spec.ts` › "the built API's output is JSON lines" | 2.1, 2.2 |
| 12  | A nested secret is redacted          | `apps/api/src/logging/logger.spec.ts` › "a nested secret is redacted"         | 2.1      |
| 13  | Every secret name is redacted        | `logger.spec.ts` › "every secret name is redacted"                            | 2.1      |

Assertion classification:

- `json-logs.spec.ts` › scenario test: at least one line, every non-empty line a JSON object with a string `level` and a `message` member — S; `GET /health` answering 200 — S (scenario's "is answered"); the premise that nothing listens on `127.0.0.1:9` — S (scenario's "naming an address where nothing listens").
- `logger.spec.ts`:
  - scenario tests 12 and 13 — S. In 13, "the entry was written at all" (contains the message) is D, a non-vacuity guard.
  - "a property whose name is not a secret is left unchanged" — S (requirement text "leave other properties unchanged").
  - "a secret inside an array of objects is redacted" — D ("at any depth" read to include array elements).
  - "a secret in an error-level entry is redacted" — D.
  - "the entry is one JSON line with a string level and the message" — D (the JSON-lines requirement is stated for the built process; this observes it at the logger).

### api-http-errors (13)

All in `apps/api/src/http/http-errors.spec.ts`, under `describe('api-http-errors')`. Task 3.3 throughout; 3.1 and 3.2 for the domain-failure tests.

| #   | Scenario                                               | Test(s)                                                                                                               |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 14  | An unknown route is a problem document                 | "an unknown route is a problem document"                                                                              |
| 15  | The health report is unaffected                        | "the health report is unaffected"                                                                                     |
| 16  | A success is answered with its value                   | "a success is answered with its value"                                                                                |
| 17  | Each kind maps to its status                           | "each kind maps to its status: not-found is 404", "… conflict is 409", "… rule-violated is 422", "… forbidden is 403" |
| 18  | An invalid body is refused with its issues             | "an invalid body is refused with its issues"                                                                          |
| 19  | An invalid query is refused                            | "an invalid query is refused"                                                                                         |
| 20  | A valid request reaches the handler parsed             | "a valid request reaches the handler parsed"                                                                          |
| 21  | A thrown error is not disclosed                        | "a thrown error is not disclosed"                                                                                     |
| 22  | A server-side HTTP exception is not disclosed          | "a server-side HTTP exception is not disclosed"                                                                       |
| 23  | A thrown error is logged with its stack                | "a thrown error is logged with its stack"                                                                             |
| 24  | A thrown non-error is logged by type only              | "a thrown non-error is logged by type only"                                                                           |
| 25  | An oversized body is refused as too large              | "an oversized body is refused as too large"                                                                           |
| 26  | An upstream error carrying a client status is a defect | "an upstream error carrying a client status is a defect"                                                              |

Assertion classification:

- Every scenario test's assertions — S, with these notes: tests 21, 22 and 26 assert exactly one `error` entry (requirement text "SHALL write one log entry"); test 15's body `{ status: 'ok', version: '3f2c9e1' }` is the body `api-health` specifies; test 18 also asserts the handler was not invoked (scenario) and test 19 asserts the same (requirement text "the handler SHALL NOT run"); test 23 serializes the captured entry's arguments, spelling out any `Error` as name, message and stack, and looks for the thrown error's `name` and `stack` there.
- "a status with no reason phrase is titled \"Error\"" — S (requirement text), provoked with `new HttpException(…, 499)`.
- "a %s failure is a full problem document: type about:blank and the reason phrase of %i" — S (requirement "Error responses are problem documents").
- "a domain failure is not logged as a defect" — D (design decision 8: 4xx responses are not logged).
- "a valid body reaches the handler as the value the schema produces" — S (requirement text).
- "a refused request is a problem document titled for 400" — S.
- "a defect body holds the reason phrase of its status" — S.
- "a thrown error is logged with its own name, not a fixed one" — D: with the scenario's plain `Error` the name `Error` is also inside the stack, so this checks the name is the error's own.
- "a thrown non-error is not disclosed to the client either" — S (requirement "A defect is answered without disclosure").
- "a body within the limit reaches the route (control …)" — D (control).

### shared-domain (3)

All in `libs/shared/domain/src/lib/domain-error.spec.ts`. Task 3.1. The file is collected once the `shared-domain` project exists (see _Baseline_).

| #   | Scenario                                      | Test(s)                                         |
| --- | --------------------------------------------- | ----------------------------------------------- |
| 27  | A subclass declares its kind and code         | "a subclass declares its kind and code"         |
| 28  | Only the four kinds type-check                | "only the four kinds type-check"                |
| 29  | The shared domain is used without a framework | "the shared domain is used without a framework" |

Assertion classification:

- Scenario tests 27 and 29 — S. In 28, the `@ts-expect-error` on `kind = 'teapot'` and `DomainError['kind']` being exactly the four kinds — S; `DomainErrorKind` being exported under that name — D (design decision 6). Test 28's assertions are enforced by the `typecheck` target, not at runtime by `test` (as in `libs/shared/core/src/lib/result.spec.ts`); an unused `@ts-expect-error` is itself a type error, so it fails if `"teapot"` is accepted.
- "each of the four kinds is accepted: %s" — S (requirement text).
- "code and message are strings, and a domain error has no stack" — strings S (requirement text); no `stack` property D (design decision 6).
- "its sources import no other workspace library and no third-party package" — S (requirement text). Node built-ins (`node:`) are not counted as third-party.
- "the dependency check detects a declared runtime dependency (fixture)" and "the import check detects a workspace or third-party import (fixture)" — fixture-driven discriminators for the two static checks above (D as cases, present to show those checks can fail).
- Discriminator not written: the tags assertion in test 29 reads Nx's view of the project through `nx show project`; a fixture would need an Nx project on disk, which this pass cannot write outside the test-path glob. It is red at authoring because the project is absent (target absent), not on the tags property, so that red run does not establish that it discriminates on tags.

### Deliberately untested

None beyond what the classifications above state. Not tested, with reason: the `ConfigError` log entry's exact message `Configuration is invalid.` and its `variables` param (design decision 3 — an implementation detail no requirement states); `StandardSchemaValidationPipe`'s `detail` `"The request is invalid."` (design decision 9, likewise); route-parameter (`@Param`) schemas, which the requirement lists but no scenario exercises, since the body and query cases go through the same pipe.

## Obsolete tests

Not applicable: every delta in this change is `ADDED`, so no requirement is modified or removed and no existing test is superseded. The existing `api-persistence` and `api-health` suites (`apps/api/src/database/*.spec.ts`, `apps/api-e2e/src/database-startup.spec.ts`, `apps/api-e2e/src/health.spec.ts`) must stay green unchanged (design decision 10).

## Unresolved project questions

1. **No TypeScript, Vitest or NestJS stack skill exists** in the library; this pass ran on the `testing` skill's floor alone (confirmed by the dispatcher).
2. **Defect log entries reach the logger passed to `NestFactory.create`.** `http-errors.spec.ts` captures log entries with a `LoggerService` passed as `logger`, which Nest makes the target of every `Logger` instance and static call. Assumption: `ProblemFilter` logs through Nest's `Logger`, not through a logger it builds itself. Depends: tests 21, 22, 23, 24, 25, 26, "a domain failure is not logged as a defect", "a thrown error is logged with its own name, not a fixed one".
3. **`ConsoleLogger` writes through `process.stdout.write` and `process.stderr.write`.** `logger.spec.ts` captures output by replacing both. Checked by a scratch run of `ConsoleLogger` from `@nestjs/common` 12.1.3 (`json: true`, `colors: false`, `redact`): it wrote one JSON line per entry, `log` to standard output and `error` to standard error, redacted nested and in-array keys case-insensitively, and left the caller's object unchanged. Depends: every test in `logger.spec.ts`.
4. **The test command now reports "The workspace is out of sync"** until `pnpm nx sync` runs, because `http-errors.spec.ts` imports `@basis/shared-core` and `@basis/shared-domain` from `apps/api`. Task 3.1 already runs `pnpm nx sync`; `apps/api`'s `package.json` must declare both (dispatcher). Until then, the suite runs with `--skip-sync`, as this pass's runs did.
5. **"`GET /health` is never answered"** (scenario 8) is observed as the process exiting on its own within 15 s: there is no valid port to ask it on. The derived word-boundary test was added because the pre-change build already satisfies the scenario's literal assertions (see _Baseline_).
6. **Body parser limit.** Test 25 sends a 2 MiB JSON body, assuming the parser's limit stays at Express's default of 100 kB. If the implementation raises the limit above 2 MiB, the test's body must grow, which changes setup and not what it asserts.
7. **HTTP client.** The new `apps/api` and e2e specs use `fetch`, not supertest, so they need no new dependency. Supertest resolves from the workspace root (`node_modules/supertest`, `@types/supertest`); `apps/api-e2e`'s `package.json` declares neither, which `health.spec.ts` already relies on.

## Missing shared arrangement

The shared test arrangement is `libs/shared/testing` (`@basis/shared-testing`). It depends on no other workspace library and holds generic helpers only; per AGENTS.md, a fake of a port stays declared in the spec that uses it until a change decides where such fakes live. It holds the Testcontainers PostgreSQL helpers only, so it has no near-miss for any entry below. `apps/api-e2e/src/support/api-process.ts` is the e2e suite's read-only harness; it is not part of `libs/shared/testing`, but it is named as a near-miss where it applies.

1. **`lintErrors`**, in `apps/api/src/config/environment-access.spec.ts`. Stands in for: linting a virtual source at a repository path against the root `eslint.config.mjs`. Used by: every test in that file. Near-miss: none in the shared arrangement. Found in test modules: `libs/shared/testing/src/boundaries.spec.ts` (`lint`, which also filters by rule), and the same shape in `libs/shared/infrastructure/src/boundaries.spec.ts`. Proposed home: `libs/shared/testing` as a generic `lintText(relativePath, source)` helper (it would take `eslint` as a dependency).
2. **`captureOutput`**, in `apps/api/src/logging/logger.spec.ts`. Stands in for: capturing what the process writes to standard output and standard error. Used by: every test in that file. Near-miss: none. Found in a test module: no. Proposed home: `libs/shared/testing` (generic).
3. **`capturingLogger`, `LogEntry`, `serialize`**, in `apps/api/src/http/http-errors.spec.ts`. Stand in for: Nest's `LoggerService` (the application logger), recording entries with their level, and an entry's arguments as text. Used by: tests 21–26, "a domain failure is not logged as a defect", "a thrown error is logged with its own name, not a fixed one". Near-miss: none. Found in a test module: no. Proposed home: `libs/shared/testing`, if it may depend on `@nestjs/common` (a third-party package, not a workspace library); otherwise none.
4. **`raise`**, in `http-errors.spec.ts`. Stands in for: throwing an arbitrary value (a non-`Error`) from a route without a lint exception. Used by: "a thrown non-error is logged by type only", "a thrown non-error is not disclosed to the client either". Near-miss: none. Found in a test module: no. Proposed home: none worth proposing (one line).
5. **`ExampleFailure`**, in `http-errors.spec.ts`. Stands in for: a `DomainError` subclass of a given kind with code `habit.example` and message `Example failure.`. Used by: test 17, "a %s failure is a full problem document …", "a domain failure is not logged as a defect". Near-miss: none. Found in a test module: no. Proposed home: none — `libs/shared/testing` may not depend on `@basis/shared-domain`.
6. **`ProbeController`, `ProbeModule`, `handled`, `lastThrown`, `bodySchema`, `querySchema`**, in `http-errors.spec.ts`. Stand in for: routes of the API that provoke each scenario, over `AppModule`. Used by: every test in that file. Near-miss: none. Found in a test module: no. Proposed home: none — they are specific to these scenarios and import the app.
7. **`runUntilExit`, `Ended`**, in `apps/api-e2e/src/startup-configuration.spec.ts`. Stand in for: starting the built API with exactly a given environment and waiting for it to exit. Used by: every test in that file. Near-miss: `startApi` in `apps/api-e2e/src/support/api-process.ts`, which always sets a valid `PORT` and rejects unless `GET /health` answers, so it cannot start the API with an invalid `PORT` or report an exit status. Found in a test module: a similar local `startApi`/`stop` in `apps/api-e2e/src/database-startup.spec.ts`. Proposed home: `api-process.ts`, as an option to pass the environment in full and a function that resolves on exit.
8. **`refusesConnections`**, in `apps/api-e2e/src/json-logs.spec.ts`. Stands in for: checking that nothing listens at a host and port. Used by: "the built API's output is JSON lines". Near-miss: none. Found in a test module: `apps/api-e2e/src/database-startup.spec.ts` (same helper). Proposed home: `apps/api-e2e/src/support/api-process.ts`, or `libs/shared/testing` (generic).
9. **`declaredRuntimeDependencies`**, in `libs/shared/domain/src/lib/domain-error.spec.ts`. Stands in for: reading a manifest's runtime dependency names. Used by: test 29, "the dependency check detects a declared runtime dependency (fixture)". Near-miss: none. Found in a test module: `libs/shared/core/src/lib/result.spec.ts` (same helper). Proposed home: `libs/shared/testing` (generic).
10. **`nonRelativeImports`, `nonSpecSources`**, in `domain-error.spec.ts`. Stand in for: the module specifiers a source imports that are neither relative nor Node built-ins, and a library's non-spec sources. Used by: "its sources import no other workspace library and no third-party package", "the import check detects a workspace or third-party import (fixture)". Near-miss: none. Found in a test module: no. Proposed home: `libs/shared/testing` (generic).
11. **`nxProject`**, in `domain-error.spec.ts`. Stands in for: Nx's view of a project through `nx show project --json`. Used by: test 29. Near-miss: none. Found in a test module: `libs/shared/infrastructure/src/project.spec.ts` (`nx` and `parseJson`). Proposed home: `libs/shared/testing` (generic).
12. **`HabitNotFound`** (and the test-local `Teapot` and `Example` classes), in `domain-error.spec.ts`. Stand in for: `DomainError` subclasses. Used by: tests 27, 28, 29, "each of the four kinds is accepted: %s", "code and message are strings, and a domain error has no stack". Near-miss: none. Found in a test module: no. Proposed home: none — `libs/shared/testing` may not depend on `@basis/shared-domain`, and the classes are the subject of the scenarios.

## Baseline

**Before this pass wrote any test** (the earlier pass's `config.spec.ts` already present, untracked):

- Unit, full: `pnpm nx run-many -t test --skip-nx-cache` — 285 tests passed in 6 projects (api 9, shared-testing 26, shared-infrastructure 33, change-scope 30, shared-core 18, delivery 169). `apps/api/src/config/config.spec.ts` failed to load: `Cannot find module './index.js'` (target absent).
- End-to-end, full: `pnpm nx e2e api-e2e` — 14 tests passed in 3 files.

**After writing**, run with `--skip-sync` (unresolved question 4); the other five projects unchanged and green:

- `api:test`: `config.spec.ts`, `logger.spec.ts` (`./index.js`) and `http-errors.spec.ts` (`@basis/shared-core` is the first import that cannot be resolved; `@basis/shared-domain`, `toResponse` and `zod` are also absent) fail to load: target absent, so their assertions have not run. In `environment-access.spec.ts`, 4 fail because the code ran and produced the wrong value (ESLint reports 0 errors): the scenario 9 test, dot access, destructuring, root of `apps/api/src`. 5 pass on their first run: scenario 10, migration process, spec, outside `apps/api`, control. Investigated: no `process.env` restriction exists yet, so nothing is reported anywhere. These tests can tell only an over-broad restriction from a correct one, and each is paired with a red "reported" test over the same virtual source. The 9 earlier `api` tests still pass.
- `domain-error.spec.ts`: not collected — the `shared-domain` project does not exist (target absent at project level).
- `api-e2e` (19 tests: 14 existing, 5 new): the 14 existing tests pass. `json-logs.spec.ts` › scenario 11 fails because the code ran and produced the wrong value: Nest's text line `[Nest] … LOG [NestFactory] Starting Nest application...` is not JSON. In `startup-configuration.spec.ts`: "every invalid variable is named in the output" fails the same way (output names `DATABASE_URL` only); "what the refused API writes is JSON lines" fails the same way; "an invalid port is refused by name …" fails the same way. **"an invalid port stops the API" passes on its first run.** Investigated: the pre-change build starts Nest, then `listen(NaN)` throws `RangeError [ERR_SOCKET_BAD_PORT]`, exiting 1 without answering. `ERR_SOCKET_BAD_PORT` contains `PORT`, and nothing echoes the password or the port value. So the scenario's literal assertions are already satisfied, by accident. This passing test is not coverage on its own; the derived word-boundary test beside it discriminates.

Red-at-authoring record (the change's tests that ran and are red on the property they assert): scenario 9 and its derived forms (the restriction is absent); scenario 11 (logs are text); "every invalid variable is named in the output" (`PORT` not named when `DATABASE_URL` is also missing); "an invalid port is refused by name" (`PORT` named only inside `ERR_SOCKET_BAD_PORT`); "what the refused API writes is JSON lines".
