## 1. Integration

- [x] 1.1 Add a `## Conventions` section to `AGENTS.md` after the `ai-toolkit:project-foundation` block and outside both delimited blocks, carrying the eight conventions listed in `design.md`, and verify each appears and none contradicts `docs/product/04-domain-model.md`, `docs/product/03-prd-mvp.md`, ADR-0007, ADR-0010 or ADR-0012
- [x] 1.2 In the same section, point to `docs/product/01-vision.md` for the product principles, stating that it is read before any change touching product behaviour, and verify the link resolves and the clause is present
- [x] 1.3 Delete `docs/CLAUDE.md`, and verify no file outside `openspec/changes/archive/`, this change's own artifacts and `docs/backlog.md`'s `integrate-the-context-draft` entry (deleted at archive, task 3.3) references it
- [x] 1.4 Add the entry `reconcile-ai-suggestion-confirmation` to `docs/backlog.md` (ADR-0007's "always require human confirmation" against PRD US-12, US-13 and US-15; identified in this change; depends on nothing), and verify it is cited by name in `design.md`

## 2. Verification

- [x] 2.1 Run `openspec validate integrate-the-context-draft` and verify it passes
- [x] 2.2 Verify that both delimited blocks in `AGENTS.md` are byte-identical to the trunk's

## 3. Ship

- [x] 3.1 Open the implementation pull request and wait for the operator's confirmation that it merged — PR #3, merge confirmed by the operator on 2026-10-17
- [x] 3.2 Confirm the effect: a fresh session started outside `docs/` states the time-zone, sleep-day and "domain"-versus-life-area conventions when asked, without reading any file — confirmed by the operator on 2026-10-17
- [x] 3.3 Archive: delete the `integrate-the-context-draft` entry from `docs/backlog.md`, archive the change, and open its pull request
