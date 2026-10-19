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

Interim decision (operator, 2026-10-17): until then, Basis uses its own database in the production host's shared PostgreSQL instance, and everything it holds there is treated as data whose loss is tolerable.

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

## `share-the-test-arrangement`

The project has no shared test arrangement: no library holds the builders, fixtures and in-memory port fakes that specs need, so each spec declares its own, and copies drift from the interface they stand in for. Decide where shared arrangement lives (for example an Nx library under `libs/shared/` tagged for test use only, so `@nx/enforce-module-boundaries` keeps production code from importing it), move the fakes the specs already repeat into it, and record its location under _Testing Strategy_ in `AGENTS.md` as the shared test arrangement.

**Kind**: `change`. It decides the project's testing strategy, which is the operator's decision.

**Waits on**: `nothing`. Cheapest while the suite is small.

**Design with**: `nothing`.

**Recorded by**: `sync-ai-toolkit-workflow-v10`, which recorded the shared test arrangement as none when taking ai-toolkit's development-workflow v10; creating one is not a sync.

**Re-checked**: 2026-10-19.
