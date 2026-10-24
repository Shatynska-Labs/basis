# Backlog

Changes this project has identified and not yet archived. Each entry is a change recorded here instead of being folded into the change that found it, or opened on a branch of its own.

An entry's heading is the change's name in kebab-case — the name its branch and change directory are expected to take, though the session that opens the change may rename it if the work turns out different. A fix takes the name as its branch's only. Refer to an entry only by that name.

The order of entries carries no meaning. What an entry waits on, and which entries share a design with it, it states in its own fields.

Keep an entry short: what is needed and why, naming files, specifications and changes as pointers. Leave out line numbers, census tables and step-by-step plans; they go stale first, and the session that takes the entry up redoes them.

Delete an entry when its change is archived, when the operator takes it as a fix rather than a change, when a change makes it obsolete, or when the operator decides the change will not be made. When a change is archived, also update the entries it unblocked or made stale, and set their **Re-checked** date. Keep this file when it has no entries.

An entry takes this shape:

```
## `change-name`

What the change is and why it is needed, written for a session that has not seen the work that found it.

**Kind**: `fix` or `change`, and why. A fix owes no specification delta, needs no decision from the operator, and fits one review sitting; anything else is a change, and says which delta it owes, which decision it needs, or that it is too large.

**Waits on**: `nothing`, or something that can be checked: a change by name, a person's answer, an event.

**Design with**: the entries that share a design with this one, by name, or `nothing`.

**Recorded by**: the change that identified it, and why it was not done there.

**Re-checked**: the date the entry was last verified against the repository.
```

## `reconcile-ai-suggestion-confirmation`

ADR-0007 states that LLM suggestions "always require human confirmation". The PRD disagrees: a plate score is applied at once and corrected afterwards if wrong (US-12, US-13; `docs/product/04-domain-model.md` §5; "the user never waits for the AI"), and only the weekly review's suggested goal change is accepted or rejected (US-15). Decide which holds and record it, in an ADR superseding ADR-0007 in part or a change to the PRD and domain model, then add the outcome to `AGENTS.md`'s Conventions, which today carry only what every source agrees on: deterministic logic in code, every AI assessment correctable, a goal change applied only once accepted.

**Kind**: `change`. It needs the operator's decision between the ADR and the PRD.

**Waits on**: `nothing`. Best done before the `nutrition` change (roadmap Phase 3).

**Design with**: `nothing`.

**Recorded by**: `integrate-the-context-draft`, whose code review found the conflict; deciding it was outside that change.

**Re-checked**: 2026-10-19.

## `choose-durable-data-storage`

ADR-0006 puts PostgreSQL, Redis/BullMQ and Object Storage "within the existing Hetzner infrastructure". The infrastructure repository forbids that for durable data: its shared PostgreSQL instance holds only data whose loss is tolerable, and any other store on the host needs a stated reason it needs no backup, or an off-host logical backup and a rehearsed restore before it holds anything (`Shatynska-Labs/infrastructure`: `iac-safety-hardening`, _No Store on This Host Holds Data Requiring Backup_; `docs/onboard-an-application.md` §3.1, §4.3). Basis's metrics, daily statuses, goals and photos are durable. Decide where they live, an external managed service or a dedicated store on the host with off-host backups and a rehearsed restore, and record it in an ADR superseding ADR-0006 in part, deciding Redis and Object Storage in the same ADR.

Interim decision (operator, 2026-10-17): until then, Basis uses its own database in the production host's shared PostgreSQL instance, and everything it holds there is treated as data whose loss is tolerable. `add-persistence-skeleton` put it in place: a `basis-api` database in each host's shared instance, migrated on every delivery, holding no table yet. Moving to durable storage is a change of `DATABASE_URL`'s rendering and of provisioning, not of the migrations.

**Kind**: `change`. It needs the operator's storage decision and an ADR.

**Waits on**: `nothing`. Must be done before Basis stores data its user would not accept losing: at the latest, before the calibration period starts (roadmap Phase 1 outcome).

