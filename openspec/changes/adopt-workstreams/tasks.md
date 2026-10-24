## 1. Conventions

- [x] 1.1 Replace `AGENTS.md`'s managed workflow block body with ai-toolkit's `rules/development-workflow.md` v11 body and raise the marker to `v11` (design decision 1). Verify by diffing the block against v11: no difference

## 2. Backlog and workstreams

- [x] 2.1 Replace `docs/backlog.md`'s preamble with the seeded preamble from ai-toolkit's `scripts/project-init` (decision 2). Verify by diffing the two preambles
- [x] 2.2 Add `docs/workstreams/README.md` with the seeded text. Verify by diffing against ai-toolkit's `docs/workstreams/README.md`
- [x] 2.3 Write `docs/workstreams/validate-the-data-source.md` and `docs/workstreams/reach-the-calibration-period.md` in the README's shape (decision 3). Verify that every step name is a backlog heading, a change directory, or one of the three planned names, and that no step description states a status
- [x] 2.4 Add the Workstream line to each entry decision 4 names, and to no other. Verify with `git diff -U0 docs/backlog.md` that, below the preamble, the only added lines are `**Workstream**:` lines and their blank separators, and none is removed

## 3. Documents

- [x] 3.1 Add `docs/workstreams/` to `docs/README.md` and the two workstream pointers to `docs/product/05-roadmap.md` (decision 5). Verify by reading

## 4. Verify

- [x] 4.1 `openspec validate --all --strict` and `pnpm format:check` pass
- [x] 4.2 Run the `backlog` skill's **workstreams** operation over the branch: it reports both workstreams with a status for every step
- [x] 4.3 Confirm with `tools/change-scope` that every changed path is documentation, so the stood-down checks are the correct ones

## 5. Ship

- [ ] 5.1 Open the pull request and let CI run; wait for the operator's word that it merged and that staging's deploy is healthy
- [ ] 5.2 Confirm: a new session prints the v11 status row, and the **workstreams** operation reports both workstreams
- [ ] 5.3 Record the operator's waiver of **promote** and archive
