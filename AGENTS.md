<!-- ai-toolkit:development-workflow v4 -->
<!-- Generated. Do not edit inside this block — it is replaced on update.
     Project-specific conventions belong below the closing marker. -->

## Development workflow

The unit of work is a **change**: a feature, a modification, or a decision with design content, carried from proposal to record. These rules describe its life in three stages — `plan`, `build`, `ship` — and what holds throughout.

Work too small to be a change — a typo, a one-line correction with nothing to specify — skips `plan`. It does not skip `ship`: nothing reaches production except by merging.

These rules assume this project has a remote, pull requests, continuous integration, a deploy triggered by merging to the trunk, and OpenSpec for its change records, and that more than one session may work on it at once.

### Your branch and working tree

A change gets one branch and one working tree and keeps both from proposal to record. Cut the branch from the freshly fetched trunk; put the working tree at `.worktrees/<name>`.

_Claude Code binding:_ `EnterWorktree` places working trees under `.claude/worktrees/` and will not enter one elsewhere.

Several sessions may work on one change, one after another and never at the same time. A session resuming a change enters the working tree that change already has.

Fetch the trunk periodically throughout, and bring it into the branch rather than meeting it at the pull request. Before the branch is pushed, rebase onto it. After, merge it in: a rebase then needs a force push over a branch under review, where a merge does not.

**Provision before relying on any verification result.** A new working tree carries tracked files only: no ignored configuration, no installed dependencies, no build artifacts, no share of external state. **Verification that cannot reach what it needs skips and reports success rather than failing**, so an unprovisioned run is indistinguishable from a passing one. Until provisioning is complete, report verification as **not run, and why**.

Provisioning is complete when every step this project names has been reached, not the first. Reach that state rather than asking whether an earlier session already did; each step is safe to repeat.

**Where verification writes to a shared service, take your own namespace within it**, named deterministically from your working tree, and bring it to the project's initial state whether or not one already exists under that name. Check for the service before reporting it unavailable. Nothing here reclaims a namespace; they accumulate.

Where this project binds these two rules to a particular service, the binding is an adjacent section of this file; read it as part of them.

### Reporting where the change stands

On entering a working tree, before anything else, and again as the last thing said before stopping, report the change's status as one line, in this exact form, with `|` as a plain-text field separator without header rows:

`| <change> | <stage> | <task progress> | <commits> |`

For example: `| some-change | plan:explore | 0/0 | 1 |`

Each field is a short value, not a sentence — nothing else belongs on that line.

Derive the report from the repository where you can — the change's own artifacts, the commit log, the forge, and an actual run of the verification. Where a fact is in none of them, ask rather than assume it.

**The stage names a state, never an act.** The acts are the transitions between them, and the sections below walk them in order — some together, where one act follows another with no decision in between:

```
plan:   explore · draft · review · fix · approve · commit · derive tests
build:  apply · verify · review · fix
ship:   open pr · merge · deploy · confirm · archive
```

A state is `<family>:<transition>ing` while that transition runs and `<family>:<transition>ed` once it has happened — `plan:drafting`, `build:applying`, `plan:approved`, `ship:merged`. Two reorder: `plan:tests-derived` and `ship:pr-open`. Add `blocked:<what>` and `abandoned` at any point.

Always write the family prefix: `plan:reviewing` and `build:reviewing` dispatch different reviewers.

### plan

**explore** — a change with no proposal yet. Auxiliary artifacts such as a handoff may exist.

**draft** — use a specification-driven change process for non-trivial features, changes and significant architectural decisions. Do not begin implementing without a proposal recording what is intended and why. A change's artifacts are read before implementation, not written afterwards to describe what was done.

**review → fix → approve** — dispatch review against the complete artifact set, never a package still being written. Fix and re-review until the verdict permits proceeding, bounded at six rounds; on reaching it, report where the loop stands and what is outstanding, and ask before continuing. A conditional pass is permission conditional on the fixes it names: apply them and continue without a further round. Where the reviewer judges the concept unsound rather than the artifacts defective, stop and raise it immediately, whatever the count.

_Claude Code binding:_ dispatch `ai-toolkit:change-plan-reviewer` once every artifact the change calls for is complete. Do not use `/code-review` for this gate — it reads a diff, and at this point there is none. On `FIX REQUIRED` fix and re-dispatch; on `CONDITIONALLY APPROVED` apply the `[MINOR]` fixes and continue; on `APPROVED` continue; on `REJECTED` stop and raise it.

**commit** — commit the approved plan before tests are derived from it; the tests map to that baseline.

**derive tests** — have an author other than whoever writes the implementation derive tests from the approved specification deltas, not from implementation code. That author needs this project's test command and test-path glob; both are in this project's own conventions.

A stated exemption applies where this project's rules name one for a class of change, and the reason is given when it is used. A change declaring no specification deltas owes no new tests, only that the suite stays green.

