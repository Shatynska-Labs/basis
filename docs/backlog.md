# Backlog

Changes this project has identified but not yet opened, and what each depends on. An entry is deleted when its change is archived. Cite an entry by name, never by number.

## `reconcile-ai-suggestion-confirmation`

ADR-0007 states that LLM suggestions "always require human confirmation". The PRD disagrees: a plate score is applied at once and corrected afterwards if wrong (US-12, US-13; `docs/product/04-domain-model.md` §5; "the user never waits for the AI"), and only the weekly review's suggested goal change is accepted or rejected (US-15). Decide which holds and record it — an ADR superseding ADR-0007 in part, or a change to the PRD and domain model — then add the outcome to `AGENTS.md`'s Conventions, which today carry only what every source agrees on: deterministic logic in code, every AI assessment correctable, a goal change applied only once accepted.

**Argued in**: `integrate-the-context-draft`, whose code review found the conflict.

**Depends on**: nothing. Best done before the `nutrition` change (roadmap Phase 3).

## `choose-durable-data-storage`

ADR-0006 puts PostgreSQL, Redis/BullMQ and Object Storage "within the existing Hetzner infrastructure". The infrastructure repository forbids that for durable data: its shared PostgreSQL instance holds only data whose loss is tolerable, and any other store on the host needs a stated reason it needs no backup, or a logical backup written off the host and a rehearsed restore before it holds anything (`Shatynska-Labs/infrastructure`: `openspec/specs/iac-safety-hardening/spec.md`, _No Store on This Host Holds Data Requiring Backup_; `docs/onboard-an-application.md` §3.1, §4.3). Basis's metrics, daily statuses, goals and photos are durable. Decide where they live — an external managed service, or a dedicated store on the host with off-host backups and a rehearsed restore — and record it in an ADR superseding ADR-0006 in part. Redis and Object Storage are decided in the same ADR.

**Interim decision** (operator, 2026-10-17): until this is decided, Basis uses its own database in the production host's shared PostgreSQL instance, and everything it holds there is treated as data whose loss is tolerable. The infrastructure-side change that provisions that database records this classification, as `docs/onboard-an-application.md` §3.1 requires.

**Argued in**: the session that opened `deploy-api-skeleton`.

**Depends on**: nothing. Must be done before Basis stores data its user would not accept losing — at the latest, before the calibration period starts (roadmap Phase 1 outcome).
