## Context

Basis's API runs on two Hetzner hosts, `main-staging` and `main-production` (`hel1`), each with a platform stack holding one shared PostgreSQL instance. `add-persistence-skeleton` gave Basis a `basis-api` database in each host's shared instance, migrated on every delivery, under the operator's interim decision of 2026-10-17 that everything there is loss-tolerable. It now holds the `identity` and `metrics` schemas (`apps/api/migrations/`), including its users and any Phase 0 Health Connect deliveries in `metrics.health_connect_deliveries`, whose keeping, replay or drop `retire-the-health-connect-intake` leaves to the operator.

The infrastructure repository's rules (read on 2026-10-25 from `Shatynska-Labs/infrastructure` `main`):

- The shared instance holds only non-durable data, unconditionally; no backup lifts that, because its classification as needing no backup depends on it (`iac-platform-services`, _Single Shared PostgreSQL Instance, Per-Application Databases_).
- Any other store on a host is either classified as needing no backup, for one of five named reasons stated in the change that adds it, or has a logical backup written off the host and a restore rehearsed on representative data and checked, both in place before data first lands (`iac-safety-hardening`, _No Store on This Host Holds Data Requiring Backup_). No application has yet cleared that bar.
- Data an application keeps on a **staging** host goes in the shared instance, never a container of its own, unconditionally (`docs/onboard-an-application.md` §3.1).
- The server's automatic backups cover the root disk only, not the attached data volume, and a stack's data volume is destroyed with its server when `server_enabled` is false. The infrastructure backlog entry `decide-whether-the-data-volume-should-survive-a-server-toggle` says decoupling and a real backup are owed together once durable data lands on a volume.
- The default it expects for durable data is an external managed service owning its own backups.

The options put to the operator: a managed PostgreSQL (Scaleway, Neon, Supabase) or Basis's own PostgreSQL on the host with off-host backups; for photos, the database's vendor's object storage or Hetzner Object Storage; for Redis, on the host as non-durable or managed.

## Goals / Non-Goals

**Goals:**

- Decide where production's durable relational data, photos and queues live, and record it in an ADR superseding ADR-0006 in part.
- State what the decision obliges before durable data lands, so `move-to-durable-data-storage` can be planned from it.

**Non-Goals:**

- Provisioning anything: the container, the backups, the restore rehearsal and the `DATABASE_URL` rendering are `move-to-durable-data-storage`'s; Object Storage and Redis are provisioned by the phase that first uses each (`reach-the-calibration-period` Not in scope).
- Choosing the backup tool, bucket names, credentials or the exact PostgreSQL version.
- Encrypting body photos at rest under direct client upload (PRD privacy requirement): left to the phase that stores them.
- A GDPR compliance review, owed before opening to new users (`docs/product/06-risks-and-open-questions.md`).

## Decisions

**1. Production's durable relational data lives in a PostgreSQL container of Basis's own on `main-production`.** Operator, 2026-10-25. It is defined in Basis's own production Compose stack, its data on the host's attached data volume, and it holds the `basis-api` database and the LangGraph.js checkpointer (ADR-0006). Hetzner is an EU company with EU data centres, so health data stays under EU jurisdiction as it would at an EU managed provider; GDPR obligations to users are the same either way, and what changes is that availability, patching, backup and restore are Basis's to carry. Over the shared instance it gives a backup and point-in-time restore scoped to Basis alone (restoring a shared cluster would roll back every other application), isolation of health data from other applications' roles and the platform superuser, and its own upgrade schedule. Its major version stays equal to the shared instance's (18 today), which staging and the integration runs use (`integration-testing`), until a change decides otherwise and amends that spec. Alternatives: Scaleway Managed PostgreSQL (EU-owned, provider-owned backups, a monthly cost) — rejected by the operator in favour of keeping everything on the existing Hetzner infrastructure; Neon and Supabase — US companies, and Neon's free-tier restore window is short; making the shared instance durable for every application — a change of the infrastructure repository's policy for all applications that keeps the cluster-wide restore problem.

**2. Staging stays in its host's shared instance.** The infrastructure repository requires it unconditionally, and staging's data is the operator's alone and loss-tolerable. Production data is never copied to staging. The consequence is that staging does not exercise production's database container; the restore rehearsal (decision 4) is what exercises it.

**3. Backups are off-host, encrypted, and of two kinds, in another Hetzner location.** Both are encrypted before they leave the host and written to a Hetzner Object Storage bucket in a location other than `hel1`, so a loss of the server, its volume or its location leaves a copy:

- a **logical backup**, a daily `pg_dump` of the `basis-api` database: the form the infrastructure repository's _No Store on This Host Holds Data Requiring Backup_ names, restorable per database and independent of the cluster's physical state;
- **continuous archiving** of the write-ahead log with periodic base backups, for point-in-time restore between dumps.

