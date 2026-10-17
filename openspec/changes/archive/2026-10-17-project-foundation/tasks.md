## 1. Foundation record

- [x] 1.1 Fill every section of `design.md` (Identity with its three items, Scope, Non-Goals, Technology, Architecture, Testing Strategy, Development Tooling) and verify none is marked unsettled
- [x] 1.2 Write identity through architecture into `README.md` between `<!-- ai-toolkit:project-foundation -->` markers, with the headings the foundation procedure names, and verify they match `design.md`
- [x] 1.3 Write Testing Strategy and Development Tooling into `AGENTS.md` between the same markers, after the managed workflow block and outside it, and verify the test command and test-path glob are stated
- [x] 1.4 Extend `.gitignore` with the stack's exclusions and `.worktrees/`, and verify `git check-ignore .worktrees/x node_modules/x apps/mobile/android/x` lists all three paths

## 2. New ADRs

- [x] 2.1 Write `docs/adr/0011-drizzle-orm.md` (context; decision with the two rules on row types and transactions, per-context PostgreSQL schemas, and the LangGraph.js checkpointer tables in their own per-context schemas outside drizzle-kit; alternatives; consequences) and verify it matches `design.md`'s Drizzle decision
- [x] 2.2 Write `docs/adr/0012-context-structure.md` with status "accepted; supersedes in part ADR-0004, ADR-0005, ADR-0010": the context shape with driving and driven adapters, CQRS at the application level, integration events through the `@nestjs/cqrs` `EventBus`, NestJS 12 and where its decorators may appear, `Result`, the Shared Kernel, and the complete revised tag table including the `bannedExternalImports` constraints and the `zod`-only `allowedExternalImports` for `type:contracts`; verify it matches `design.md`'s Technology decision on NestJS and its Architecture section
- [x] 2.3 Write `docs/adr/0013-langfuse-llm-observability.md` (context with the privacy reason; decision including trace retention and deletion with the account; alternatives; consequences including the services self-hosted Langfuse adds) and verify it matches `design.md`'s Langfuse decision

## 3. Updated documents

- [x] 3.1 Add to ADR-0004, ADR-0005 and ADR-0010 a status line "accepted; superseded in part by ADR-0012" and a one-line pointer naming what ADR-0012 replaces, leaving their decision text unchanged, and verify each pointer names a section ADR-0012 actually contains
- [x] 3.2 Update `docs/architecture/context-map.md` (the Layering column and the Nx structure) and verify it agrees with ADR-0012
- [x] 3.3 Add Langfuse traces to the DPIA table in `docs/product/06-risks-and-open-questions.md`, stating that traces stay on Hetzner, are kept for a bounded period and are deleted with the account, and verify the row matches ADR-0013
- [x] 3.4 Add ADR-0011 to ADR-0013 to `docs/adr/README.md` and set the statuses of ADR-0004, ADR-0005 and ADR-0010 to "accepted; superseded in part by ADR-0012", and verify the index matches each ADR's own status line
- [x] 3.5 Put a banner at the top of `docs/CLAUDE.md` stating that it is the discovery-phase draft, superseded wherever it conflicts with `docs/adr/` and `AGENTS.md`, and that its integration is the backlog entry `integrate-the-context-draft`, and verify the banner names both
- [x] 3.6 Create `docs/backlog.md` with the entry `integrate-the-context-draft` (what remains to integrate from `docs/CLAUDE.md`, starting with its conventions; argued in this change) and verify the entry is cited by name in the banner

## 4. Verification

- [x] 4.1 Run `openspec validate project-foundation` and verify it passes
- [x] 4.2 Verify that every `type:*` tag used in `docs/architecture/context-map.md` appears in ADR-0012's tag table, and that every relative link in `README.md`, `docs/README.md` and `docs/adr/README.md` resolves to an existing file
- [x] 4.3 Read `README.md`, `AGENTS.md`, `docs/adr/` and `docs/architecture/context-map.md` together and verify no document contradicts another on the decisions recorded here

## 5. Ship

- [x] 5.1 Merge the implementation: pull request #1, merged 2026-10-17 as `6c23196`
- [x] 5.2 Confirm — **waived** by the operator on 2026-10-17, class: *no observation can actually be made*. The change is documentation only (decisions, ADRs, `README.md`, `AGENTS.md`, `.gitignore`); nothing runs in production, so there is no effect to observe there. No successor is intended.
