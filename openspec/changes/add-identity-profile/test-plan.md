# Test plan: add-identity-profile

Derived by `change-test-writer` from the delta specs approved and committed at `01b678f` (`specs/identity-profile/spec.md`, ADDED; `specs/api-persistence/spec.md`, MODIFIED), before any implementation. This file is not an artifact the OpenSpec schema knows about: `openspec instructions apply` does not list it, so it has to be read on purpose. If the change's specs are revised, this file is replaced as a whole, not merged.

No implementation source was read. The tests were derived from the change's artifacts, the specifications under `openspec/specs/`, `AGENTS.md`, `docs/architecture/context-map.md`, and existing spec files within the test-path glob. Every new test file is additive. No existing test was edited, deleted or disabled.

## Test files written

All six are uncommitted in the working tree.

| File                                                                         | Runner selection                                                                                   | Level                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `libs/identity/contracts/src/profile.spec.ts`                                | `pnpm nx run identity-contracts:test -- src/profile.spec.ts`                                       | unit (contract)                         |
| `libs/identity/application/src/profile/heart-rate.spec.ts`                   | `pnpm nx run identity-application:test -- src/profile/heart-rate.spec.ts`                          | unit (pure functions)                   |
| `libs/identity/application/src/profile.spec.ts`                              | `pnpm nx run identity-application:test -- src/profile.spec.ts`                                     | unit (handlers, in-memory fakes)        |
| `apps/api/src/identity-profile.spec.ts`                                      | `pnpm nx run api:test -- src/identity-profile.spec.ts`                                             | unit (AppModule over HTTP, no database) |
| `apps/api/tests/integration/identity-profile.integration.spec.ts`            | `pnpm nx run api:integration -- tests/integration/identity-profile.integration.spec.ts`            | integration (HTTP, real PostgreSQL)     |
| `apps/api/tests/integration/identity-profiles-migration.integration.spec.ts` | `pnpm nx run api:integration -- tests/integration/identity-profiles-migration.integration.spec.ts` | integration (migrated schema)           |

To select a single test, append `-t "<test name substring>"` (Vitest), e.g. `pnpm nx run api:test -- src/identity-profile.spec.ts -t "GET /me/profile without"`. Below, tests are named as `<file key> › <test name>`. The file keys are: **C** = contracts spec, **H** = heart-rate spec, **A** = application handlers spec, **U** = apps/api unit spec, **I** = profile integration spec, **M** = migration integration spec.

## Tests per task

Each of these tests must go from failing to passing.

- **1.1 `isTimeZoneName`**: C › `identity-profile: isTimeZoneName` (all).
- **1.2 `UpdateProfileRequest`, `ProfileResponse`**: C › `identity-profile: UpdateProfileRequest` (all). `ProfileResponse`'s shape is asserted through A, I and U.
- **2.1 `heart-rate.ts`**: H (all).
- **3.1–3.4 ports, failure, `GetProfile`, `UpdateProfile`, exports**: A (all).
- **4.1, 4.4 `profiles` table and migration**: M (all).
- **4.2, 4.3 Drizzle adapters, `ProfileController`, `IdentityModule` bindings**: I (all) and U (all).
- **5.x documentation**: no tests. These tasks state no behavior.
- **6.1 verification**: the whole suite, including the obsolete candidate below.

## Scenario accounting

There are 23 `#### Scenario:` blocks in the delta specs (identity-profile: 21; api-persistence: 2). All 23 are accounted for below: 23 are covered and none is uncovered.

### identity-profile (ADDED)

