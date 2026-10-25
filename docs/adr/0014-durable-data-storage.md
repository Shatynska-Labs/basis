# ADR-0014: Durable data in Basis's own PostgreSQL, backed up off-host

**Status:** accepted; supersedes in part ADR-0006 · **Date:** 2026-10-25

## Context

ADR-0006 chose PostgreSQL, Redis/BullMQ and Hetzner Object Storage "within the existing Hetzner infrastructure" without saying where on it durable data lives or how it is kept. Basis's metrics, daily statuses, goals, profile and photos are durable: their loss would not be tolerable to their user.

The infrastructure repository (`Shatynska-Labs/infrastructure`) bounds the answer. A host's shared PostgreSQL instance holds only data whose loss is tolerable, unconditionally, and no backup lifts that (`iac-platform-services`, _Single Shared PostgreSQL Instance, Per-Application Databases_). Any other store on a host either needs no backup, for a reason stated in the change that adds it, or has a logical backup written off the host and a rehearsed, checked restore in place before data first lands (`iac-safety-hardening`, _No Store on This Host Holds Data Requiring Backup_). A staging host keeps an application's data in its shared instance, never in a container of the application's own (`docs/onboard-an-application.md` §3.1). The server's own backups cover the root disk only, not the data volume, and the volume is destroyed with its server when the server is toggled off.

Until this decision, Basis's `basis-api` database sat in each host's shared instance with everything in it treated as loss-tolerable (operator, 2026-10-17; `add-persistence-skeleton`).

## Decision

**PostgreSQL.** In production, Basis's durable relational data, including the LangGraph.js checkpointer, lives in a **PostgreSQL container of Basis's own on `main-production`**, defined in Basis's production Compose stack, its data on the host's attached data volume. Its major version stays equal to the shared instance's (18), which staging and the integration runs use, until a change decides otherwise; its upgrade schedule is otherwise its own. **Staging stays in its host's shared instance**; production data is never copied to staging.

**Backups.** Two kinds, both encrypted before they leave the host and written to Hetzner Object Storage in a location other than the server's (`hel1`):

- a daily **logical dump** (`pg_dump`) of `basis-api`, the form the infrastructure repository's rule names;
- **continuous archiving** of the write-ahead log with periodic base backups, for point-in-time restore between dumps.

Initial targets, adjustable by the operator: at most 5 minutes of data lost; point-in-time restore over 30 days, backups kept 30 days plus one base-backup interval; dumps kept 30 days, so an erased account leaves no copy much older than that. Expiry, of current and noncurrent versions and delete markers alike, is enforced by the bucket's lifecycle rules rather than by the backup tool; the backup credential can write but not delete, and versioning or object lock protects what it wrote. Backup age is alerted on through the platform's alerting. The continuous-archiving tool (WAL-G, pgBackRest or another) is `move-to-durable-data-storage`'s choice.

**No durable data lands before a rehearsed, checked restore** from each backup — the dump, and a point-in-time restore from the archive — performed on representative data into a fresh instance, its result checked against the source, and both procedures written down.

**The infrastructure repository records the store.** A change there records Basis's container and the backups and restores it relies on, decouples `main-production`'s data volume from its server toggle (its backlog entry `decide-whether-the-data-volume-should-survive-a-server-toggle`), wires the backup-age alert, and, after the move, retires production's `basis-api` database, role and probe key in the shared instance.

**Photos.** Hetzner Object Storage, as ADR-0006 chose, with **versioning and object lock**. It replicates within a location but is not a backup; versioning with a retention for noncurrent versions guards against deletion by a bug, an operator or a leaked key, and account deletion purges noncurrent versions too. The bucket's location, any cross-location copy, and how body photos are encrypted under direct client upload are decided by the phase that first stores photos.

**Redis.** A container on the host that **needs no backup**: its contents are derived from PostgreSQL, a source that still exists, and regenerated in use. Every BullMQ job is reconstructible from PostgreSQL — a meal without an assessment is re-enqueued, a day pending recalculation is found from its state, a reminder is due from its schedule. A change adding a queue states how its jobs are re-derived; a job that cannot be is not put in Redis, and Redis is never a store of record.

## Alternatives considered

- **Scaleway Managed PostgreSQL** — EU-owned, backups owned by the provider; a monthly cost, and a second vendor where Hetzner already hosts everything.
- **Neon or Supabase** — US companies; Neon's free-tier restore window is short.
- **Making the shared instance durable** for every application — a policy change for all applications in the infrastructure repository, and a point-in-time restore of a shared cluster rolls back every application at once.
- **Continuous archiving alone** — does not meet the infrastructure repository's logical-backup rule. **Dumps alone** — up to a day of data lost.
- **Managed Redis** — a cost with no gain once nothing durable sits in it.

## Consequences

- Health data stays with an EU company in EU data centres; GDPR obligations to users are unchanged by self-hosting, but availability, patching, backup and restore are ours.
- Basis's backup and restore are scoped to Basis alone, and its health data is isolated from other applications' roles and the platform superuser.
- `move-to-durable-data-storage` reaches this: the container, both backups and their rehearsed restores, a copy of the shared-instance database into the container, then production's `DATABASE_URL`. It waits on the infrastructure repository's change.
- `probe-the-database-before-delivery` applies to staging only once production has moved.
  − A database to operate: upgrades, disk, monitoring, and backups that must be watched so they do not stop silently.
  − Staging does not run production's database container; the restore rehearsal is what exercises it.
  − Everything sits with one vendor: a suspended or compromised Hetzner account reaches the database, its backups and photos. Accepted for a single user; a copy at a second provider is revisited before opening to other users.
  − Hetzner Object Storage's versioning, object lock, lifecycle expiry and scoped credentials are known from its product page only; each is verified on the bucket before it is relied on.
