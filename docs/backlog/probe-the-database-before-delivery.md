---
kind: change
waits_on: []
design_with: []
workstream: reach-the-calibration-period
recorded_by: add-persistence-skeleton
re_checked: 2026-10-25
---

The infrastructure repository asks an application with a database in the shared instance to probe it before delivering (`Shatynska-Labs/infrastructure` `docs/onboard-an-application.md` §4.5): one `ssh` with a second, probe-only key, answering one of `window-open`, `unreachable`, `absent`, `credential-refused`, `empty`, `populated`. Both hosts already declare `basis-api`'s probe key. Without it, a reset shared instance surfaces as a failed `migrate` service with `password authentication failed`, indistinguishable from a stale secret. Add the probe to `.github/actions/deliver-api/action.yml` before delivery, matching the whole token set and refusing anything but `empty` and `populated`, with the table `drizzle.__drizzle_migrations`; store `BASIS_API_PROBE_SSH_KEY` in each Environment. Once `move-to-durable-data-storage` takes production out of the shared instance, the probe applies to staging only (ADR-0014); until then it applies to both hosts.

- **Kind**: It owes an `api-delivery` delta and the operator's storing of the probe keys.
- **Waits on**: (`add-persistence-skeleton` is archived; the `migrate` service and `basis-api`'s databases exist on both hosts).
- **Recorded by**: `add-persistence-skeleton`, kept out to bound that change's deploy risk.