| #   | Requirement › Scenario                                                             | Tests                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The caller's profile can be read › A new user's profile is empty                   | A › `a new user's profile is empty`; I › `a new user's profile is empty: GET /me/profile is 200 with every field null`                                                                                                          |
| 2   | › The profile needs a session                                                      | U › `GET /me/profile without an Authorization header…`, `PATCH /me/profile without an Authorization header…` (+2 header variants); I › `the profile needs a session: GET …`, `… PATCH …` (token naming no session)              |
| 3   | › Each user has their own profile                                                  | A › `each user has their own profile…`; I › `each user has their own profile: A sets Europe/Kyiv, B's timeZone is null`                                                                                                         |
| 4   | The profile is changed field by field › Only the fields present change             | A › `only the fields present change, and the answer is the profile as it now stands`; I › `only the fields present change…`, `the answer is in the shape GET /me/profile answers, and equals it`                                |
| 5   | › A field is cleared by null                                                       | A › `a field is cleared by null`; I › `a field is cleared by null…`; C › `enteredMaxHeartRate is cleared by null`                                                                                                               |
| 6   | › The time zone cannot be cleared                                                  | C › `the time zone cannot be cleared…`; I › `the time zone cannot be cleared: { "timeZone": null } is 400 and the profile is unchanged`                                                                                         |
| 7   | › An empty patch changes nothing                                                   | A › `an empty patch changes nothing…`; I › `an empty patch changes nothing: {} is 200 with the profile unchanged`; C › `an empty patch is accepted`                                                                             |
| 8   | The time zone is an IANA zone › A valid zone is accepted as submitted              | C › `Europe/Kyiv is a time zone name`, `Europe/Kyiv is accepted exactly as submitted…`; A › `a valid zone is answered as submitted…`; I › `a valid zone is accepted as submitted: Europe/Kyiv, not Europe/Kiev`                 |
| 9   | › An unknown zone or an offset is refused                                          | C › `Mars/Olympus is not a time zone name`, `+02:00 is not…`, `an unknown zone or an offset, Mars/Olympus / +02:00, is refused`; I › `an unknown zone or an offset, Mars/Olympus / +02:00, is 400 and the profile is unchanged` |
| 10  | The birth year is plausible › A plausible year is accepted                         | A › `a plausible year is accepted: on 2026-11-08, 1990`; I › `a plausible year is accepted: on 2026-11-08, 1990 is 200`                                                                                                         |
| 11  | › A year too recent is refused                                                     | A › `a year too recent is refused…`; I › `a year too recent is refused: … 2017 is 422 …, and the profile is unchanged`                                                                                                          |
| 12  | › A year too distant is refused                                                    | A › `a year too distant is refused: on 2026-11-08, 1905`; I › `a year too distant is refused…`                                                                                                                                  |
| 13  | › A non-integer is refused                                                         | C › `{ "birthYear": 1990.5 } is refused`, `{ "birthYear": "1990" } is refused`; I › `a non-integer is refused: { "birthYear": 1990.5 } / "1990" is 400`                                                                         |
| 14  | An entered maximum heart rate is within human range › A value in range is accepted | C › `the inclusive bound 230 is accepted`; I › `a value in range is accepted: 230`                                                                                                                                              |
| 15  | › A value out of range is refused                                                  | C › `99 / 231 / 180.5 is refused`; I › `a value out of range is refused: 99 / 231 / 180.5 is 400 and the profile is unchanged`                                                                                                  |
| 16  | The maximum heart rate in effect › The entered value wins                          | H › `the entered value wins…`; A › `the entered value wins…`; I › `the entered value wins…`                                                                                                                                     |
| 17  | › The formula applies without an entered value                                     | H › `the formula applies without an entered value…`; A › same; I › same                                                                                                                                                         |
| 18  | › Neither gives none                                                               | H › `neither gives none`; A › `neither gives none…`; I › `neither gives none…`                                                                                                                                                  |
| 19  | › The age follows the user's year                                                  | H › `at 2026-12-31T23:30:00Z it is already 2027 in Europe/Kyiv`, `the age follows the year given…`; A › `the age follows the user's year…`; I › `the age follows the user's year…`                                              |
| 20  | Heart-rate zones are fixed shares of the maximum › Zones of a maximum of 180       | H › `zones of a maximum of 180`; A › same; I › same                                                                                                                                                                             |
| 21  | › Bounds are rounded halves up                                                     | H › `bounds are rounded halves up…`; A › same; I › same                                                                                                                                                                         |

### api-persistence (MODIFIED: "The migration history starts with a baseline")

