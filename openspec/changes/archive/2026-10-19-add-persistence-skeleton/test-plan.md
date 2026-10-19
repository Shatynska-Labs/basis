# Test plan: add-persistence-skeleton

Derived by `change-test-writer` from the delta specs of the plan committed as `3fa8fcd`, before implementation. Not an artifact the OpenSpec schema defines: `openspec instructions apply` does not surface it. Tests trace to the scenarios; where they rest on an interface the design does not name, the assumption is listed under _Unresolved project questions_.

Test files written (all new; no existing file was edited):

- `apps/api/src/database/database-url.spec.ts` (unit, `api:test`)
- `apps/api/src/database/database.module.spec.ts` (unit, `api:test`)
- `apps/api/src/test-targets.spec.ts` (unit, `api:test`)
- `apps/api/tests/integration/database.integration.spec.ts` (`api:integration`)
- `apps/api/tests/integration/migrate.integration.spec.ts` (`api:integration`)
- `apps/api/tests/integration/postgres.integration.spec.ts` (`api:integration`)
- `apps/api/tests/integration/global-setup.integration.spec.ts` (`api:integration`)
- `apps/api-e2e/src/database-startup.spec.ts` (`api-e2e:e2e`)
- `tools/delivery/src/render-env-database.spec.ts` (unit, `delivery:test`)
- `tools/delivery/src/check-compose-migrate.spec.ts` (unit, `delivery:test`)
- `tools/delivery/src/delivery-files-migrate.spec.ts` (unit, `delivery:test`)

How to select a test: unit `pnpm nx test <project> -- <file> -t "<name>"`; integration, once task 1.2 exists, `pnpm nx run api:integration -- <file> -t "<name>"` (or `cd apps/api && pnpm exec vitest run --config vitest.integration.config.mts <file> -t "<name>"`); e2e `cd apps/api-e2e && pnpm exec vitest run --config vitest.e2e.config.mts <file> -t "<name>"` after `pnpm nx build api`. Names below are the `-t` patterns.

## Baseline (before any test was written)

- Unit, full: `pnpm nx run-many -t test --skip-nx-cache` — 5 projects, all succeeded. `api`: no test files (exit 0). `delivery`: 6 files, 109 tests passed. `change-scope`: 30 passed. `shared-core`: 18 passed. `shared-testing`: 26 passed.
- End-to-end, full: `pnpm nx e2e api-e2e --skip-nx-cache` — 1 file, 7 tests passed.
- Integration: **no baseline could be taken** — no project has an `integration` target and no integration spec existed (task 1.2 creates the target); there was nothing to run.

## After writing (first run, before implementation)

