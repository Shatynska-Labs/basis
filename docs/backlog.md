# Backlog

Changes this project has identified but not yet opened, and what each depends on. An entry is deleted when its change is archived. Cite an entry by name, never by number.

## `integrate-the-context-draft`

`docs/CLAUDE.md` is the discovery-phase draft of the project's context file. It was moved out of the root before initialization so the root `CLAUDE.md` could import `AGENTS.md`, and since then nothing loads it automatically. Integrate what is still true into the live documents and remove the draft:

- **its conventions first** — timestamps carry a time zone and a user's day is computed in their local time zone; sleep belongs to the day it ended and a day closes the next morning; every entity has a `user_id`; metrics are normalized and source-agnostic; "domain" is used only in the DDD sense and spheres of habits are life areas; secrets are encrypted and never logged; code, comments, commit messages and docs are in English. These shape every implementation change and belong where a session reads them without being told to look (`AGENTS.md`);
- its product principles, already stated in `docs/product/01-vision.md`, need only a pointer;
- its stack, architecture, monorepo structure and module-boundary sections are superseded by `README.md`, ADR-0011 to ADR-0013 and ADR-0012's tag table, and are dropped.

**Argued in**: `project-foundation`, whose plan review found the draft contradicting the recorded decisions.

**Depends on**: nothing. Best done before the first implementation change.
