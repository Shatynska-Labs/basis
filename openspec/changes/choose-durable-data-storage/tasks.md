## 1. Decision record

- [ ] 1.1 Write `docs/adr/0014-durable-data-storage.md` in the ADR template (Status `accepted; supersedes in part ADR-0006`, Context, Decision, Alternatives considered, Consequences), carrying design decisions 1–8. Verify by reading against the design
- [ ] 1.2 Mark `docs/adr/0006-data-and-infra.md`'s Status as superseded in part by ADR-0014, naming what it no longer decides (where PostgreSQL runs and how its data is kept, Redis's classification), and add ADR-0014 to `docs/adr/README.md`, updating ADR-0006's row. Verify by reading

## 2. Project guidance

- [ ] 2.1 In `AGENTS.md`'s Deployment section, revise **The database** so it names ADR-0014 as the decided target and `move-to-durable-data-storage` as what reaches it, keeping the interim rule (everything in the shared instance is loss-tolerable) until then. Verify by reading

## 3. Workstream and backlog

- [ ] 3.1 In `docs/workstreams/reach-the-calibration-period.md`, rescope step 3 to production (the container, both backups and their rehearsed restores, the copy of the shared-instance database, and `DATABASE_URL`) per decisions 1–4 and the Migration Plan; point Not in scope and Decisions at ADR-0014; and remove the open question on `probe-the-database-before-delivery` (decision 9). Verify by reading
- [ ] 3.2 Add a `move-to-durable-data-storage` entry to `docs/backlog.md` (workstream `reach-the-calibration-period`) recording what it owes from decisions 1–5 and the Migration Plan (including copying the shared-instance database, the `api-delivery` and `api-persistence` deltas, and `integration-testing` should production's major version diverge), that it waits on the infrastructure repository's change of decision 5, and **Design with** `retire-the-health-connect-intake` (whose entry is cross-referenced back); revise `probe-the-database-before-delivery` for decision 9 and set its **Re-checked**. Verify by reading

## 4. Verify

- [ ] 4.1 `openspec validate --all --strict` and `pnpm format:check` pass
- [ ] 4.2 Confirm with `tools/change-scope` that every changed path is documentation

## 5. Ship

- [ ] 5.1 Open the pull request and let CI run; wait for the operator's word that it merged and that staging's deploy is healthy
- [ ] 5.2 Confirm: the operator reads ADR-0014 on `main` and agrees it records the decision of 2026-10-25
- [ ] 5.3 Record the operator's waiver of **promote**; then, in the archive commit, close `choose-durable-data-storage` in `docs/backlog.md`, update the entries it unblocked and set their **Re-checked**