_Claude Code binding:_ dispatch `ai-toolkit:change-test-writer` after the verdict permitted proceeding, any conditions were applied and the plan was committed — and before implementing.

### build

**apply** — implement only once two things hold: a commit holding the approved plan, which follows the verdict that permitted proceeding, and the derived tests — or the stated exemption that excused them. Where either is absent, take the missing step rather than starting and noting the gap. Work too small to be a change skipped `plan` and has neither to hold.

**verify** — run the verification relevant to the change: tests, type checking, linting, formatting, a build, whatever this project's conventions require. Do not report a change as complete without having run it.

**review → fix** — have an independent reviewer read the diff against the change's own specification: each requirement implemented, the implementation matching what the specification describes, the derived tests covering what changed, no unrelated scope, this project's conventions followed. This review reads code; the review in `plan` reads artifacts.

**Commit the implementation before dispatching, and review the committed diff rather than the working tree's uncommitted state.** A reviewer establishing that a check really catches what it claims to has to make that check fail, which means writing to the tree it is reviewing — sound review, not misbehaviour — and it undoes such a write with version control's own restore, which reinstates the *committed* content rather than the content the write displaced. Over uncommitted work those two are different, and the difference is discarded in the one way nothing notices: no stash, no reflog, and a working tree that afterwards looks cleaner rather than dirtier. Committing first makes the baseline true, so the same restore is exact. Instructing the reviewer not to write is not the guard it appears to be — it dispatches tooling of its own, which its instructions do not reach.

Dispatch against a diff that already passes verification. Re-review only where the fixes were substantial enough to warrant it, bounded at three rounds; past three, report where the loop stands and ask rather than dispatching a fourth. A review judging the implemented change unsound rather than defective exits immediately and is raised.

_Claude Code binding:_ run `ai-toolkit:change-code-reviewer` over the change's committed diff.

### ship

Nothing ships from a local machine. Never run the deploy command against production — a change reaches production by merging and by nothing else. Local credentials for production, where they exist at all, are for reading — a plan, a status, a log — and not for applying.

Every change reaches the trunk through pull requests, and takes at least two. Begin once verification passes on the branch head and `build`'s review has cleared.

**open pr → merge → deploy** — open the pull request, let continuous integration run, and wait for the operator's confirmation that it merged and that the deploy is healthy. Do not infer a merge, a deploy or a confirmed effect from a green pull request, an approval, or silence.

**confirm** — a healthy deploy is not the change working. Propose how the effect can be observed — what to look at, what provokes it, what result would mean it worked — and wait for the operator's confirmation.

Two classes cannot answer that gate and are waivable. Say so plainly, name the class, and wait for the operator to waive it; record the waiver in the change's own artifacts — the record is archived on the strength of it, and waiving your own gate is not the confirmation this step exists to obtain. Where a successor is intended, the waiver names its backlog entry or the branch it was opened on:

- no observation can actually be made — a refactor, a dependency bump or an internal cleanup with no externally observable effect, and equally an observation you proposed that turns out not to be performable;
- a change that was the wrong change: its observation was made, its effect is absent, and it is not to be corrected in place.

A recorded waiver completes **confirm**: `ship:confirmed` is true of a waived change.

**archive** — once the effect is confirmed or the gate waived, bring the branch back to the freshly fetched trunk, commit the change's specification record there, and open a pull request for it: the last of the change's pull requests. The work is on the trunk by now, however it was merged, so bringing the branch back to it discards nothing.

Two is a floor. Where the deploy is unhealthy, or the effect is absent through a defect, the change is not delivered and its record is not written: fix it and re-enter at `build`'s review gate; the fix takes a pull request of its own.

**then remove the branch and the working tree** — once the record has reached the trunk through its own pull request, every other pull request the change opened has merged, and nothing uncommitted or unpushed remains. **Read a merge from the pull request's state, not from branch ancestry** — a squash or rebase merge leaves no ancestry to read.

An abandonment recorded in the change's own artifacts, stating that the change is abandoned and its work not wanted, replaces both merge conditions and the unpushed one, but not the uncommitted one. Commit the record before reading the gate.

Remove the branch locally and on the remote, and the working tree from the repository's main working tree rather than from inside the tree being removed. Nothing here removes the namespace.

### Throughout

**Commits.** Prefer small, focused commits over large ones bundling unrelated concerns. After a meaningful milestone, proactively create a commit rather than waiting to be asked. Before committing: look at the diff, run the verification relevant to what changed, and check that no secret or unintended file is included.

While applying, the derived tests fail by design until the implementation is complete, so the verification above cannot pass and a hook running it blocks the commit. Commit with `--no-verify`, and read that failure as expected rather than as a defect. It suspends the pre-commit check, not the gate: `verify` still runs before any completion claim.

**Scope.** Prefer changes small enough to review in one sitting; where one grows to cover multiple independent concerns, consider splitting it. Implement only what belongs to the change in progress — an improvement noticed along the way becomes a separate proposed change rather than being folded in.

**A second change surfacing.** You work on one change at a time. Record the second before doing anything else about it.

