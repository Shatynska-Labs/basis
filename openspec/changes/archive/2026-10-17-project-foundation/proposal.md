## Why

Basis has a complete discovery phase in `docs/` but no recorded foundation: the workflow's test-authoring step has no test command or test-path glob to work from, the stack has no ORM, testing strategy or development tooling decided, and the architecture in ADR-0010 predates the module structure, CQRS and error-handling approach the project is to follow. The first implementation change (roadmap Phase 1, the workspace scaffold) needs all of these settled first, because the project's rule is that a change contradicting `docs/` updates the documents before the code.

## What Changes

- Record the nine foundation decisions in `design.md`, drawing identity, problem, audience, scope, non-goals, technology and architecture from `docs/` and settling the rest during discovery.
- Write identity through architecture into a delimited section of a new `README.md`, and testing strategy and development tooling into a delimited section of `AGENTS.md`, outside the managed workflow block.
- Extend `.gitignore` with the TypeScript, Nx and Expo stack's exclusions and with `.worktrees/`.
- Add ADR-0011 (Drizzle ORM), ADR-0012 (context structure: optional domain, application with CQRS, infrastructure split into driving and driven adapters, contracts, `Result`, the Shared Kernel, the revised tag table, NestJS 12 and where its decorators may appear) and ADR-0013 (self-hosted Langfuse for LLM observability).
- Following `docs/adr/README.md`'s rule that a changed decision is a new ADR, ADR-0012 supersedes ADR-0004, ADR-0005 and ADR-0010 in part; those three gain only a status line and a pointer. Update `docs/architecture/context-map.md` and `docs/product/06-risks-and-open-questions.md` to match.
- Mark `docs/CLAUDE.md`, the discovery-phase draft of the project's context file, as superseded wherever it conflicts with the ADRs and `AGENTS.md`, and record its integration as a named entry in a new `docs/backlog.md`.

No code is written: the workspace scaffold is the next change.

## Capabilities

### New Capabilities

None. The foundation records decisions and documents; it specifies no behaviour, so the change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- **Documents:** `README.md` (new), `AGENTS.md`, `.gitignore`, `docs/adr/` (three new ADRs, status lines on three, the index), `docs/architecture/context-map.md`, `docs/product/06-risks-and-open-questions.md`, `docs/CLAUDE.md` (banner only), `docs/backlog.md` (new).
- **Later changes:** the workspace scaffold builds the structure, tooling and test commands recorded here; every change after foundation has a defined test command and test-path glob.
- **Out of scope:** integrating `docs/CLAUDE.md`'s content — its conventions (time zones, sleep-day attribution, `user_id` on every entity, secret handling) and the rest — into the project's live documents. This change only marks the draft as superseded where it conflicts and records the integration in `docs/backlog.md` as `integrate-the-context-draft`.
- **Test authoring:** exempt for this change. Its test command and test-path glob do not exist yet — they are among its own outputs — so tests cannot be derived from it before implementation.
