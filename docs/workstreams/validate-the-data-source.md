# `validate-the-data-source`

**Goal**: know which metrics the reference device (Galaxy Watch through Samsung Health) actually gives through Health Connect, so Phase 1's ingestion and the habit rules are built on data that exists (`docs/product/05-roadmap.md` Phase 0).

**Done when**: every step is archived, and `record-phase-0-findings`'s record confirms or adjusts ADR-0001 and answers open questions 1 and 2 of `docs/product/06-risks-and-open-questions.md`.

**Steps**:

1. `validate-health-connect-data` — the temporary intake and its summary, fed by HC Webhook.
2. `record-phase-0-findings` — read the summary after several days of data and record what Health Connect provides.

**Not in scope**: removing the temporary intake, which belongs to `reach-the-calibration-period`; background sync under battery optimization (roadmap Phase 0), which matters for Basis's own client and is verified by hand with `sync-health-connect-from-the-mobile-app` in `reach-the-calibration-period`.

**Open questions**: `nothing`.

**Decisions**: [ADR-0001](../adr/0001-health-connect-as-data-source.md); `docs/product/06-risks-and-open-questions.md`.

**Opened**: 2026-10-24, by the operator, through `adopt-workstreams`.
