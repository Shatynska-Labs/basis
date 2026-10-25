## Why

ADR-0006 puts PostgreSQL, Redis/BullMQ and Object Storage "within the existing Hetzner infrastructure", but the infrastructure repository admits no durable data into a host's shared PostgreSQL instance under any terms, and admits it into any other store on a host only once an off-host logical backup and a rehearsed, checked restore are in place before the data lands (`Shatynska-Labs/infrastructure`: `iac-platform-services` _Single Shared PostgreSQL Instance, Per-Application Databases_; `iac-safety-hardening` _No Store on This Host Holds Data Requiring Backup_; `docs/onboard-an-application.md` §3.1, §4.3). Basis's metrics, daily statuses, goals, profile and photos are durable, and since `add-persistence-skeleton` its database sits in the shared instance under an interim decision that treats everything there as loss-tolerable. The calibration period cannot start on that footing (roadmap Phase 1 outcome). The operator decided where durable data lives on 2026-10-25; this change records it.

**Workstream**: `reach-the-calibration-period`, whose step 2 this is.

## What Changes

- **ADR-0014** (new), superseding ADR-0006 in part: production's durable relational data lives in a PostgreSQL container of Basis's own on `main-production`, with encrypted off-host backups — a daily logical dump and continuous archiving — to Hetzner Object Storage in a location other than the server's, and a rehearsed, checked restore in place before durable data lands; staging stays in its host's shared instance; photos live in Hetzner Object Storage with versioning; Redis runs on the host as a store needing no backup, every job being re-derivable from PostgreSQL.
- **ADR-0006** is marked superseded in part by ADR-0014; the ADR index follows.
- **`AGENTS.md`** Deployment's database paragraph names ADR-0014 as the decided target and `move-to-durable-data-storage` as what reaches it, in place of the pending backlog entry.
- **`reach-the-calibration-period`**: step 3's description, the Not in scope line and Decisions name ADR-0014; the open question on `probe-the-database-before-delivery` is answered (it stays, scoped to staging once production leaves the shared instance).
- **`docs/backlog.md`**: a `move-to-durable-data-storage` entry records what that step owes, including the infrastructure repository's change; `probe-the-database-before-delivery` is revised for its narrowed scope; at archive, `choose-durable-data-storage` is closed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change records a decision in documentation only, so it declares `skip_specs: true`; the `api-delivery`, `api-persistence` and, should production's major version ever diverge, `integration-testing` deltas the decision implies belong to `move-to-durable-data-storage`, which implements it.

## Impact

- `docs/adr/0014-durable-data-storage.md` (new), `docs/adr/0006-data-and-infra.md`, `docs/adr/README.md`, `AGENTS.md`, `docs/workstreams/reach-the-calibration-period.md`, `docs/backlog.md`.
- No code, test or deployed behaviour changes; production stays in the shared instance until `move-to-durable-data-storage`. Every changed path is Markdown or YAML under `openspec/`, so the project checks stand down.
- Commits the infrastructure repository to recording Basis's store, the backup-age alert, retiring production's shared-instance `basis-api` database after the move, and the volume decoupling its backlog entry `decide-whether-the-data-volume-should-survive-a-server-toggle` says is owed together with a real backup; that work is `move-to-durable-data-storage`'s, not this change's.
