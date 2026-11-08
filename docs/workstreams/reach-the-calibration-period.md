# `reach-the-calibration-period`

**Goal**: device data reaches the server through Basis's own client and idempotent ingestion, stored where its loss is not tolerated, so the calibration period can start (`docs/product/05-roadmap.md` Phase 1 outcome, PRD US-4).

**Done when**: production's `DATABASE_URL` points at the storage `choose-durable-data-storage` chose; the archived record of `sync-health-connect-from-the-mobile-app` records the operator's observation that the reference device's data reached production through the mobile client and its ingestion; and every step is done.

**Steps**:

1. `add-identity-profile` — the user's time zone and heart-rate zone parameters.
2. `choose-durable-data-storage` — where durable data lives, in ADR-0014.
3. `move-to-durable-data-storage` — production's own PostgreSQL container, its two off-host backups and their rehearsed restores, a copy of the shared-instance database into it, then production's `DATABASE_URL`; staging stays in its shared instance.
4. `probe-the-database-before-delivery` — the infrastructure repository's probe before delivery.
5. `ingest-health-connect-metrics` — `metrics`' idempotent ingestion behind the Health Connect anti-corruption layer.
6. `sync-health-connect-from-the-mobile-app` — the Expo dev build reading Health Connect and syncing in the background, verified by hand under battery optimization on the reference device.
7. `retire-the-health-connect-intake` — remove Phase 0's temporary intake.

- **Not in scope**: `invite-users-to-sign-up`; ingestion keys for a third-party bridge (decision 3); the `habits` evaluation of the calibration period itself (roadmap Phase 2); provisioning Redis and Object Storage for photos (roadmap Phase 1's deployment line), which ADR-0014 decides and the phase that first uses each provisions.
- **Open questions**: open question 3 of `docs/product/06-risks-and-open-questions.md` (max heart rate), owed by `add-identity-profile`. Open question 2 of the same file (strength workout detection) and the other points ADR-0001's Phase 0 findings leave unverified (heart-rate sample density, resting heart rate, the writer per type, the full set of sleep stages, record shapes, resends, latency), owed by `sync-health-connect-from-the-mobile-app`.
- **Opened**: 2026-10-24, by the operator, through `adopt-workstreams`.

## Decisions

**1. Health Connect, read by Basis's own client.** [ADR-0001](../adr/0001-health-connect-as-data-source.md), confirmed by Phase 0's findings: data is read from Health Connect on Android, through Basis's own Expo client after Phase 0, behind an anti-corruption layer in `metrics` (`docs/product/04-domain-model.md` §1); Phase 1's scope is `docs/product/05-roadmap.md` Phase 1, less what Not in scope leaves out.

**2. Where data lives.** [ADR-0006](../adr/0006-data-and-infra.md) and [ADR-0014](../adr/0014-durable-data-storage.md) (`choose-durable-data-storage`): production's durable data in a PostgreSQL container of Basis's own with off-host backups; staging stays in its shared instance.

**3. No third-party bridge after Phase 1.** The operator, 2026-11-08: Basis's own mobile client is the only path for Health Connect data after Phase 1, so no long-lived ingestion key is issued for a bridge, and the session-token intake HC Webhook used is retired without a replacement for it. Why: ADR-0001 already plans the bridge for Phase 0 only, and Phase 0 showed HC Webhook unreliable, closing whenever its type list was edited, so heart rate, sleep and exercise never arrived.
