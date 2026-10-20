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

## `share-the-database-connection`

`add-persistence-skeleton` gives `apps/api` a global Nest database module providing the `pg` pool and the Drizzle database under injection tokens declared in `apps/api/src/database/`. A context's `infrastructure` library cannot import from an app (ADR-0012 §7), so the first Drizzle repository has nowhere to take the token from. Decide where the token, and later ADR-0011's `TransactionManager` adapter, live (a shared infrastructure library is not in ADR-0012 §6's table, so it needs that table amended), and move them there.

**Kind**: `change`. It needs a decision on the library and amends ADR-0012's tables.

**Waits on**: `nothing` (`add-persistence-skeleton` is archived). Must be done by the first change that adds a Drizzle repository (`identity` or `metrics`, roadmap Phase 1).

**Design with**: `nothing`.

**Recorded by**: `add-persistence-skeleton`, which adds no repository and so had no consumer to design the location against.

**Re-checked**: 2026-10-19.

## `probe-the-database-before-delivery`

The infrastructure repository asks an application with a database in the shared instance to probe it before delivering (`Shatynska-Labs/infrastructure` `docs/onboard-an-application.md` §4.5): one `ssh` with a second, probe-only key, answering one of `window-open`, `unreachable`, `absent`, `credential-refused`, `empty`, `populated`. Both hosts already declare `basis-api`'s probe key. Without it, a reset shared instance surfaces as a failed `migrate` service with `password authentication failed`, indistinguishable from a stale secret. Add the probe to `.github/actions/deliver-api/action.yml` before delivery, matching the whole token set and refusing anything but `empty` and `populated`, with the table `drizzle.__drizzle_migrations`; store `BASIS_API_PROBE_SSH_KEY` in each Environment.

**Kind**: `change`. It owes an `api-delivery` delta and the operator's storing of the probe keys.

**Waits on**: `nothing` (`add-persistence-skeleton` is archived; the `migrate` service and `basis-api`'s databases exist on both hosts).

**Design with**: `nothing`.

**Recorded by**: `add-persistence-skeleton`, kept out to bound that change's deploy risk.

**Re-checked**: 2026-10-19.

## `consolidate-spec-helpers`

Several spec helpers are copied between test files because no change has moved them into `libs/shared/testing`: linting a virtual source against the root ESLint config (`libs/shared/testing/src/boundaries.spec.ts`, `libs/shared/infrastructure/src/boundaries.spec.ts`, `apps/api/src/config/environment-access.spec.ts`), reading a manifest's runtime dependencies (`libs/shared/core/src/lib/result.spec.ts`, `libs/shared/domain/src/lib/domain-error.spec.ts`), reading Nx's view of a project (`libs/shared/infrastructure/src/project.spec.ts`, `domain-error.spec.ts`), and checking that nothing listens at an address (`apps/api-e2e/src/database-startup.spec.ts`, `apps/api-e2e/src/json-logs.spec.ts`). Move each into `libs/shared/testing` (generic; it may take `eslint` as a dependency) or `apps/api-e2e/src/support/`, and move the specs onto it, changing only where they take their arrangement from.

**Kind**: `fix`. It moves test arrangement, owes no specification delta and needs no decision, though it touches specs of several archived changes.

**Waits on**: `nothing`.

**Design with**: `nothing`.

**Recorded by**: `add-api-cross-cutting-basics`, whose derived tests added the second or third copy of each; moving the existing copies edits other changes' tests, outside its scope.

**Re-checked**: 2026-10-20.