**Design with**: `nothing`.

**Recorded by**: the session that opened `deploy-api-skeleton`; the storage decision was outside that change.

**Re-checked**: 2026-10-19.

## `move-portfolio-to-main-production-deploy-host`

`Shatynska-Labs` holds main-production's tailnet address twice: the organisation variable `DEPLOY_HOST`, which `portfolio`'s deploy reads, and `MAIN_PRODUCTION_DEPLOY_HOST`, named for its host so that more hosts can follow, which Basis reads (`deploy-api-skeleton` design decision 8). Move `portfolio`'s deploy to `vars.MAIN_PRODUCTION_DEPLOY_HOST`, confirm a deploy through it, then delete `DEPLOY_HOST` from the organisation after checking nothing else reads it. The change belongs to the `portfolio` repository; it is recorded here because Basis's change surfaced it. **It must not** delete `DEPLOY_HOST` before `portfolio` reads the new name, or `portfolio`'s deploy breaks.

**Kind**: `fix`, made in `Shatynska-Labs/portfolio`, then an organisation-variable deletion.

**Waits on**: `nothing`. `MAIN_PRODUCTION_DEPLOY_HOST` now exists in the organisation; `portfolio`'s `deploy.yml` still reads `vars.DEPLOY_HOST`.

**Design with**: `nothing`.

**Recorded by**: the session that opened `deploy-api-skeleton`, when the operator chose organisation-level deploy settings; it is another repository's work.

**Re-checked**: 2026-10-19.

## `probe-the-database-before-delivery`

The infrastructure repository asks an application with a database in the shared instance to probe it before delivering (`Shatynska-Labs/infrastructure` `docs/onboard-an-application.md` §4.5): one `ssh` with a second, probe-only key, answering one of `window-open`, `unreachable`, `absent`, `credential-refused`, `empty`, `populated`. Both hosts already declare `basis-api`'s probe key. Without it, a reset shared instance surfaces as a failed `migrate` service with `password authentication failed`, indistinguishable from a stale secret. Add the probe to `.github/actions/deliver-api/action.yml` before delivery, matching the whole token set and refusing anything but `empty` and `populated`, with the table `drizzle.__drizzle_migrations`; store `BASIS_API_PROBE_SSH_KEY` in each Environment.

**Kind**: `change`. It owes an `api-delivery` delta and the operator's storing of the probe keys.

