# Test plan: deploy-api-skeleton

Derived from `specs/api-health/spec.md` at commit `9ad877a`, before implementation, by an author who has not seen the implementation. This file is not an artifact the OpenSpec schema knows about; it does not appear among `openspec instructions apply`'s context files and must be read on purpose.

## Files written

- `apps/api-e2e/src/health.spec.ts` — the derived tests (plain Vitest + supertest, importing nothing from `apps/api`).
- `apps/api-e2e/src/support/api-process.ts` — the harness the tests use (tasks.md §0, design decision 4). The implementer conforms to its interface rather than adapting it.

No project configuration for `apps/api-e2e` (package.json, project.json, vitest config, tsconfig) was written; that is task 2.1. Nothing under `apps/api` was written.

## Harness interface

`startApi({ appVersion, startupTimeoutMs?, entry? }): Promise<ApiProcess>`

- Spawns `node <workspaceRoot>/apps/api/dist/main.js` (resolved from the harness file's own location, not the working directory) with `cwd` the workspace root, the inherited environment, `PORT` set to a free port, and `APP_VERSION` set to `appVersion` when it is a string (including `''`) or removed from the inherited environment when it is `undefined`.
- Resolves once `GET http://127.0.0.1:<port>/health` answers with any HTTP response; rejects, with the process's captured output, if the entry point does not exist, the process exits first, or 15 s pass.
- `ApiProcess`: `baseUrl`, `port`, `output()`, `stop(timeoutMs = 5000)` — sends `SIGTERM`, waits, falls back to `SIGKILL` after the timeout, and resolves with `{ code, signal, killed }`. No test asserts on that status (clean shutdown is a design property verified by task 1.3, not a spec scenario).
- What the implementation must therefore provide: a built `apps/api/dist/main.js` runnable by plain `node`, listening on `127.0.0.1:$PORT` (an all-interfaces bind satisfies this).
- `entry` exists so the harness can be pointed at another script; the tests do not use it.

## Scenarios

Six `#### Scenario:` blocks in the delta specs; six accounted for below. All deltas are `ADDED`.

Test identifiers are Vitest full names, selectable with `-t` (e.g. `pnpm nx e2e api-e2e -- -t "a build identifier is reported unchanged"` once the target exists, or `pnpm exec vitest run --root apps/api-e2e -t "<name>"`).

| #   | Requirement / Scenario                                                                                           | Covered by (file `apps/api-e2e/src/health.spec.ts`)                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The API reports that it is alive / A running API answers its health check                                        | `api-health: the API reports that it is alive, names its build, and carries nothing else > a running API answers its health check`                                                         |
| 2   | The health report names the running build / A build identifier is reported unchanged                             | `api-health: the API reports that it is alive, names its build, and carries nothing else > a build identifier is reported unchanged`                                                       |
| 3   | The health report names the running build / No build identifier is reported as unknown                           | `api-health: no build identifier is reported as unknown > no build identifier is reported as unknown: started with no build identifier` and `... : started with an empty build identifier` |
| 4   | The health report carries nothing else and asks for nothing / The health check needs no credentials              | `api-health: the API reports that it is alive, names its build, and carries nothing else > the health check needs no credentials`                                                          |
| 5   | The health report carries nothing else and asks for nothing / The body holds only status and version             | `api-health: the API reports that it is alive, names its build, and carries nothing else > the body holds only status and version`                                                         |
| 6   | The health report depends on nothing outside the process / Health is reported with no external service available | `api-health: the health report depends on nothing outside the process > health is reported with no external service available` (partial; see below)                                        |

Uncovered scenarios: none.

## Assertion classification

- **Specified**
  - S1: status `200`; `content-type` matches a JSON type; `body.status === "ok"`.
  - S2: started with `APP_VERSION=3f2c9e1`, `body.version === "3f2c9e1"`. The build identifier is passed as `APP_VERSION`: the spec says "build identifier", and design decision 2 binds it to that variable.
  - S3: started with `APP_VERSION` removed from the environment, and separately with it set to `''`, `body.version === "unknown"`.
  - S4: a request with no credentials (supertest sends none by default) gets `200`.
  - S5: the sorted keys of the body are exactly `["status", "version"]`.
  - S6: a freshly started process (started inside the test) answers `200` with `body.status === "ok"`.
- **Derived**
  - "A JSON content type" is read as `application/json` or `application/<x>+json`, with or without parameters (`/^application\/([\w.-]+\+)?json\s*(;|$)/i`). The spec does not name the media type.
  - S5 also asserts the body is a non-array object, as a precondition of reading its keys.
  - Harness readiness ("answers" = any HTTP response), the 15 s startup bound and the 20 s per-hook/test timeouts are the author's choices, not the spec's.
  - The S1, S2, S4 and S5 tests share one process started with `3f2c9e1`; S3 and S6 start their own. Design decision 4 allows a process per scenario group.
- **Deliberately untested / partially covered**
  - S6 shows that the API starts and answers in an environment that provides no such service: the e2e target starts no Testcontainers, and the harness passes nothing beyond the inherited environment, `PORT` and `APP_VERSION` (design decision 4: "shown by the run itself"). It does not show that services are _unreachable_. A developer machine running the `docker compose` PostgreSQL/Redis services on localhost would still pass, and so would an API that connected to them. A test that does prove unreachability would need either a network sandbox or knowledge of the API's configuration interface, and the API has none to configure. Recorded rather than strengthened; whoever adds the first external dependency should revisit this test.
  - Clean exit on `SIGTERM`, the default port `3000`, and the Docker/Compose healthchecks are design and task requirements, not spec scenarios. Tasks 1.3, 3.x and 4.x verify them by hand; no derived test covers them.

## Discrimination

Every test is in the first situation (target absent) and executes the behaviour it asserts against a real process, so no fixture-driven discriminator is owed. At authoring every test is red because the target is absent (state 2). That establishes nothing about the assertions yet; task 2.2 (status changed to `"up"` must fail the e2e target) is the planned check that they discriminate.

The harness was exercised outside the repository, against throwaway scripts in the session scratchpad (none committed, none under `apps/`): `APP_VERSION` was set to `abc`, set to `''`, and removed even when the parent environment had it set; `stop()` returned exit code 0 on a `SIGTERM`-honouring process and fell back to `SIGKILL` on one ignoring it; a process exiting early and a missing entry point were both rejected with a message.

## Obsolete tests

Not applicable: the change carries only `ADDED` deltas (new capability `api-health`), so no existing test is superseded.

## Unresolved project questions

1. **No stack skill exists for TypeScript/Vitest/NestJS/supertest** in the toolkit library. The tests rest on the language-agnostic floor alone. Affects all tests.
2. **Testcontainers.** `AGENTS.md` says API e2e tests run "on Testcontainers"; design decision 4 starts none because there is nothing to contain. Assumption: the design governs for this change. Affects S6.
3. **Import extension.** The existing specs mix `.js` (`libs/shared/core`) and `.ts` (`tools/change-scope`) relative imports. Assumption: `./support/api-process.js`, which Vitest resolves to the `.ts` file. Task 2.1's tsconfig must accept it (or the implementer reports a conflict rather than editing the test). Affects all tests.
4. **Module format of `apps/api-e2e`.** The harness uses `import.meta.url` to find the workspace root. Assumption: Vitest runs it as ESM, which it does regardless of the package's `type`. Affects all tests.
5. **Bind address.** The harness probes `127.0.0.1`. Assumption: the API binds all interfaces or IPv4 loopback, as Nest's `listen(port)` does by default. Affects all tests.

## Baseline

- **Unit suite, full:** `pnpm nx run-many -t test --skip-nx-cache` before any test was written: `shared-core:test` 18/18 passed, `change-scope:test` 30/30 passed, exit 0. The new files sit under `apps/api-e2e/**`, which the `test` target excludes, so this suite should be unaffected.
- **E2E target:** `pnpm nx e2e api-e2e` → `Cannot find project 'api-e2e'`, exit 1. The project and its target are absent (task 2.1), so no e2e baseline could be taken through the dispatched command.
- **After writing, run directly:** `pnpm exec vitest run --root apps/api-e2e` → the suite fails to load with `Cannot find package 'supertest'` (task 1.1), so no test executed. This is the target-absent state: the dependency, the project and `apps/api/dist/main.js` are all missing. Once 1.1 and 2.1 land and before `apps/api` is built, expect every test to fail in `beforeAll`/the test body with `built API not found at .../apps/api/dist/main.js`. That is still target-absent and is not evidence about the assertions.

## What the implementation must make pass

`pnpm nx e2e api-e2e` running all six tests listed above (seven test cases, S3 being two) green, with `pnpm nx run-many -t test` not running them (task 2.1).