Initial targets, adjustable by the operator in review: at most 5 minutes of data lost (`archive_timeout`); point-in-time restore over 30 days, so backups are kept 30 days plus one base-backup interval and then expire, and an erased account leaves no copy much older than that; daily dumps kept 30 days. Expiry is enforced by the bucket's lifecycle rules rather than by the backup tool, and those rules also expire noncurrent versions and delete markers within the same window, because the backup credential can write to the bucket but not delete from it, and versioning or object lock protects what it wrote. Backup age is alerted on through the platform's alerting (decision 5). The tool for continuous archiving (WAL-G, pgBackRest or another) is `move-to-durable-data-storage`'s choice. Continuous archiving alone was rejected because the infrastructure repository's rule asks for a logical backup; dumps alone because a daily dump loses up to a day.

**4. No durable data lands before a rehearsed, checked restore.** Before production's `DATABASE_URL` points at the container, a restore from each off-host backup — the logical dump, and a point-in-time restore from the archive — into a fresh instance is performed on representative data and its result checked against the source, and both procedures are written down. This is the infrastructure repository's precondition, restated here because it gates `reach-the-calibration-period`.

**5. The infrastructure repository records the store and decouples the volume.** Basis's container is a store added outside that repository, so a change there records it and the backups and restores it relies on (_No Store on This Host Holds Data Requiring Backup_); takes up `decide-whether-the-data-volume-should-survive-a-server-toggle` for `main-production`, since durable data on the volume is that entry's trigger; wires the backup-age alert into the platform's alerting; and, once production has moved, retires production's `basis-api` database, role and probe key in the shared instance, for which it has no recipe yet. `move-to-durable-data-storage` waits on that change, except for the retirement, which follows the move.

**6. Photos live in Hetzner Object Storage, with versioning and object lock.** Operator, 2026-10-25, keeping ADR-0006's choice. It is off-host and managed, and its product page lists object versioning, object locking, object expiry, presigned URLs and server-side encryption (read 2026-10-25). It replicates within a location but is not a backup, so versioning with a retention for noncurrent versions guards against deletion by a bug, an operator or a leaked key; account deletion must also purge noncurrent versions. The bucket's location and whether a cross-location copy is owed are decided by the phase that first stores photos (roadmap Phase 3), as is how body photos are encrypted given direct client upload.

**7. Redis runs on the host and needs no backup: its contents are derived from PostgreSQL.** Operator, 2026-10-25. Every BullMQ job is reconstructible from PostgreSQL — a meal without an assessment is re-enqueued, a day pending recalculation is found from its state, a reminder is due from its schedule — so Redis satisfies _derived from a source that still exists, regenerated in use_, naming production's PostgreSQL as the source. That makes it an obligation on every job: a change adding a queue states how its jobs are re-derived, and one that cannot be is not put in Redis. Redis is not used as a store of record. Alternative: a managed Redis — a cost with no gain once nothing durable sits in it.

**8. Everything on one vendor is an accepted risk.** The database, its backups and photos all sit with Hetzner, so a suspended or compromised Hetzner account reaches them all. Accepted for a single-user product; separate locations cover a location failure, and a copy at a second provider is revisited before opening to other users.

**9. `probe-the-database-before-delivery` stays, scoped to staging.** The probe is the infrastructure repository's recipe for a database in the shared instance; production leaves it at `move-to-durable-data-storage`, staging does not. Until then it applies to both hosts. This answers the workstream's open question, which is removed.

## Risks / Trade-offs

- [Operating a database is Basis's own work: upgrades, disk, monitoring] → one container on an existing host, alerting on backup failure; a managed service remains the fallback if this proves costly, and moving is a change of `DATABASE_URL` and provisioning, not of migrations.
- [A backup that silently stops] → alert on backup age, and the rehearsal is repeated after any change to the backup set-up.
- [Staging does not run production's database container] → the restore rehearsal exercises it; schema changes run on both through the same migrations.
- [Hetzner Object Storage's feature claims are from its product page, not tested] → the backup bucket's provisioning in `move-to-durable-data-storage` verifies lifecycle expiry of current and noncurrent versions, versioning or object lock, and a credential that can write but not delete (or a separate Hetzner project scoping it); the phase that stores photos verifies versioning and object lock on its bucket before photos land.

## Migration Plan

None in this change. `move-to-durable-data-storage` brings the container up, establishes both backups and rehearses both restores, then copies production's shared-instance `basis-api` database into the container (a dump and restore, cheap at its size) and only then points production's `DATABASE_URL` at it, so its users and any Phase 0 deliveries survive and `retire-the-health-connect-intake`'s decision stays open. Discarding them instead is acceptable only as the operator's decision recorded against that entry. The shared-instance database is retired afterwards by the infrastructure change of decision 5.

## Open Questions

None. The initial targets in decision 3 stand unless the operator revises them in review.