| #   | Scenario (as revised)               | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22  | The baseline creates nothing        | The text is unchanged by this delta. It stays covered by the existing `apps/api/tests/integration/migration-schemas.integration.spec.ts` › `the baseline creates nothing: no table in public, and every table outside the migration record is in the schema of a context` (`pnpm nx run api:integration -- tests/integration/migration-schemas.integration.spec.ts -t "the baseline creates nothing"`). That test is generic over the tables present, so `identity.profiles` falls under it with no new test. |
| 23  | Identity's tables are in its schema | M › `identity's tables are in its schema: the tables outside the migration record are exactly identity.profiles, identity.sessions, identity.users and metrics.health_connect_deliveries`                                                                                                                                                                                                                                                                                                                     |

## Assertion classification

**Specified** means the assertion traces to the delta-spec text. **Derived** means it was inferred, mostly from `design.md`, and nothing in the specs requires it. Every test name carries its classification in parentheses. The derived assertions, which the implementation step is free to question (questioning one is a change to a derived assertion, never a repair), are:

- C › `an offset with either sign, -05:00 / +0200, is not a time zone name`: design decision 5 (a leading `+`/`-` is refused).
- C › `europe/kyiv / UTC / America/New_York … is a time zone name`, `the empty string is not a time zone name`, `a lower-case name is kept as submitted`: design decision 5 (accepted by `Intl`, not case-normalised).
- C › `a field absent stays absent rather than becoming null`: design decision 3 (absent means unchanged).
- C › `unknown members are stripped`: design decision 4.
- C › `a time zone that is not a string is refused`, `a numeric string is refused`.
- C › `an integer outside the plausible range, 2017 / 1905, passes the contract…`: design decision 4 (the range is the handler's). This pins _where_ the 422 comes from. A contract that answered 400 for these would fail this test and the specified 422 scenarios together.
- H › `a zone behind UTC can still be in the previous year`, `the time zone in the profile does not change the result for a given year`.
- H › the ages and years in `a half rounds up…` and the value 185 in `a bound exactly a half rounds up…`. The rule "halves up" is specified; the particular inputs come from design decision 7.
- H › `for a maximum of %s, zones 1 to 5 are contiguous…`: the contiguity rule is specified. The inputs 150/185/199/230 are derived.
- A › `an empty patch writes nothing`, `a patch is written once, for the caller, with the fields present and the time of the clock`: design decision 3.
- A › `a refused birth year refuses the whole patch…`, the "nothing is written" line in `a year too recent is refused…`, and the `kind` `rule-violated` line in every 422 assertion: design decision 6.
- A › the `heartRateZones` of 185 inside `only the fields present change…`. These are computed from the specified rule, and 185 is the scenario's own value.
- I › `an empty patch of a new user's profile answers the empty profile`: design decision 2.
- I › `a lower-case zone is stored as submitted`: design decision 5.
- I › the "the clearing was stored, not only answered" line in `a field is cleared by null…`, and every `application/problem+json` content-type check on a 400/422. The content-type check comes from the existing `api-http-errors` spec, not this delta.
- U › the header variants `with a scheme other than Bearer` and `with an empty token`. These come from `identity-authentication`'s "Every route requires a session". The delta specifies only "without a valid session".
- M › `identity.profiles (derived from design decision 2)` (columns, primary key, foreign key with `ON DELETE CASCADE`).

**Deliberately untested** (each with its reason):

