# `reach-the-calibration-period`

**Goal**: device data reaches the server through Basis's own client and idempotent ingestion, stored where its loss is not tolerated, so the calibration period can start (`docs/product/05-roadmap.md` Phase 1 outcome, PRD US-4).

**Done when**: every step still listed is archived; production's `DATABASE_URL` points at the storage `choose-durable-data-storage` chose; and the archived record of `sync-health-connect-from-the-mobile-app` records the operator's observation that the reference device's data reached production through the mobile client and its ingestion.

**Steps**:

1. `add-identity-profile` — the user's time zone and heart-rate zone parameters.
2. `choose-durable-data-storage` — where durable data lives, in an ADR.
3. `move-to-durable-data-storage` — render `DATABASE_URL` and provision for the chosen storage on both hosts.
4. `probe-the-database-before-delivery` — the infrastructure repository's probe before delivery.
5. `ingest-health-connect-metrics` — `metrics`' idempotent ingestion behind the Health Connect anti-corruption layer.
6. `sync-health-connect-from-the-mobile-app` — the Expo dev build reading Health Connect and syncing in the background, verified by hand under battery optimization on the reference device.
7. `retire-the-health-connect-intake` — remove Phase 0's temporary intake.
8. `issue-ingestion-keys` — a long-lived ingestion key, only if a third-party bridge stays a source.

The order is intended, not a wait; what one step must wait on is in its backlog entry's **Waits on**.

**Not in scope**: `invite-users-to-sign-up`; the `habits` evaluation of the calibration period itself (roadmap Phase 2); provisioning Redis and Object Storage (roadmap Phase 1's deployment line), which `choose-durable-data-storage` decides and the phase that first uses each provisions.

**Open questions**: does a third-party bridge stay a data source after Phase 1? If not, `issue-ingestion-keys` is removed from the steps and its entry deleted. Does `probe-the-database-before-delivery` still apply once `choose-durable-data-storage` decides? If Basis's data leaves the shared instance, the step is removed and its entry closed. Open question 3 of `docs/product/06-risks-and-open-questions.md` (max heart rate), owed by `add-identity-profile`.

**Decisions**: [ADR-0001](../adr/0001-health-connect-as-data-source.md), [ADR-0006](../adr/0006-data-and-infra.md), `docs/product/05-roadmap.md` Phase 1, `docs/product/04-domain-model.md` §1.

**Opened**: 2026-10-24, by the operator, through `adopt-workstreams`.
