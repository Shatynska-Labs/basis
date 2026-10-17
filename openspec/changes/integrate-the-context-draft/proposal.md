## Why

`docs/CLAUDE.md` is the discovery-phase draft of the project's context file. Claude Code loads it only when a session reads files under `docs/`, and then as stale guidance held back by its banner, so a session working anywhere else never sees its conventions — and the first implementation change (roadmap Phase 1, the workspace scaffold) is the next one. The backlog entry `integrate-the-context-draft` in `docs/backlog.md`, argued in `project-foundation`, calls for integrating what is still true into the live documents and removing the draft.

## What Changes

- Add a `## Conventions` section to `AGENTS.md`, outside both delimited blocks, carrying the draft's implementation conventions: time zones and the user's local day, sleep-day attribution and day closing, `user_id` ownership, normalized source-agnostic metrics, the meaning of "domain" against "life area", secret handling, and English as the working language.
- Carry the deterministic half of the draft's product principle 8 — "deterministic logic lives in code, not in the LLM", stated in ADR-0007 and ADR-0012 but in no file every session loads — into the same section as a convention, and point to `docs/product/01-vision.md` for the product principles.
- Leave out the principle's other half, "suggestions are confirmed by a human": ADR-0007 and the PRD disagree on it. Record the conflict in `docs/backlog.md` as `reconcile-ai-suggestion-confirmation`.
- Delete `docs/CLAUDE.md`. Its stack, architecture, monorepo-structure and module-boundary sections are superseded by `README.md`, ADR-0011 to ADR-0013 and ADR-0012's tag table; its development-process and documents sections by `AGENTS.md` and `docs/README.md`.
- Delete the `integrate-the-context-draft` entry from `docs/backlog.md` when the change is archived.

## Capabilities

### New Capabilities

None. The change moves project conventions between documents; it specifies no behaviour, so it sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- **Documents:** `AGENTS.md` (new section), `docs/CLAUDE.md` (deleted), `docs/backlog.md` (entry `reconcile-ai-suggestion-confirmation` added; entry `integrate-the-context-draft` deleted at archive).
- **Later changes:** every implementation session sees the conventions through the root `CLAUDE.md`'s import of `AGENTS.md`, without being told to look.
- **Test authoring:** no specification deltas, so no new tests are owed; the project has no test suite yet (roadmap Phase 1).
