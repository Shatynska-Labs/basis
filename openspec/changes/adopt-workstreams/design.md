## Context

ai-toolkit's `add-workstreams` added three things:

- `docs/workstreams/README.md`, which `project-init` seeds and which owns the workstream rules;
- a **Workstream** field in the seeded backlog shape;
- three v11 insertions in the workflow fragment (`rules/development-workflow.md`): the status row led by the workstream and its source order, a draft paragraph, and an archive sentence.

`project-init` writes none of these into a project that already has the files, so Basis adopts by hand. Basis's managed block, compared against ai-toolkit's v10 text at `e1018c2`, is identical: Basis's refinements of the workflow (the _Deployment_ section's staging and promotion) live outside the block. Basis's backlog preamble is an older seeded shape, without **Priority** (`add-a-backlog-priority`) or **Workstream**.

commerce-ops adopted the same concept in its own `adopt-workstreams` (archived 2026-10-24), which this change follows.

## Goals / Non-Goals

**Goals:**

- Sessions here follow v11: they name a change's workstream at draft, re-read it at archive, and lead the status row with it.
- Phases 0 and 1 of the roadmap have workstreams, and every backlog entry that is a step of one says so.

**Non-Goals:**

- Converting existing entries to the new fields beyond Workstream (Priority). An entry without Priority reads as `normal`, which is what every entry is today; the `backlog` skill's audit may add it later.
- Workstreams for Phase 2 onwards, or for the entries that serve no phase.
- Any code, test or behaviour change.

## Decisions

**1. The block is replaced, not patched.** Because Basis's block equals v10 verbatim, the text between the markers is replaced with ai-toolkit's v11 fragment body and the marker raised to `v11`. The result equals what `project-init` would write for v11. The _Deployment_ section is unchanged; its reading of `ship` still applies over v11's, which changes no `ship` transition.

**2. The backlog preamble is replaced by the seeded preamble** from ai-toolkit's `scripts/project-init`, verbatim. Entries keep their fields; none carries Depends on or another retired field.

**3. Two workstreams** (operator, 2026-10-24). Names are checked against every backlog heading, change directory and branch, local and remote; none is in use.

- **`validate-the-data-source`** — roadmap Phase 0.
  - **Goal**: know which metrics the reference device (Galaxy Watch through Samsung Health) actually gives through Health Connect, so Phase 1's ingestion and the habit rules are built on data that exists.
  - **Done when**: every step is archived, and `record-phase-0-findings`'s record confirms or adjusts ADR-0001 and answers open questions 1 and 2 of `docs/product/06-risks-and-open-questions.md`.
  - **Steps**:
    1. `validate-health-connect-data` — the temporary intake and its summary.
    2. `record-phase-0-findings` — read the summary after several days and record the findings.
  - **Not in scope**: removing the temporary intake, which belongs to `reach-the-calibration-period`; background sync under battery optimization (roadmap Phase 0), which matters for Basis's own client and is verified by hand with `sync-health-connect-from-the-mobile-app` in `reach-the-calibration-period`.
  - **Open questions**: `nothing`.
  - **Decisions**: ADR-0001; `docs/product/06-risks-and-open-questions.md`.
- **`reach-the-calibration-period`** — roadmap Phase 1's remaining work.
  - **Goal**: device data reaches the server through Basis's own client and idempotent ingestion, stored where its loss is not tolerated, so the calibration period can start (roadmap Phase 1 outcome, PRD US-4).
  - **Done when**: every step still listed is archived; production's `DATABASE_URL` points at the storage `choose-durable-data-storage` chose; and the archived record of `sync-health-connect-from-the-mobile-app` records the operator's observation that the reference device's data reached production through the mobile client and its ingestion.
  - **Steps**:
    1. `add-identity-profile` — time zone and heart-rate zone parameters.
    2. `choose-durable-data-storage` — where durable data lives, in an ADR.
    3. `move-to-durable-data-storage` — render `DATABASE_URL` and provision for the chosen storage on both hosts.
    4. `probe-the-database-before-delivery` — the infrastructure repository's probe before delivery.
    5. `ingest-health-connect-metrics` — `metrics`' idempotent ingestion behind the Health Connect anti-corruption layer.
    6. `sync-health-connect-from-the-mobile-app` — the Expo dev build reading Health Connect and syncing in the background, verified by hand under battery optimization on the reference device.
    7. `retire-the-health-connect-intake` — remove Phase 0's temporary intake.
    8. `issue-ingestion-keys` — only if a third-party bridge stays a source.

    The order is intended, not a wait; what one step must wait on is in its backlog entry's Waits on.

  - **Not in scope**: `invite-users-to-sign-up`; the `habits` evaluation of the calibration period itself (roadmap Phase 2); provisioning Redis and Object Storage (roadmap Phase 1's deployment line), which `choose-durable-data-storage` decides and the phase that first uses each provisions.
  - **Open questions**: does a third-party bridge stay a data source after Phase 1? If not, `issue-ingestion-keys` is removed from the steps and its entry deleted. Does `probe-the-database-before-delivery` still apply once `choose-durable-data-storage` decides? If Basis's data leaves the shared instance, the step is removed and its entry closed. PRD open question 3 (max heart rate), owed by `add-identity-profile`.
  - **Decisions**: ADR-0001, ADR-0006, `docs/product/05-roadmap.md` Phase 1, `docs/product/04-domain-model.md` §1.

Steps 3, 5 and 6 of `reach-the-calibration-period` (`move-to-durable-data-storage`, `ingest-health-connect-metrics`, `sync-health-connect-from-the-mobile-app`) are planned names, not recorded in the backlog: a planned step needs only its name. `move-to-durable-data-storage` is separate from `choose-durable-data-storage` because that entry scopes itself as the decision and its ADR, and names the move as rendering and provisioning work. No step description in either file states a step's status; status is derived, as the README directs. Each file carries **Opened**: 2026-10-24, by the operator, through `adopt-workstreams`.

The README has a workstream committed with the plan of the first change that advances it, or as work too small to be a change. Neither fits here: the README itself does not exist on the trunk until this change adds it, so the two files are opened by the change that adopts it, as commerce-ops's `adopt-workstreams` did.

**4. The Workstream line.** Each backlog entry named as a step above gains `**Workstream**: <name>`, placed before **Recorded by**. No other line of any entry changes. `reconcile-ai-suggestion-confirmation`, `move-portfolio-to-main-production-deploy-host`, `consolidate-spec-helpers`, `invite-users-to-sign-up` and `scope-the-secret-scan-to-its-own-history` serve neither and gain nothing.

**5. Pointers.** `docs/README.md` lists `docs/workstreams/`. `docs/product/05-roadmap.md` carries no progress, so it keeps its content; Phases 0 and 1 each gain a one-line pointer to their workstream for the order of the remaining work.

**6. Delivery.** Documentation and conventions only, not going to production, so its archive is a waiver of **promote**, on the operator's word, as `AGENTS.md`'s _Deployment_ section provides for a documentation-only merge. **Confirm** is observable at once: a new session in any working tree prints the v11 status row, and the `backlog` skill's **workstreams** operation reports the two workstreams with a status for every step.

## Risks / Trade-offs

- **Sessions already running read v10.** They print the old row until they re-read `AGENTS.md`; harmless.
- **`validate-health-connect-data` is in flight on its own branch.** Its archive will be the first to apply the v11 archive sentence; it advances `validate-the-data-source` and needs no edit of the workstream file, since its step reads done once archived.
- **Planned names may change.** The session opening a planned step may rename it; it then edits the workstream's Steps, a plan edit the README permits.