**Waits on**: `nothing` (`add-persistence-skeleton` is archived; the `migrate` service and `basis-api`'s databases exist on both hosts).

**Design with**: `nothing`.

**Recorded by**: `add-persistence-skeleton`, kept out to bound that change's deploy risk.

**Re-checked**: 2026-10-19.

## `consolidate-spec-helpers`

Several spec helpers are copied between test files because no change has moved them into `libs/shared/testing`: linting a virtual source against the root ESLint config (`libs/shared/testing/src/boundaries.spec.ts`, `libs/shared/infrastructure/src/boundaries.spec.ts`, `apps/api/src/config/environment-access.spec.ts`), reading a manifest's runtime dependencies (`libs/shared/core/src/lib/result.spec.ts`, `libs/shared/domain/src/lib/domain-error.spec.ts`), reading Nx's view of a project (`libs/shared/infrastructure/src/project.spec.ts`, `domain-error.spec.ts`), and checking that nothing listens at an address (`apps/api-e2e/src/database-startup.spec.ts`, `apps/api-e2e/src/json-logs.spec.ts`). `add-identity-authentication` added more: a capturing Nest logger (`apps/api/src/http/http-errors.spec.ts`, `http-errors-unauthenticated.spec.ts`, `apps/api/tests/integration/identity-authentication.integration.spec.ts`), capturing standard output (`apps/api/src/logging/logger.spec.ts`, the same integration spec), running the migration process (`apps/api/tests/integration/migrate.integration.spec.ts`, `identity-authentication.integration.spec.ts`, `migration-schemas.integration.spec.ts`), running the rendering command (`tools/delivery/src/render-env*.spec.ts`), and parsing the built API's JSON log lines (`apps/api-e2e/src/identity-authentication.spec.ts`). `validate-health-connect-data` added more: a valid HC Webhook delivery of a given size (`apps/api/src/health-connect-intake.spec.ts`, `apps/api/tests/integration/health-connect-intake.integration.spec.ts`, `apps/api-e2e/src/health-connect-intake.spec.ts`), a JSON object of a given size (`health-connect-intake.spec.ts`, `apps/api/src/http/http-errors.spec.ts`), and further copies of running the migration process (`health-connect-intake.integration.spec.ts`, `metrics-migration-schemas.integration.spec.ts`), and of rows from a query, the capturing Nest logger and capturing standard output (`health-connect-intake.integration.spec.ts`). Move each into `libs/shared/testing` (generic; it may take `eslint` as a dependency) or `apps/api-e2e/src/support/`, and move the specs onto it, changing only where they take their arrangement from.

**Kind**: `fix`. It moves test arrangement, owes no specification delta and needs no decision, though it touches specs of several archived changes.

**Waits on**: `nothing`.

**Design with**: `nothing`.

**Recorded by**: `add-api-cross-cutting-basics`, whose derived tests added the second or third copy of each; moving the existing copies edits other changes' tests, outside its scope.

**Re-checked**: 2026-10-22 (by `validate-health-connect-data`).

## `add-identity-profile`

`identity`'s profile: the user's time zone, which every day and week is computed in (Conventions, Time), and the heart-rate zone parameters `hr_zone_minutes` needs (`docs/product/04-domain-model.md` §1). PRD open question 3 (max heart rate from an age formula or entered by the user) is the operator's to answer. It extends `identity.users`, or adds a profile table, behind `GET /me` or a profile route.

**Kind**: `change`. It owes an `identity` delta and the operator's answer to open question 3.

**Waits on**: `nothing` (`add-identity-authentication`, archived, gives users an identity).

**Design with**: `nothing`.

**Recorded by**: `add-identity-authentication`, which the operator split into authentication first and the profile next.

**Re-checked**: 2026-10-21.

## `invite-users-to-sign-up`

Sign-up is restricted to the deployment's `SIGNUP_ALLOWED_EMAILS` (`add-identity-authentication` design decision 3), so admitting someone takes editing an Environment secret and a redeploy. Let an existing user create a single-use, expiring invitation link instead, so that a Google sign-in carrying a valid invitation creates the account. Decide who may invite (every user, or administrators named per deployment), and whether the allowlist stays as a bootstrap.

**Kind**: `change`. It owes an `identity-authentication` delta and the operator's decision on who may invite.

**Waits on**: `nothing`.

**Design with**: `nothing`.

**Recorded by**: `add-identity-authentication`, where the operator chose a configuration allowlist first and invitations later, to keep that change small.

**Re-checked**: 2026-10-21.

## `record-phase-0-findings`

Roadmap Phase 0's outcome: once the reference device (Galaxy Watch through Samsung Health) has sent several days of data through the temporary intake, read `GET /health-connect/deliveries/summary` on production and record what Health Connect provides: which metrics of `docs/product/04-domain-model.md` §1 can be automated (steps, heart-rate zones, workouts, sleep with stages, resting heart rate), which app and device write each, how strength workouts are recorded, and how late data arrives. Confirm or adjust ADR-0001, answer open questions 1 and 2 and revise risk R1 in `docs/product/06-risks-and-open-questions.md`, and note anything Phase 1's ingestion must handle (resends, aggregates, late records).

**Kind**: `change`. A documentation change carrying the operator's reading of the data and possibly an ADR adjustment.

**Waits on**: `validate-health-connect-data` in production, and several days of the bridge sending to it.

**Design with**: `retire-the-health-connect-intake`.

**Recorded by**: `validate-health-connect-data`, whose operator chose to keep the findings out of it, since they need days of data after it ships.

**Re-checked**: 2026-10-22.

## `retire-the-health-connect-intake`

`validate-health-connect-data` added a temporary intake: `POST /health-connect/deliveries` and `GET /health-connect/deliveries/summary` in `libs/metrics`, the table `metrics.health_connect_deliveries`, a 10 MB body limit for that route (`apps/api/src/http/body-parsers.ts`), and README instructions for HC Webhook. Phase 1's idempotent ingestion, with Health Connect translated in a driving anti-corruption layer, replaces it. Remove the routes, the summary and the body limit, decide whether the stored deliveries are kept, replayed into the new ingestion or dropped (a forward-only migration), and remove the README section.

**Kind**: `change`. It owes a `health-connect-intake` removal delta and the operator's decision on the stored deliveries.

**Waits on**: `record-phase-0-findings`, and Phase 1's Health Connect ingestion.

**Design with**: `record-phase-0-findings`.

**Recorded by**: `validate-health-connect-data`, which is temporary by design.

**Re-checked**: 2026-10-22.

## `issue-ingestion-keys`

The temporary intake authenticates HC Webhook with an ordinary 30-day session token pasted into the bridge (`validate-health-connect-data` design decision 1). If a third-party bridge stays a data source after Phase 1, beside or instead of Basis's own mobile client, give each user a long-lived, revocable key that is valid only for sending data, stored as a digest like sessions.

**Kind**: `change`. It owes an `identity-authentication` delta and the operator's decision that bridges remain a source.

**Waits on**: `record-phase-0-findings` and the Phase 1 decision on data sources.

**Design with**: `nothing`.

**Recorded by**: `validate-health-connect-data`, where the operator chose the session token for Phase 0, since ADR-0001's own client needs no separate key.

**Re-checked**: 2026-10-22.

## `keep-query-parameters-out-of-defect-logs`

Drizzle 0.45's `DrizzleQueryError` message is `Failed query: <sql>` followed by `params: <params>`, and `ProblemFilter` logs a defect's message and stack (`api-http-errors`). A failed query therefore writes its parameters to the log. `identity`'s session insert carries a session token's digest, which `identity-authentication` forbids logging, and its user upsert carries an email. `validate-health-connect-data` guarded only its own insert (`HealthConnectDeliveryNotStored`). Fix it once: have `ProblemFilter` log a `DrizzleQueryError` without its parameters (or log the SQL and the cause's code only), or wrap each repository's queries, and test that a failing insert logs no parameter.

**Kind**: `fix`. It restores what `identity-authentication` and `api-http-errors` already require, with no new delta, though it touches the filter every context relies on.

**Waits on**: `nothing`.

**Design with**: `nothing`.

**Recorded by**: `validate-health-connect-data`'s plan review, which found the exposure for its own insert; `identity`'s is outside that change.

**Re-checked**: 2026-10-22.

## `scope-the-secret-scan-to-its-own-history`

CI's `secrets` job checks out with `fetch-depth: 0`, which fetches every branch, and `gitleaks git` scans `--all` by default (`.github/workflows/ci.yml`). A false positive pushed on any branch therefore fails `secrets` on every pull request until its `.gitleaksignore` line reaches that pull request's branch, as `keep-query-parameters-out-of-defect-logs`'s fixture did to `fix-body-parser-and-multer-advisories`. Scan only the history the run judges (for a pull request, its head's ancestry, e.g. `--log-opts=HEAD`; for `main`, `main`), keeping the full-history guarantee for what reaches `main`. Also consider making `gitleaks` a required provisioning step, so the pre-commit hook catches such fixtures before they are pushed.

**Kind**: `fix`. It changes CI's scan scope, owes no specification delta, and fits one review sitting, unless the operator wants every branch scanned on purpose.

**Waits on**: `nothing`.

**Design with**: `nothing`.

**Recorded by**: `fix-body-parser-and-multer-advisories`, whose `secrets` check failed on another branch's fixture; changing CI was outside that fix.

**Re-checked**: 2026-10-24.