- `delivery:test`, new files only: 20 failed, the rest passed. Every failure is an assertion on a value (state 1: the code ran and produced a wrong value), none an import or setup error.
- `api:test`: `test-targets.spec.ts` 2 failed on assertions (state 1: no `integration` target; the unit configuration collects `tests/integration/**`). `database-url.spec.ts` and `database.module.spec.ts` fail at import (`./database-url.js`, `./database.module.js` absent: state 2, assertions not yet executed). The four integration specs are currently collected by the unit configuration and fail at import (`@basis/shared-testing` not a dependency of `apps/api`, `./global-setup.js` absent: state 2). Once task 1.2 excludes them, they leave `api:test`.
- `api-e2e:e2e`: the two refusal tests fail (state 1: the API starts and keeps running without `DATABASE_URL`); the two startup tests pass (see _Tests passing on their first run_).
- Integration specs were never run against a server: the target, the dependencies and the setup they need do not exist yet (state 2 throughout).
- Typecheck: the new specs do not typecheck until the implementation exists (missing modules; `databasePassword` is an excess property of today's `renderEnv` input). Expected.

### Tests passing on their first run

Each is in the second situation (the code under test already exists), not an alarm:

- `check-compose-migrate.spec.ts`: "the resolved configuration matches (api and migrate)", "a Compose file from before migrations were delivered", "the resolved rule differs (with migrate declared)", "the resolved image differs (api's, with migrate declared)", "exits 0 when api and migrate match" — today's check reads `api` only, and these scenarios ask nothing of `migrate` beyond not being refused when it matches. They constrain the implementation not to over-refuse.
- `render-env-database.spec.ts`: "the rendered environment names a digest (with a database password)", "a malformed digest is refused (with a database password)" — the digest behaviour is unchanged; today's `renderEnv` ignores the extra input. They keep the revised digest scenarios covered once the password becomes required.
- `database-startup.spec.ts`: "an unreachable database at startup" and "opens no connection to the database DATABASE_URL names" — today's API holds no connection at all. They become discriminating once the database module exists: an eager connection fails the second; a startup that fails on an unreachable database fails the first.
- `delivery-files-migrate.spec.ts` "the checks themselves discriminate" (27 tests): fixture-driven discriminators; each negative fixture is refused, the well-formed fixtures pass.

## Scenarios and their tests

32 scenarios in the delta specs; 32 accounted for below, all covered. Classification: **S** specified (traces to the scenario or requirement text), **D** derived (inferred; listed with its basis).

### api-persistence (ADDED) — 11 scenarios

1. **No database URL** — `apps/api/src/database/database-url.spec.ts` "reading the configuration fails naming DATABASE_URL when it is" (unset, empty): throws /DATABASE_URL/ — S. Also `database.module.spec.ts` "the application refuses to start, naming DATABASE_URL" (unset, empty): creating the application context rejects /DATABASE_URL/ — S (requirement: "refuse to start"). Also `apps/api-e2e/src/database-startup.spec.ts` "the process exits non-zero naming DATABASE_URL" (unset, empty): exit not 0, output contains `DATABASE_URL` — S; that it exits within ~18 s rather than keeps running — D (a refusal has to end the process to be observable).
2. **A database URL is taken unchanged** — `database-url.spec.ts` "returns exactly the value DATABASE_URL holds" — S. `database.module.spec.ts` "the URL the connection is configured with is exactly DATABASE_URL": the pool's `options.connectionString` equals the value — S as to the value; D as to the observation point (pg.Pool's `options`, reached through Drizzle's `$client`).
3. **A query reaches the database** — `database.integration.spec.ts` "a query reaches the database": `current_database()` through the Drizzle database equals the database named in `DATABASE_URL` — S.
4. **Closing the API releases its connections** — `database.integration.spec.ts` "closing the API releases its connections": after `app.close()`, `pg_stat_activity` holds no `application_name = 'basis-api'` connection — S. Narrowed to the test's own database (`datname`) — D, so that specs running in parallel on the same server do not interfere. Before closing, at least one such connection is visible — D (shows the observation sees the API's connections at all). Polled for up to 5 s — D (a backend may outlive its client briefly).
5. **An unreachable database at startup** — `database-startup.spec.ts` "an unreachable database at startup: GET /health answers 200 with status \"ok\"": status 200, body `status` `"ok"` — S; the premise check that nothing listens on `127.0.0.1:9` — D. "starting and answering GET /health opens no connection to the database DATABASE_URL names": a listener at `DATABASE_URL`'s address receives no connection — S (requirement: "SHALL open no database connection while starting").
6. **An empty database is migrated** — `migrate.integration.spec.ts` "an empty database is migrated": `node dist/migrate.js` exits 0 — S; `drizzle.__drizzle_migrations` holds as many rows as `migrations/meta/_journal.json` has entries — S as to "one entry per migration in the history"; D as to where the record and the history are read (design decisions 4 and 5).
7. **A migrated database is migrated again** — `migrate.integration.spec.ts` "a migrated database is migrated again": exit 0 and the record's rows (`id`, `hash`, `created_at`) equal those before — S.
8. **The baseline creates nothing** — `migrate.integration.spec.ts` "the baseline creates nothing": no table outside `drizzle`, `pg_catalog`, `information_schema` — S (the schema of the migration record is `drizzle`, design decision 5); the record is non-empty — D (non-vacuity). "the history is not empty and starts with the baseline": journal has ≥ 1 entry — S ("starting with a baseline migration"); the first entry's tag matches /baseline/ — D (design decision 5's `--name baseline`).
9. **No database URL for the migration** — `migrate.integration.spec.ts` "no database URL" (unset — S; empty — S from the requirement text): exit not 0, output contains `DATABASE_URL` — S.
10. **An unreachable database** — `migrate.integration.spec.ts` "an unreachable database": URL `postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis`; exit not 0, output contains neither the password nor the URL — S; output is non-empty — D (design decision 4 prints a fixed sentence; makes the absence non-vacuous).
11. **A refused password** — `migrate.integration.spec.ts` "a refused password": the run's server with password `n0t-a-real-pa55word`; exit not 0, output contains neither — S; output non-empty — D.

