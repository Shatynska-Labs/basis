## Why

Basis's roadmap phases each take several changes, and nothing records which change serves which phase or what follows it. A backlog entry does not say which goal it serves, so finding Phase 0's or Phase 1's remaining work means reading every entry. ai-toolkit now defines a **workstream** (`add-workstreams`, archived 2026-10-24, workflow fragment v11): one file per goal at `docs/workstreams/<name>.md`, holding a goal, a checkable Done when and ordered steps named by change. A step's status is derived from the repository and never written. A backlog entry names the workstream it serves. This change brings workstreams to Basis.

**Workstream**: none. This change sets up the workstreams and advances none of them.

## What Changes

- **The workflow block in `AGENTS.md` goes from v10 to v11.** The block is a verbatim copy of ai-toolkit's v10 text, so it is replaced with v11 as a whole. Basis's own refinements (the _Deployment_ section) sit outside the block and are untouched.
- **`docs/workstreams/README.md`** is added with ai-toolkit's seeded text.
- **The backlog preamble takes the current seeded shape**, which adds **Priority** and **Workstream** to the entry shape and names unparked entries in the archive rule. Existing entries are not rewritten, beyond the Workstream field below; an entry without Priority reads as `normal`.
- **Two workstreams are opened** (operator, 2026-10-24):
  - `validate-the-data-source`: roadmap Phase 0;
  - `reach-the-calibration-period`: roadmap Phase 1's remaining work.
- **Every backlog entry that is a step of one of them gains a Workstream line.** Entries serving neither gain nothing, which the preamble reads as `nothing`.
- **`docs/README.md`** names `docs/workstreams/`, and `docs/product/05-roadmap.md` points to the workstreams for the phases that have one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change edits documentation and the conventions file only, so it declares `skip_specs: true`.

## Impact

- `AGENTS.md` (the managed block), `docs/backlog.md`, `docs/workstreams/` (new), `docs/README.md`, `docs/product/05-roadmap.md`.
- No code, test or deployed behaviour changes. Every changed path is Markdown, so `tools/change-scope` classifies the change as documentation-only and the project checks stand down.
- Sessions print the v11 status row, led by the workstream, from the next read of `AGENTS.md`.
