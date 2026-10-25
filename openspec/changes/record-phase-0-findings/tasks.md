## 1. Findings

- [ ] 1.1 Add a **Phase 0 findings** section to `docs/adr/0001-health-connect-as-data-source.md` with the observation table, its source and date, and the unverified points of decision 4, naming a writer only for Exercise; leave Status and Decision unchanged (design decisions 1–3). Verify by reading against the design's table
- [ ] 1.2 In `docs/product/06-risks-and-open-questions.md`, answer open question 1 pointing at ADR-0001, mark open question 2 as owed by `sync-health-connect-from-the-mobile-app`, and keep R1 at Medium with the revised mitigation (decisions 4 and 6). Verify by reading

## 2. Workstreams and backlog

- [ ] 2.1 Revise `docs/workstreams/validate-the-data-source.md`'s Done when to open question 1 only (decision 5). Verify by reading
- [ ] 2.2 Add open question 2 and the other unverified points of decision 4 to `docs/workstreams/reach-the-calibration-period.md`'s Open questions as owed by `sync-health-connect-from-the-mobile-app` (decision 4). Verify by reading

## 3. Verify

- [ ] 3.1 `openspec validate --all --strict` and `pnpm format:check` pass
- [ ] 3.2 Confirm with `tools/change-scope` that every changed path is documentation

## 4. Ship

- [ ] 4.1 Open the pull request and let CI run; wait for the operator's word that it merged and that staging's deploy is healthy
- [ ] 4.2 Confirm: the operator reads ADR-0001's findings and `06-risks-and-open-questions.md` on `main` and agrees they match what was observed
- [ ] 4.3 Record the operator's waiver of **promote**; then, in the archive commit, close `record-phase-0-findings` in `docs/backlog.md`, clear it from the Waits on of `retire-the-health-connect-intake` and `issue-ingestion-keys` and from the former's Design with (set to `nothing`), set **Re-checked** on both, move `validate-the-data-source` to `docs/workstreams/archive/<date>-validate-the-data-source.md`, and re-point `docs/product/05-roadmap.md`'s Phase 0 link to it