- "Basis SHALL NOT infer or default a user's time zone." This is covered only indirectly, by the empty-profile scenario (`timeZone` `null` for a new user) and by I › `each user has their own profile` (B's zone stays `null` after A sets one). No test can show the absence of inference in general.
- Concurrent patches (design decision 3: different fields both apply; for the same field, the later one wins). This is not in the delta specs, and a race is not reliably observable at this level.
- A session whose user was deleted (design decision 9). The design states this cannot occur today.
- The README routes and the documentation edits (tasks 5.x). They state no behavior.

## Red at authoring: what each failure establishes

These tests were derived before implementation, so every one of them is red at authoring. All of them are in the target-absent state. Their assertions have not yet been exercised against an implementation:

- C: `TypeError: Cannot read properties of undefined (reading 'safeParse')` / `isTimeZoneName is not a function`. The exports are absent (31 failed).
- H and A: `Cannot find module './heart-rate.js'` / `'./commands/update-profile/update-profile.command.js'`. The modules are absent (2 files failed to collect).
- U: `expected 404 to be 401`. The route `/me/profile` does not exist (4 failed).
- I: `404 … Cannot GET|PATCH /me/profile`. The route does not exist. Signing in through the fake verifier succeeded in every test, so the arrangement works.
- M: the table list lacks `identity.profiles`, and the column, key and reference queries return `[]` (4 failed). In total, 37 integration tests failed across I and M.

All of these tests execute the behavior they assert, so no fixture-driven discriminator is owed. A test that passes on its first run after a partial implementation is not evidence of anything until it has been seen to fail.

## Obsolete tests (candidates for human confirmation)

The search was limited to the test-path globs. It looked for tests asserting the table list that the MODIFIED delta supersedes. The superseded text (from `openspec/specs/api-persistence/spec.md`) is: "the tables outside the schema of the migration record are exactly `identity.users`, `identity.sessions` and `metrics.health_connect_deliveries`".

1. **Candidate for human confirmation:** `apps/api/tests/integration/metrics-migration-schemas.integration.spec.ts` › `api-persistence: the migration history starts with a baseline (as revised by validate-health-connect-data)` › `identity's tables are in its schema: the tables outside the migration record are exactly identity.users, identity.sessions and metrics.health_connect_deliveries`. Selection: `pnpm nx run api:integration -- tests/integration/metrics-migration-schemas.integration.spec.ts -t "identity's tables are in its schema"`.
   - **Superseded by:** `specs/api-persistence/spec.md` (MODIFIED "The migration history starts with a baseline", scenario "Identity's tables are in its schema"), which adds `identity.profiles` to the exact list.
   - **Evidence:** its assertion is `expect(await tablesOutsideRecord(url)).toEqual(['identity.sessions', 'identity.users', 'metrics.health_connect_deliveries'])`. That is the superseded exact list, and the test name quotes the superseded scenario. It will fail once task 4.4's migration exists. It was not edited. Whether to delete it or rewrite it to the new list (which M already asserts) is the implementer's call to confirm. The other tests in that file (`metrics.health_connect_deliveries` columns, foreign keys, index, defaults) are not superseded.

Other tests were examined and judged **not** obsolete. `migration-schemas.integration.spec.ts` (generic placement check), `postgres.integration.spec.ts` (`public` empty), and `migrate.integration.spec.ts` (reads the journal rather than a fixed count) all stay valid with a new table. The ADDED `identity-profile` delta supersedes nothing. This search covered the test-path globs only. A test outside them asserting the old list would not have been found.

## Unresolved project questions

1. **No stack skill.** The skill library has no Vitest, TypeScript or NestJS testing skill, so the tests rest on the `testing` floor plus the repository's existing specs as the idiom. Tests depending on this: all.
2. **Where the contracts are exported.** I assumed `UpdateProfileRequest` is a Zod schema (it is used through `.safeParse`), and that it and `isTimeZoneName` are exported from `libs/identity/contracts/src/index.ts`. I avoided importing `ProfileResponse` because whether it is a type or a schema is not stated. Depending on this: C (all).
3. **`heart-rate.ts` signatures.** I took `currentYear(now, timeZone)` and `heartRateZones(bpm)` as design decision 7 states them. I assumed `maxHeartRate(profile, year)` takes the stored profile `{ timeZone, birthYear, enteredMaxHeartRate }`, because the design does not type `profile`. A narrower parameter type would fail `typecheck` on the extra `timeZone` key, not the test run. Depending on this: H › `identity-profile: maxHeartRate` (all).
4. **Handler layout and construction.** I assumed the following, following identity's existing handlers:
   - the query lives at `queries/get-profile/get-profile.{query,handler}.ts` and the command at `commands/update-profile/update-profile.{command,handler}.ts`;
   - they are constructed as `new GetProfile(userId)` and `new UpdateProfile(userId, patch)`;
   - the handlers are constructed as `new GetProfileHandler(profileReader, clock)` and `new UpdateProfileHandler(profileRepository, profileReader, clock)`;
   - `execute` resolves to a `Result` whose success value is the `ProfileResponse`-shaped profile and whose failure carries `kind` and `code`.

   If the implementation picks other names or another argument order, the import or construction must be adjusted. That changes where the arrangement comes from, never what is asserted. Depending on this: A (all).

5. **Port shapes.** I assumed `ProfileReader.profileOf(userId)` resolves to `{ timeZone, birthYear, enteredMaxHeartRate }` with `null`s, and that `ProfileRepository.update(userId, patch, at)` resolves to nothing, with `patch` holding only the present fields (design decisions 3 and 8). Depending on this: A (all).
6. **The profile handlers read the same `Clock` token.** I assumed this is the token identity's existing specs override via `overrideProvider(Clock)`. Depending on this: I › every test dated 2026-11-08 or 2026-12-31 (the plausibility, formula and age tests).

The shared arrangement's location is recorded in `AGENTS.md`, and so is the rule that port fakes stay in the spec. Neither raises a question.

## Missing shared arrangement

The dispatch named `libs/shared/testing` (`@basis/shared-testing`: `startPostgres`, `freshDatabase`, `withClient`). It holds no near-miss for anything below: it holds only the PostgreSQL helpers, which I and M use directly. `AGENTS.md` keeps port fakes declared in the spec that uses them "until a change decides where such fakes live". That is why no entry below proposes a home in `libs/shared/testing` for an identity port fake. That library also depends on no workspace library, so it could not import identity's port types.

| Declared name                                     | Declared in | Stands in for                                                             | Used by                                          | Near-miss in shared arrangement                                | Found in                                                                                                            | Proposed home                                                                                                                                                              |
| ------------------------------------------------- | ----------- | ------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile` (builder)                               | H           | a stored profile value `{ timeZone, birthYear, enteredMaxHeartRate }`     | H › `identity-profile: maxHeartRate` (all)       | none                                                           | —                                                                                                                   | none: identity-specific value; `libs/shared/testing` holds generic helpers only                                                                                            |
| `StoredProfile`, `Patch`, `EMPTY`                 | A           | the stored-profile and patch types of `ProfileReader`/`ProfileRepository` | A (all)                                          | none                                                           | —                                                                                                                   | none: the implementation's own types should replace them once they exist (import from `./ports.js`)                                                                        |
| `memoryProfiles`                                  | A           | in-memory fake of `ProfileReader` and `ProfileRepository`                 | A (all)                                          | none                                                           | —                                                                                                                   | none: per `AGENTS.md`, port fakes stay in the spec                                                                                                                         |
| `fixedClock`                                      | A           | fake of identity's `Clock` port                                           | A (all)                                          | none                                                           | `libs/identity/application/src/handlers.spec.ts`                                                                    | none: port fake, per `AGENTS.md`. It now exists in two specs                                                                                                               |
| `migrate`                                         | I, M        | running `node dist/migrate.js` from `apps/api`                            | I (all, in `beforeAll`), M (all, in `beforeAll`) | none (`freshDatabase` makes the database; nothing migrates it) | `apps/api/tests/integration/migrate.integration.spec.ts` (also copied in four other integration specs)              | none in the named shared arrangement: it is `apps/api`-specific, and `libs/shared/testing` is generic. An `apps/api`-local test support module would be a project decision |
| `tablesOutsideRecord`                             | M           | a query listing the non-system tables                                     | M › `identity's tables are in its schema…`       | none (`withClient` is used inside it)                          | `apps/api/tests/integration/migration-schemas.integration.spec.ts`, `metrics-migration-schemas.integration.spec.ts` | as for `migrate`                                                                                                                                                           |
| `GoogleAccount`, `RefusedIdToken`, `fakeVerifier` | I           | fake of `GoogleIdTokenVerifier` and its failure                           | I (all, through `newUser`)                       | none                                                           | `apps/api/tests/integration/identity-authentication.integration.spec.ts`                                            | none: port fake, per `AGENTS.md`                                                                                                                                           |
| `fakeClock`                                       | I           | fake of identity's `Clock` port                                           | I (all)                                          | none                                                           | `apps/api/tests/integration/identity-authentication.integration.spec.ts`                                            | none: port fake, per `AGENTS.md`                                                                                                                                           |

Disposition, to be recorded against each entry by the implementation step: _pending_.

## Baseline

I took a scoped baseline before writing any test, on Node 24.15.0, with Docker 29.9.1 available:

- `pnpm nx run-many -t test -p identity-application identity-contracts identity-infrastructure api --skip-nx-cache`: all green. identity-contracts had no test files (exit 0). identity-application: 1 file, 9 tests passed. identity-infrastructure: 2 files, 34 passed. api: 13 files, 122 passed.
- `pnpm nx run api:integration --skip-nx-cache`: 9 files, 69 tests passed, against Testcontainers PostgreSQL.

After the tests were written:

- The same unit run: identity-contracts 31 failed. identity-application: 2 new files failed to collect, and the 9 existing tests passed. api: 4 failed (all in `src/identity-profile.spec.ts`), 122 passed.
- `api:integration`: 37 failed (all in the two new files), and the 69 existing tests passed.

No previously passing test changed state. The new files pass `eslint` and are formatted with Prettier. `typecheck` was not run: it fails by design on the absent modules until the implementation exists.
