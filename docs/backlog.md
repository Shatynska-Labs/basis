# Backlog

Changes this project has identified but not yet opened, and what each depends on. An entry is deleted when its change is archived. Cite an entry by name, never by number.

## `integrate-the-context-draft`

`docs/CLAUDE.md` is the discovery-phase draft of the project's context file. It was moved out of the root before initialization so the root `CLAUDE.md` could import `AGENTS.md`. Claude Code now loads it only when a session reads files under `docs/`, and then as stale guidance held back by its banner; a session working anywhere else never sees its conventions. Integrate what is still true into the live documents and remove the draft:

- **its conventions first** — timestamps carry a time zone and a user's day is computed in their local time zone; sleep belongs to the day it ended and a day closes the next morning; every entity has a `user_id`; metrics are normalized and source-agnostic; "domain" is used only in the DDD sense and spheres of habits are life areas; secrets are encrypted and never logged; code, comments, commit messages and docs are in English. These shape every implementation change and belong where a session reads them without being told to look (`AGENTS.md`);
- its product principles, already stated in `docs/product/01-vision.md`, need only a pointer;
- its stack, architecture, monorepo structure and module-boundary sections are superseded by `README.md`, ADR-0011 to ADR-0013 and ADR-0012's tag table, and are dropped.

**Argued in**: `project-foundation`, whose plan review found the draft contradicting the recorded decisions.

**Depends on**: nothing. Best done before the first implementation change.

## `reconcile-ai-suggestion-confirmation`

ADR-0007 states that LLM suggestions "always require human confirmation". The PRD disagrees: a plate score is applied at once and corrected afterwards if wrong (US-12, US-13; `docs/product/04-domain-model.md` §5; "the user never waits for the AI"), and only the weekly review's suggested goal change is accepted or rejected (US-15). Decide which holds and record it — an ADR superseding ADR-0007 in part, or a change to the PRD and domain model — then add the outcome to `AGENTS.md`'s Conventions, which today carry only what every source agrees on: deterministic logic in code, every AI assessment correctable, a goal change applied only once accepted.

**Argued in**: `integrate-the-context-draft`, whose code review found the conflict.

**Depends on**: nothing. Best done before the `nutrition` change (roadmap Phase 3).