### integration-testing (ADDED) — 5 scenarios

12. **The API has an integration target** — `apps/api/src/test-targets.spec.ts` "the API has an integration target": `pnpm nx show projects --with-target integration --json` includes `api` — S.
13. **The unit run leaves integration specs out** — `test-targets.spec.ts` "the unit run leaves integration specs out": `vitest list --config vitest.config.mts --filesOnly --json` in `apps/api` lists nothing under `tests/integration/` or ending `.integration.spec.ts` — S; integration specs exist on disk and the listing includes `src/test-targets.spec.ts` — D (non-vacuity). Observing the `test` target through `vitest list` over `vitest.config.mts` — D (see questions).
14. **The run's server** — `postgres.integration.spec.ts` "the run's server answers, and its major version is 18": `server_version_num / 10000 = 18` — S.
15. **Two fresh databases** — `postgres.integration.spec.ts` "two fresh databases are two different databases, each with no table in public": `current_database()` differs between the two URLs; each has 0 tables in `public` — S.
16. **The server cannot be started** — `global-setup.integration.spec.ts` "the setup rejects with the start error, and no connection URL is provided": rejects with the same error object, `provide` not called — S; the start function called once — D. Requirement-level, no scenario: "the setup provides the started server's URL and stops the server when the run ends" — provide called with `('postgresUrl', url)` and the returned teardown calls `stop` — S as to "give every spec … a connection URL" and "remove the container when the run ends"; D as to the mechanism (returned teardown, key name).

### api-delivery — 16 scenarios

MODIFIED **Both hosts run the same image, by digest** (as revised):

17. **The rendered environment names a digest** — `render-env-database.spec.ts` "holds IMAGE_DIGEST with exactly that value" (with a database password) — S.
18. **A malformed digest is refused** — `render-env-database.spec.ts` "renderEnv throws naming IMAGE_DIGEST", "the command writes no .env" (empty, `latest`, 63 hex characters; with a database password) — S.
19. **The Compose file has no tag** — `delivery-files-migrate.spec.ts` "has exactly two image references, api and migrate, each the digest, failing when unset": exactly the services `api` and `migrate` carry an image, each `ghcr.io/shatynska-labs/basis-api@${IMAGE_DIGEST:?…}` — S. Red at authoring on the property "two image references" (today: `["api"]`).

MODIFIED **What Compose resolves is checked before delivery** (as revised):

