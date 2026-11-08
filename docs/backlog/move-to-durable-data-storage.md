---
kind: change
waits_on: []
design_with: [retire-the-health-connect-intake]
workstream: reach-the-calibration-period
recorded_by: choose-durable-data-storage
re_checked: 2026-11-08
---

Move production's durable data out of `main-production`'s shared PostgreSQL instance into a PostgreSQL container of Basis's own, as ADR-0014 decides (`choose-durable-data-storage` design): the container in production's Compose stack at the shared instance's major version, the two off-host backups with the targets ADR-0014 states, the bucket features they rely on verified first, a restore from each rehearsed and written down before durable data lands, then a copy of the shared-instance `basis-api` database into the container and production's `DATABASE_URL` pointed at it. The host's side is in place on `main-production` (`Shatynska-Labs/infrastructure` `record-basis-api-durable-store`), and the backup metrics contract the platform's alerts read is that repository's `docs/onboard-an-application.md` §3.1. Retiring the shared-instance database, role and probe key afterwards is that repository's `finish-basis-api-s-move-to-its-own-database`. Staging stays in its shared instance. **It must not** drop or discard the shared-instance database's contents unless the operator decides so against `retire-the-health-connect-intake`.

- **Kind**: It owes `api-delivery` and `api-persistence` deltas, and an `integration-testing` delta should production's major version diverge.
- **Recorded by**: `choose-durable-data-storage`, which decided the storage and left provisioning to this step.