- Where the change in progress **depends** on it: record the dependency and the wait in the current change's own artifacts, then at most open the identified change and recommend it be continued in a separate session.
- Where it **does not**: record it in `docs/backlog.md`, creating that file if absent, or open the identified change.

*Opening* one means a branch of its own and a `handoff.md`, with no proposal — why the change was identified, what bears on it, and what it must not undo. Place it in the new change's own directory in this project's change-record layout — for OpenSpec, `openspec/changes/<name>/handoff.md`. The session that takes it up writes the proposal. Commit that branch at once: the session that opened it is not returning to it, so no later commit of its own will carry the handoff.

Such a branch is created and left: it takes no working tree and does not become the branch this session works on.

`docs/backlog.md` holds identified changes, deleted when archived; an entry there is the separate proposed change the scope rule calls for, recorded rather than opened.

It sits outside the change that recorded it, because a note kept inside one is archived with it: it is the change succeeding, not the session ending, that would lose it.

**A `docs/backlog.md` entry's number is an identifier, not a priority, and it is not stable.** The names are stable; cite an entry by name, never by number.

**Assumptions.** Do not silently invent a requirement that was not stated and cannot reasonably be inferred; where an important decision cannot be inferred, ask rather than guess. Record significant decisions in this project's own artifacts rather than in conversation history alone.

**The repository is the source of truth.** Do not rely on earlier conversation context for information the repository itself can supply. Prefer reading a file, a spec or a commit over recalling what a previous exchange said about it.

**Markdown prose.** Do not hard-wrap prose. Keep each paragraph on a single line whatever its length. Use a line break only where Markdown's own structure requires one.
<!-- /ai-toolkit:development-workflow -->

<!-- ai-toolkit:project-foundation -->
## Testing Strategy

Tests are written at the lowest level that can show the behaviour; the `domain` layer carries most of them.

- **Unit tests sit beside the file they test**, as `*.spec.ts` / `*.spec.tsx`: domain (pure, no database, framework or clock — time is passed in), application handlers (in-memory fakes for ports, including the graph ports), LangGraph.js graph adapters (fake model, no network), ACL translation (recorded fixtures for Health Connect, the monobank webhook and the AI provider; no live external calls), web and mobile components.
- **Integration tests live apart**, in `libs/<context>/<lib>/tests/integration/**/*.integration.spec.ts`: driven adapters against real PostgreSQL and Redis through Testcontainers, one throwaway instance per run. That per-run instance is this project's namespace under the workflow's shared-service rule; verification never uses the `docker compose` services, which are for manual local development only.
- **API end-to-end tests** live in `apps/api-e2e/`: supertest against a booted app on Testcontainers.
- **Runners:** Vitest for libraries, `apps/api` and `apps/web`, compiling Nest code through SWC (`unplugin-swc`); Jest with `jest-expo` for `apps/mobile`.
- **Not automated:** Health Connect permissions, background sync and battery-optimization behaviour are verified by hand on the reference device.
- **AI quality is evaluated, not gated:** Langfuse datasets and evals measure plate-assessment and weekly-review quality; they are not part of the CI gate.

**Test command:** `pnpm nx affected -t test` (CI), `pnpm nx run-many -t test` (whole suite); integration: `pnpm nx affected -t integration` (needs Docker); API end-to-end: `pnpm nx e2e api-e2e`.

**Test-path glob:** `{apps,libs}/**/*.spec.{ts,tsx}`, excluding `**/*.integration.spec.ts` and `apps/api-e2e/**` (the `test` target); end-to-end: `apps/api-e2e/**/*.spec.ts` (the `e2e` target); integration: `{apps,libs}/**/tests/integration/**/*.integration.spec.ts` (the `integration` target).

These commands exist once the workspace is scaffolded (roadmap Phase 1); until then the project has no test suite.

## Development Tooling

- **Node.js 24 LTS** (`.nvmrc`, `engines`); **pnpm** pinned through `packageManager` and Corepack.
- **TypeScript `strict`**; `experimentalDecorators` and `emitDecoratorMetadata` only in projects compiling Nest code.
- **ESLint** flat config with the Nx and typescript-eslint presets and `@nx/enforce-module-boundaries`. ESLint stays the linter even though NestJS 12 generates oxlint: the boundary rule exists only for ESLint. Boundary violations are fixed, never silenced with `eslint-disable`.
- **Prettier** for formatting.
- **Nx targets:** `lint`, `typecheck`, `test`, `integration`, `build`, `e2e`.
- **CI:** GitHub Actions, `pnpm nx affected -t lint typecheck test integration build e2e` with `nrwl/nx-set-shas`. CI is the authority; no local hook is.
- **Local services:** `docker compose` for PostgreSQL, Redis and Langfuse, for manual development only; verification uses Testcontainers.
- **Migrations:** drizzle-kit.
- **Commits:** Conventional Commits.
<!-- /ai-toolkit:project-foundation -->