20. **The resolved configuration matches** — `check-compose-migrate.spec.ts` "the resolved configuration matches (api and migrate)" `{ ok: true }` — S; "exits 0 when api and migrate match" — S.
21. **A Compose file from before migrations were delivered** — `check-compose-migrate.spec.ts` "passes a configuration declaring only api" — S.
22. **The resolved rule differs** — `check-compose-migrate.spec.ts` "the resolved rule differs (with migrate declared)" (differs, absent): fails, reason /rule/i, neither host in the reason — S.
23. **The resolved image differs** — `check-compose-migrate.spec.ts` "fails naming the image when it is" (tag, another repository, another digest): fails, reason /image/i, not the image value — S.
24. **The resolved migration image differs** — `check-compose-migrate.spec.ts` "fails naming the service migrate's image when it is" (absent, tag, another repository, another digest): fails, reason /migrate/ and /image/i, not the value — S. "exits 1 on a differing migrate image, naming migrate's image and printing no value" — S (exit 1 — D, matching the existing command's convention). Requirement-level: "fails when a further service resolves to another image" — S ("and every other service it declares").

ADDED **Each delivery migrates the database before the API starts**:

25. **The migration runs once before the API** — `delivery-files-migrate.spec.ts` "migrate runs node dist/migrate.js once from .env on platform_edge, and api waits for it": command, `env_file` `.env`, network `platform_edge`, `restart` `"no"`, no `traefik*` label, health check disabled (`disable: true` or `test: ["NONE"]`), `api.depends_on.migrate.condition` `service_completed_successfully` — S. Accepting either Compose form of each field — D.
26. **The migration service is confined like the API** — `delivery-files-migrate.spec.ts` "migrate is read_only, drops ALL, sets no-new-privileges:true and declares no volume" — S.

ADDED **The database URL is rendered from the target's database password**:

27. **A password is rendered into the URL** — `render-env-database.spec.ts` "DATABASE_URL is exactly the URL with the password" (staging, production): the line is `DATABASE_URL="postgres://basis-api:3f9a0c@postgres:5432/basis-api"` — S (value from the scenario, quoting from the unmodified "Rendered values reach Compose unchanged").
28. **Characters a URL would otherwise interpret** — "the password is percent-encoded as a URL component": `postgres://basis-api:a%40b%3Ac%2Fd%25e@postgres:5432/basis-api` — S.
29. **No password** — "renderEnv throws naming DATABASE_PASSWORD for an empty password" — S; "the command fails naming DATABASE_PASSWORD and writes no .env when it is" empty — S, unset — D (unset treated as empty).
30. **The password is not printed** — "on success, neither stdout, stderr nor the outputs contain the password or DATABASE_URL" — S; the written `.env` contains the password — D (non-vacuity).

ADDED **The database password reaches a delivery from the Environment alone**:

31. **Both workflows pass the Environment's secret** — `delivery-files-migrate.spec.ts` "passes secrets.BASIS_API_DATABASE_PASSWORD as the database password and mentions it nowhere else" (deploy.yml, promote.yml): every `deliver-api` step passes `${{ secrets.BASIS_API_DATABASE_PASSWORD }}` as `database-password`; the secret's name occurs exactly once per delivery step — S; the input name `database-password` — D (design decision 6).
32. **The password reaches the rendering through env** — "declares database-password, interpolates it in no run body, and passes it to the rendering as DATABASE_PASSWORD": no `run:` contains `${{ … database-password … }}`; the step whose `run` mentions `render-env` has `env.DATABASE_PASSWORD: ${{ inputs.database-password }}` — S. "first step refuses an empty database-password": the first step, executed with every declared input `x` and `database-password` empty, exits non-zero — S; its output names the database password — D (design: "the refusal names the missing input"; it also distinguishes this refusal from a failure for another reason).

Static checks (25, 26, 31, 32, 19) are in the third situation: each has fixture-driven discriminators in "the checks themselves discriminate" that were run and refuse their negative fixtures. All are also red at authoring against the repository's files on the properties named in each test.

## Obsolete tests (candidates for human confirmation)

Searched within the test-path glob (`tools/delivery/src/*.spec.ts`, `apps/api-e2e/src/*.spec.ts`, every other `*.spec.ts`); no earlier `test-plan.md` was supplied. Every entry is a **candidate for human confirmation**, never a conclusion; none was edited or deleted.

1. `tools/delivery/src/delivery-files.spec.ts` — `-t "the Compose file has no tag"` ("deploy/api/docker-compose.yml's only image reference is the digest, failing when unset"). Superseded by: MODIFIED "Both hosts run the same image, by digest", scenario "The Compose file has no tag" (now exactly two references, `api` and `migrate`). Evidence: `composeImageProblems` reports `images.length !== 1`; it will fail once `migrate` is declared.
2. `tools/delivery/src/delivery-files.spec.ts` — `-t "the image check fails a fixture with a second image"`. Superseded by: the same delta. Evidence: it asserts that a second image reference is a problem, the rule the revision replaces. It keeps passing (it runs on a fixture), so it would silently go on asserting the superseded rule.
3. `tools/delivery/src/render-env.spec.ts` — `-t "the rendered environment names a digest"`, `-t "a malformed digest is refused"` (both `renderEnv throws` and `the command writes no .env`). Superseded by: MODIFIED "Both hosts run the same image, by digest" together with ADDED "The database URL is rendered from the target's database password" (scenario "No password"). Evidence: they call `renderEnv({ target, baseDomain, imageDigest })` and run the command without `DATABASE_PASSWORD`; rendering is now refused without a password, so the first fails, and the second passes or fails depending on whether the implementation checks the digest before the password. Revised coverage is in `render-env-database.spec.ts`.
4. `tools/delivery/src/render-env.spec.ts` — `-t "staging's rule"`, `-t "production's rule"`, `-t "a missing or malformed base domain"`, `-t "an unknown target"`, `-t "the command, on success"`. Superseded by: ADDED "The database URL is rendered from the target's database password" ("No password"). Evidence: same calls without a password. Their own requirements ("The address is built from the server and the base domain") are not in the delta: what is superseded is how they call the renderer, not what they assert. Task 4.1 plans to "update the existing render specs' calls for the new input"; that is a change to an existing test's arrangement, and the judgment is the implementer's. `-t "characters Compose would otherwise interpret"` (`renderLine`) is not affected.

Searched and **not** superseded: `tools/delivery/src/check-compose.spec.ts` (all tests). They bear on the MODIFIED "What Compose resolves is checked before delivery" but resolve a configuration declaring only `api`, which the revised requirement's "A Compose file from before migrations were delivered" keeps passing; their refusals for the rule and the image are unchanged. `apps/api-e2e/src/health.spec.ts` "health is reported with no external service available": not in the delta (`api-health` is unmodified); it keeps passing only if the e2e configuration sets `DATABASE_URL` (design decision 2, task 3.4), since `startApi` passes the inherited environment. Its comment ("passes the API nothing but PORT and APP_VERSION") becomes inaccurate; not a test change.

## Unresolved project questions

Each records the assumption taken and the tests that depend on it. The implementer may choose otherwise; a different choice turns the dependent tests into state 3 (broken import or call), and changing where a test takes an interface from is then a recorded change, never a change to what it asserts.

1. **The function reading `DATABASE_URL`** (design decisions 2 and 4 name none). Assumed `readDatabaseUrl(env)` exported from `apps/api/src/database/database-url.ts`, taking an environment record. Depends: `database-url.spec.ts`.
2. **The injection token of the Drizzle database** (design decision 1 names none). Assumed `DATABASE`, exported from `apps/api/src/database/database.module.ts`, resolving to the `drizzle-orm/node-postgres` database (whose `$client` is the `pg.Pool`). `AppModule` is assumed exported under that name from `apps/api/src/app.module.ts` (not read: implementation). Depends: `database.module.spec.ts`, `database.integration.spec.ts`.
3. **The `ProvidedContext` key for the run's URL** (design decision 8 names none). Assumed `postgresUrl`. Depends: every `apps/api/tests/integration/*.integration.spec.ts`.
4. **The global setup's interface.** Assumed: `apps/api/tests/integration/global-setup.ts` exports `setup` (or a default function) as `(project, start = startPostgres)`, `start()` resolving to `{ url, stop }`, the setup calling `project.provide('postgresUrl', url)` and returning a teardown function that calls `stop`. Depends: `global-setup.integration.spec.ts`.
5. **`renderEnv`'s new input name.** Assumed `databasePassword` beside `target`, `baseDomain`, `imageDigest`; the command's variable is `DATABASE_PASSWORD` (design decision 6). Depends: `render-env-database.spec.ts`.
6. **How the `test` target's collection is observed.** Assumed `pnpm exec vitest list --config vitest.config.mts --filesOnly --json` in `apps/api` reflects what `api:test` collects (Nx infers `test` from that file). Depends: `test-targets.spec.ts` "the unit run leaves integration specs out". The spec also runs `pnpm nx show projects` with `NX_DAEMON=false` from inside a test run.
7. **The action's first step is executed with only `${{ inputs.* }}` substituted.** Any other expression in that step makes the check throw (state 3). Today's first step contains none. Depends: `delivery-files-migrate.spec.ts` "first step refuses an empty database-password".
8. **No stack skill.** The library has no skill for TypeScript, Vitest or NestJS; tests follow the floor (`testing`) and the existing specs' idiom.
9. **Where integration specs live.** `AGENTS.md` names `libs/<context>/<lib>/tests/integration`; the design and the delta put these in `apps/api/tests/integration/`, which the integration glob `{apps,libs}/**/tests/integration/**` covers. Task 5.1 updates `AGENTS.md`.

## Obsolete tests: dispositions (implementer)

1. Deleted: `delivery-files.spec.ts` "the Compose file has no tag". Its scenario was revised to two image references, which `delivery-files-migrate.spec.ts` covers on the repository's file.
2. Deleted: the `'a second image'` case of "the image check fails a fixture with %s". It asserted the superseded one-image rule; the other cases (a tag, a default) remain.
3. and 4. Kept and rearranged: every `renderEnv` call and `runCommand` in `render-env.spec.ts` passes a database password (`DATABASE_PASSWORD = '3f9a0c'`), and nothing they assert changed. The digest cases still hold under the revised requirement; `render-env-database.spec.ts` covers the password itself.

## Missing shared arrangement

Dispositions (implementer) are recorded at the end of each entry.

The shared arrangement is `libs/shared/testing` (`@basis/shared-testing`), empty today (`export {}`). This change adds `startPostgres()` and `freshDatabase()` there (design decision 8, task 2.1); the integration specs import `freshDatabase` from it by that interface, and nothing else from it. Everything else is declared locally, one entry per declaration:

1. **`withObserver` and `apiConnections`** in `apps/api/tests/integration/database.integration.spec.ts`. Stands in for: a `pg` client of the test's own, connected to a URL and closed after use, and a `pg_stat_activity` count. Used by: "closing the API releases its connections". Near-miss: none (the shared arrangement holds no client helper; `freshDatabase` only creates a database). Not found in another test module. Proposed home: a generic `withClient(url, use)` in `@basis/shared-testing`. **Disposition: promoted** as `withClient(url, use, { applicationName })` in `@basis/shared-testing`; `withObserver` is now a one-line wrapper over it.
2. **`query`** in `apps/api/tests/integration/migrate.integration.spec.ts`. Stands in for: the same client-for-one-query helper. Used by: every test in that file reading the record or tables. Near-miss: none. Proposed home: the same `withClient` as entry 1. **Disposition: promoted**: the shared `withClient`, under a one-line local `query`.
3. **`queryOne`** in `apps/api/tests/integration/postgres.integration.spec.ts`. Stands in for: the same helper, returning the first row. Used by: "the run's server …", "two fresh databases …". Near-miss: none. Proposed home: the same `withClient` as entry 1. **Disposition: promoted**: the shared `withClient`, under a one-line local `queryOne`.
4. **`migrate`, `historyEntries`, `migrationRecord`** in `migrate.integration.spec.ts`. Stands in for: running `node dist/migrate.js` with a given environment; reading the drizzle-kit journal and `drizzle.__drizzle_migrations`. Used by: every test in that file. Near-miss: none. Proposed home: none in `@basis/shared-testing` (it holds generic helpers only and these are `apps/api`'s); keep local. **Disposition: kept** local: these helpers are specific to `apps/api`'s migration process and history, and the shared arrangement holds only generic helpers.
5. **`Executes`** (type) in `database.integration.spec.ts` and **`DrizzleWithPool`** (type) in `apps/api/src/database/database.module.spec.ts`. Stands in for: the shape of the Drizzle database under the `DATABASE` token. Used by: those files' tests. Near-miss: none. Proposed home: none; once the implementation exports a type for the token, the tests may take it from there. **Disposition: kept**: the specs observe the pool through Drizzle's `$client` and `execute`, a narrower shape than the exported `Database` type, and that narrowness is deliberate.
6. **`fakeProject`** in `apps/api/tests/integration/global-setup.integration.spec.ts`. Stands in for: Vitest's `TestProject.provide`. Used by: both tests in that file. Near-miss: none. Proposed home: none to propose (one consumer). **Disposition: kept**: one consumer.
7. **`freePort`, `refusesConnections`, `startApi`, `stop`, `awaitHealth`** in `apps/api-e2e/src/database-startup.spec.ts`. Stands in for: starting the built API (`apps/api/dist/main.js`) as a process with an environment set in full, waiting for `/health` or for exit, and stopping it. Used by: every test in that file. Near-miss: `apps/api-e2e/src/support/api-process.ts` (`startApi({ appVersion })`, interface seen through `health.spec.ts`; the file itself is outside the read set and was not opened). It is not part of the dispatched shared arrangement, it takes no `DATABASE_URL` or other environment, and it exposes neither the exit code nor the output the refusal tests need. Not found in another test module. Proposed home: an extension of `apps/api-e2e/src/support/api-process.ts` (environment overrides, exit and output), not `@basis/shared-testing`. **Disposition: kept** local. `api-process.ts`'s `startApi` is the interface `deploy-api-skeleton`'s derived tests rely on: it waits for `/health` and rejects when the process exits. The refusal tests observe exactly that exit, so extending the harness would change its contract for one consumer.
8. **`runCommand` and `lineOf`** in `tools/delivery/src/render-env-database.spec.ts`. Stands in for: running `render-env.ts` in a temporary directory and reading `.env` and `GITHUB_OUTPUT`; selecting a `.env` line. Used by: every test in that file. Found in test module: `tools/delivery/src/render-env.spec.ts` (same helpers; the local copy drops the file mode). Near-miss: none in the shared arrangement. Proposed home: none in `@basis/shared-testing` (delivery-specific); a test-support module in `tools/delivery` is the implementer's call. **Disposition: kept**: specific to delivery. Tools are outside the shared arrangement's reach (`share-the-test-arrangement` non-goal), and creating a test-support module for `tools/delivery` is a testing-strategy decision.
9. **`resolved`, `check`, `reasonOf`** in `tools/delivery/src/check-compose-migrate.spec.ts`. Stands in for: a `docker compose config --format json` configuration with `api` and optionally `migrate` or further services. Used by: every test in that file. Found in test module: `tools/delivery/src/check-compose.spec.ts` (a narrower `resolved` with `api` only, and `reasonOf`). Near-miss: none in the shared arrangement. Proposed home: none in `@basis/shared-testing` (delivery-specific). **Disposition: kept**, for the reason given in entry 8.
10. **`servicesOf`, `labelKeys`, `COMPOSE_IMAGE`, `stepsOf`, `runFirstStepWithoutPassword`** and the check functions in `tools/delivery/src/delivery-files-migrate.spec.ts`. Stands in for: parsing the Compose, workflow and action files and executing the action's first step. Used by: every test in that file. Found in test module: `tools/delivery/src/delivery-files.spec.ts` (`servicesOf`, `labelOf`, `COMPOSE_IMAGE`, and `runBeforeCheckout`, which this file's step executor resembles). Near-miss: none in the shared arrangement. Proposed home: none in `@basis/shared-testing` (delivery-specific). **Disposition: kept**, for the reason given in entry 8.
11. **`run`, `filesUnder`** in `apps/api/src/test-targets.spec.ts`. Stands in for: running a workspace command synchronously and listing files under a directory. Used by: both tests in that file. Near-miss: none. Proposed home: none to propose (one consumer; trivial). **Disposition: kept**: one consumer, and trivial.
