---
kind: change
waits_on: []
design_with: [retire-the-health-connect-intake]
workstream: reach-the-calibration-period
recorded_by: choose-durable-data-storage
re_checked: 2026-10-27
---

Move production's durable data out of `main-production`'s shared PostgreSQL instance into a PostgreSQL container of Basis's own, as ADR-0014 decides (`choose-durable-data-storage` design). It owes: the container in Basis's production Compose stack, its data on the host's data volume, at the shared instance's major version (18); a daily encrypted `pg_dump` and continuous WAL archiving with base backups, both off-host in Hetzner Object Storage in a location other than `hel1`, expired by bucket lifecycle rules (current and noncurrent versions, and delete markers) under a credential that can write but not delete, with the initial targets ADR-0014 states; verification of those bucket features before relying on them; a restore from each backup rehearsed on representative data and checked, both procedures written down, before durable data lands; a copy of the shared-instance `basis-api` database into the container (its users and any Phase 0 Health Connect deliveries), then production's `DATABASE_URL` pointed at the container. `Shatynska-Labs/infrastructure`'s `record-basis-api-durable-store` has put the host's side in place on `main-production`: `/mnt/main/applications/basis-api/postgres` (`999:999`, `0700`) for the container's data and `/mnt/main/applications/basis-api/metrics` (`999:999`, `0755`) for its backups' metrics, on a data volume that survives the server toggle; and the platform's backup-age alerts, which read `backup_last_success_timestamp_seconds{store, kind}` and `backup_max_age_seconds{store, kind}` from a `.prom` file there, written to a temporary name, `chmod 0644`, then renamed — the contract is in that repository's `docs/onboard-an-application.md` §3.1. Retiring production's shared-instance `basis-api` database, role and probe key is that repository's `finish-basis-api-s-move-to-its-own-database`, after this move. Staging stays in its shared instance. **It must not** drop or discard the shared-instance database's contents unless the operator decides so against `retire-the-health-connect-intake`.

- **Kind**: It owes `api-delivery` and `api-persistence` deltas, and an `integration-testing` delta should production's major version diverge.
- **Design with**: `retire-the-health-connect-intake`, which decides what happens to the copied deliveries.
- **Recorded by**: `choose-durable-data-storage`, which decided the storage and left provisioning to this step.
