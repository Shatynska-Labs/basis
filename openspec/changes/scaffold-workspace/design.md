## Context

The repository holds documents only: no `package.json`, no projects, no CI. The toolchain is decided in ADR-0005 (Nx on pnpm workspaces), ADR-0012 §5–§7 (`Result`, the shared kernel, tags and boundaries) and `AGENTS.md` ("Testing Strategy", "Development Tooling"); this change installs it. The owner's other repositories (`windmill`, `mcp-event-scraper`, `portfolio`, `infrastructure`) converge on the same repository-level layer — EditorConfig, Prettier with `format:check` in CI, husky with lint-staged and commitlint, gitleaks, Dependabot — and this design reuses it, adapted to Nx and pnpm.

The workflow (`AGENTS.md`, "Your branch and working tree") runs several sessions in sibling working trees under `.worktrees/` and `.claude/worktrees/`, inside the repository's own directory. Any recursive tool that does not read `.gitignore` will descend into them.

## Goals / Non-Goals

**Goals:**

- Every Nx target the CI command names either runs over a real project or is absent because no project has it yet — never a green run over nothing.
- Each check in the gate is shown to fail on the defect it claims to catch before the change is reported complete.
- A new working tree reaches a verifiable state by named, repeatable provisioning steps.

**Non-Goals:**

- Branch protection and required status checks: repository settings, not repository content. The operator sets them once the first CI run exists (tasks name it).
- Nx Cloud or a remote cache.
- Coverage. No provider or threshold is configured; a threshold over one library would be noise, and it is added when there is code worth measuring.
- Skipping documentation that a program reads. No Markdown is read by code or tests today; the change that introduces such a reader carves the file out of the documentation-only set (decision 11).

## Decisions

### 1. Build the workspace with `nx init` and Nx plugins, not `create-nx-workspace`

`create-nx-workspace` refuses a non-empty directory and would create a sibling to move back. The root `package.json`, `pnpm-workspace.yaml` and `.npmrc` are written by hand; `nx init` then adds `nx.json`, and `nx add` installs `@nx/js`, `@nx/eslint` and `@nx/vitest` (or `@nx/vite`, whichever carries the Vitest plugin in the release installed), whose inferred targets supply `typecheck`, `lint` and `test` without per-project target configuration. Nx Cloud is declined at `nx init` and `nx.json` carries `neverConnectToCloud: true`.

Every package is the current stable release at apply time, saved exactly (`.npmrc`: `save-exact=true`); Dependabot moves them. pnpm 10 runs no dependency lifecycle scripts by default, so the packages that need one (Nx's native binary, esbuild, SWC when it arrives) are listed in `pnpm.onlyBuiltDependencies` as `pnpm install` names them.

### 2. TypeScript project references with workspace packages, not path aliases

Nx's current default for a new TypeScript workspace is project references, each library a pnpm workspace package (`@basis/shared-core`) linked into `node_modules`. ADR-0005 already puts Nx on pnpm workspaces, and resolution through `node_modules` needs no per-tool alias configuration: Metro (ADR-0002), Vite and Nest's SWC build all resolve a linked package natively, where `tsconfig` `paths` need a plugin or option in each. `tsconfig.base.json` carries `strict`, `composite`, `declaration` and `customConditions` as the Nx generator writes them. The cost is a `tsconfig.lib.json`/`tsconfig.spec.json` pair per library and `references` kept in sync, which `nx sync` does and CI checks (`nx sync:check`).

Alternative rejected: `tsconfig.base.json` `paths` aliases — the older Nx default, simpler to read, but every non-`tsc` consumer then needs its own alias configuration.

### 3. Encode ADR-0012 §7 in full now

`eslint.config.mjs` carries every row of ADR-0012 §7 as `depConstraints` — every `type:*` and `scope:*` tag, the app rows and the external-import bans — although only `type:core` and `scope:shared` have a project today. A constraint written when its first library arrives is a constraint that first library was never checked against. `type:core` gets `onlyDependOnLibsWithTags: []` and `bannedExternalImports: ['*']`, which is what "depends on nothing" means.

ADR-0012 §7's open-ended "every framework, ORM, database, queue, HTTP and SDK package" is enumerated once, as a shared list in `eslint.config.mjs`, so later contexts inherit a list rather than a guess: `@nestjs/*`, `drizzle-orm`, `drizzle-kit`, `pg`, `postgres`, `ioredis`, `redis`, `bullmq`, `@langchain/*`, `langfuse`, `langfuse-*`, `express`, `fastify`, `axios`, `undici`, `react`, `react-dom`, `react-native`, `expo`, `expo-*`, `@aws-sdk/*`, `openai`, `@anthropic-ai/*`, `@google/*`. `type:util` and `type:domain` ban that list; `type:application` bans it except `@nestjs/common` and `@nestjs/cqrs`. A package added later that belongs to one of those classes is added to the list in the change that introduces it.

External-import bans govern production code, not the files that test or configure it. The boundary rule is therefore configured twice: once for every TypeScript file with the full constraints, and once more, matching only `**/*.spec.ts`, `**/*.spec.tsx`, `**/vitest.config.*`, `**/vite.config.*` and `**/eslint.config.*` — whatever name the generator gives the project's test-runner configuration — with the same tag constraints but no `bannedExternalImports` or `allowedExternalImports`. The later block replaces the rule's options for those files only. This is scoping by file class, decided here, not silencing: no `eslint-disable` is written, a production file under `src/` stays fully banned, and the tag constraints between libraries apply to tests as well. Rows naming `apps/*` are expressed through `type:app` tags (`type:app` with `scope:api`, `scope:web`, `scope:mobile`) that those apps will carry; the tag names are fixed here so the apps' changes only apply them.

`eslint-config-prettier` comes last, so formatting is Prettier's alone.

### 4. Prettier formats Markdown, once, in its own commit; archived records are left alone

Prettier runs over the whole repository (`format:check` in CI). Its configuration is Nx's default (`singleQuote: true`) plus `proseWrap: "preserve"`, which keeps the project's one-line-per-paragraph rule intact. Every existing Markdown file is formatted in a single `style:` commit containing nothing else, so the reformat is reviewable as mechanical. `.prettierignore` lists `pnpm-lock.yaml`, `.nx/`, `coverage/`, `dist/` and `openspec/changes/archive/`: an archived change record is a record of what was decided and is not rewritten afterwards, even cosmetically.

`AGENTS.md` opens with the `ai-toolkit:development-workflow` block, which the toolkit regenerates wholesale and marks "Do not edit". Prettier would rewrite its emphasis markers and spacing, and each toolkit update would revert that, failing `format:check`. The block is wrapped in `<!-- prettier-ignore-start -->` / `<!-- prettier-ignore-end -->` placed outside its own markers, so the toolkit, which locates the block by its markers, replaces only what lies between them, while the rest of `AGENTS.md` stays formatted. The `ai-toolkit:project-foundation` block is project-owned and never regenerated (`ai-toolkit` `rules/project-foundation.md`), so it is formatted like any other content.

Alternative rejected: excluding `docs/` and `openspec/` entirely — no reformat, but the project's most-edited files would stay outside the formatter for good.

### 5. Every recursive tool is scoped away from the working-tree roots

`.gitignore` gains `.claude/worktrees/` beside the existing `.worktrees/`. Nx, Prettier 3 and lint-staged read `.gitignore`; ESLint's flat config does not, so `eslint.config.mjs` imports it through `includeIgnoreFile` from `@eslint/compat` rather than repeating the list. Vitest runs per project from each project's own root, so it never sees a sibling tree. The check is a task: create probe working trees nested inside this tree's own ignored roots (`.worktrees/probe` and `.claude/worktrees/probe`, each through `git worktree add`), give each a deliberate defect, run every tool from this tree's root, and see none of them report it. This reproduces the main working tree's situation, where the sibling trees live, inside a tree that already has the tooling.

### 6. Hooks run the project checks, scoped to what changed

The owner's recent repositories split two ways: the JavaScript ones run only lint-staged at commit, while `commerce-ops` runs its type checker, import contracts and unit tier at commit and its integration tier at push. This project follows `commerce-ops`, so a failure is caught before a push rather than after a CI run; Nx makes the scoping cheap, because `nx affected` selects only the projects a change reaches and replays cached results for the rest. CI stays the authority (`AGENTS.md`): a hook can be bypassed, and is absent in a clone that never ran `pnpm install`.

`prepare: husky` installs the hooks on `pnpm install`.

- **`pre-commit`**: `pnpm exec lint-staged` (ESLint `--fix` then Prettier on staged code; Prettier on staged Markdown, JSON and YAML); then `gitleaks git --pre-commit --staged --redact` if `gitleaks` is on `PATH`, otherwise one line saying the local secret scan was skipped and CI runs it; then `openspec validate --all --strict` if anything under `openspec/` is staged; then, unless `tools/change-scope` judges the staged change documentation-only (decision 11), `pnpm nx affected -t lint typecheck test --files=<staged paths>`.
- **`pre-push`**: reads the refs Git passes on standard input. It judges the push only when exactly one ref is pushed, it is not a deletion, its local commit equals `HEAD`, the working tree has no uncommitted or untracked change, and that commit has one merge base with `origin/main`; then the changed set is `origin/main...HEAD`, the same `base...head` the pull-request gate computes, and the hook prints the ref it judged. In every other case it does not judge and runs the full checks, saying why. Unless the judged push is documentation-only, it runs `pnpm nx affected -t lint typecheck test integration build --base=origin/main --head=HEAD`. These guards are `commerce-ops`'s (`let-a-record-only-push-skip-integration`): the checks run against the working tree, so a push is judged only where the working tree is what is pushed. `integration` needs Docker through Testcontainers; without it the target fails, it does not skip.
- **`commit-msg`**: `pnpm exec commitlint --edit "$1"` with `@commitlint/config-conventional`, whose default ignores admit Git's own merge commits.

A stood-down step prints one line naming what it did not run and why, so a fast green commit is never mistaken for a checked one. A caller that could not judge — the classifier failed, printed something else, or the changed set could not be computed — prints one line saying so before running the full checks, so a broken classifier is visible rather than merely slow.

During `apply`, the derived tests fail by design and the workflow commits with `--no-verify`, which skips every hook; CI and `verify` still run everything.

`core.hooksPath` is written to the repository's shared Git configuration, relative (`.husky/_`), so it resolves per working tree: a tree that has `.husky/` and installed dependencies runs the hooks; a tree whose branch predates this change has no `.husky/_` and Git runs none.

### 7. CI: one workflow, three jobs

`.github/workflows/ci.yml`, on `pull_request` and on `push` to `main`, with `concurrency` cancelling superseded runs and `permissions: { contents: read, actions: read }` — `nrwl/nx-set-shas` lists earlier workflow runs through the API to find the last successful base on `main`:

- **`check`** — checkout with full history, `pnpm/action-setup`, `actions/setup-node` from `.nvmrc` with the pnpm cache, `pnpm install --frozen-lockfile`, `nrwl/nx-set-shas`; on a pull request, `tools/change-scope` judges `base.sha...head.sha` (decision 11). Unless that change is documentation-only, `pnpm nx sync:check` and `pnpm nx affected -t lint typecheck test integration build e2e` run exactly as `AGENTS.md` fixes it; where it is, those steps are skipped by an `if:` and a step prints that they stood down and why. The job itself always runs and concludes, so a required `check` is never left pending. Whatever the verdict, it runs `pnpm format:check`, `pnpm audit --audit-level high`, and `pnpm openspec validate --all --strict` (a change with no deltas passes it by declaring `skip_specs: true`, as this project's earlier changes do). The OpenSpec CLI is a pinned dev dependency so CI and a working tree validate with the same version. `integration`, `build` and `e2e` have no project yet; `nx affected` runs nothing for them, which is correct, not a skip, because no project declares them.
- **`secrets`** — gitleaks over the full history, from the release binary at a pinned version checked against its published checksum. `gitleaks-action` is not used: it requires a paid licence for repositories owned by an organisation, which this one is.
- **`commits`** — pull requests only: commitlint over `base.sha..head.sha`.

Actions are referenced by major version, as the owner's other repositories do, and kept current by Dependabot.

### 8. Dependabot and the pull-request template

`.github/dependabot.yml`: the `npm` ecosystem (which covers pnpm) weekly on Monday, minor and patch updates grouped, at most five open pull requests, prefix `chore(deps)`; `github-actions` monthly, prefix `ci`. Both prefixes pass commitlint's header rules, but Dependabot's commit bodies carry release-note URLs longer than `config-conventional`'s 100-character body and footer limits. `commitlint.config.mjs` therefore lists, in `ignores`, a function matching messages carrying Dependabot's `Signed-off-by: dependabot[bot]` trailer: the strict body limits stay in force for human commits, and Dependabot's pull requests pass the `commits` job. `.github/pull_request_template.md` asks for the change name, its stage line, the verification run, and confirmation that no secret is in the diff.

### 9. `Result` follows the shape the earlier project settled

ADR-0012 §5 states `Result<F, S>` with `failure` / `success` and names earlier projects as its origin. `libs/shared/core` takes that shape: `Failure` and `Success` classes carrying a read-only `value`, `isSuccess()` / `isFailure()` as type guards, `Result<F, S> = Failure<F, S> | Success<F, S>`, and the constructors `failure` and `success`. Nothing else — no `map`, `flatMap` or `match` — until a handler needs one; each is an addition that can be specified when it is. The library is tagged `scope:shared`, `type:core`, has no `build` target (consumers compile it from source through the workspace package), and its `package.json` declares no dependency. Requirements are in `specs/shared-core/spec.md`.

Layout: `libs/shared/core/src/index.ts` (the public entry point, re-exporting), `src/lib/result.ts` (the implementation), `src/lib/result.spec.ts` (the tests). Tests are derived from the spec into `src/lib/result.spec.ts` after the plan is committed and before apply, importing from `../index` so they test the public entry point; they cannot run until the workspace exists and fail by design until `result.ts` does. Task 4.1 generates the library around that file: anything the generator writes at the same paths, or as sample code, is discarded and the derived spec file kept.

### 10. The project names its provisioning steps

The workflow makes provisioning complete only when every step the project names is reached. `AGENTS.md` gains, beside "Development Tooling", the steps for a new working tree: `nvm use` (Node from `.nvmrc`), `corepack enable`, `pnpm install --frozen-lockfile` (which also installs the hooks), and optionally a `gitleaks` binary. Until all are reached, verification is reported as not run.

### 11. One declaration decides what is documentation-only, and it fails closed

`commerce-ops` reached the same need through four changes (`let-a-record-only-change-skip-the-suite`, `skip-ci-postgres-on-record-only`, `let-a-record-only-push-skip-integration`, `let-a-readme-change-skip-the-suite`), driven by every change ending in a records-only archive pull request that paid the full gate. Its lessons are taken here from the start:

- **One declaration, asked by every caller.** `tools/change-scope/src/docs-only.ts` holds the rule; the commit hook, the push hook and CI call it. No glob, `paths-ignore` or regex restates it, because two spellings of one set drift.
- **Kind and location together.** A path is documentation if it ends in `.md` (anywhere), or ends in `.yaml` under `openspec/` — an archive commit carries the change's `.openspec.yaml`, and nothing but `openspec validate` reads it. Every other path is not, however it is located. Suffixes are matched case-sensitively, so `.MD` is not documentation. A path that is absolute, starts with `./`, or contains an empty or `..` segment is not documentation either: `git diff` never prints one, so meeting one means the input is not what the rule was written for.
- **Carve-outs come first.** A list of paths that are never documentation, whatever their suffix, is declared beside the rule and is empty today. A change that makes a program read a Markdown file — a test reading a README, an app bundling a document — adds it there.
- **Fail closed.** An empty change is not documentation-only, an unrecognised path is not, and any error in the classifier or in computing the changed set makes the caller run the full checks. The changed set is computed with `git diff --name-only --no-renames` and no `--diff-filter`, so a deletion and both sides of a rename are judged: a commit that only deletes TypeScript, or renames a `.ts` into `docs/`, receives the full checks.
- **Checks whose subject is documentation always run**: Prettier, `openspec validate`, gitleaks and commitlint.

The classifier is TypeScript in its own Nx project, `tools/change-scope` (`scope:tooling`, `type:tooling`), so it is linted, type-checked and unit-tested like any other project. The two tags extend ADR-0012 §7, which predates tooling projects: `type:tooling` gets `onlyDependOnLibsWithTags: []` and bans every external import except Node's built-ins (`node:*`), because the classifier must run before dependencies are installed; and no row lets anything depend on `type:tooling` — the app rows, `apps/api`'s "any library" included, are written as tag lists that do not name it. It uses only Node's standard library and erasable TypeScript syntax, which its `tsconfig` enforces with `erasableSyntaxOnly: true`, in one file, so callers run it as `node tools/change-scope/src/docs-only.ts` with Node 24's native type stripping, before or without `pnpm install`. It reads newline-separated paths on standard input and prints `docs-only` or `full`; callers treat any other output or a non-zero exit as `full`. Its exported function takes the list of paths, and optionally a list of exceptions defaulting to the declared one, and returns the verdict; the declared list is exported too; the tests are derived against it in `tools/change-scope/src/docs-only.spec.ts`. Requirements are in `specs/change-scope/spec.md`.

Including `tools/` widens `pnpm-workspace.yaml` to `tools/*` and the test-path glob in `AGENTS.md` to `{apps,libs,tools}/**/*.spec.{ts,tsx}`. The glob is widened in the plan commit, so the tests derived from it are written against the conventions as they will stand.

Alternatives rejected: relying on `nx affected` alone — Markdown at the root or under `docs/` belongs to no project and would already select nothing, but Markdown inside a project selects that project, and the hooks would print no stand-down line; GitHub's `paths-ignore` — a second spelling of the set, and a required check whose workflow does not start stays pending forever.

## Deviations during apply

Recorded where apply departed from the decisions above, and why.

- **pnpm 12, not 10.** Decision 1 asks for the current stable release, which is 12. Since pnpm 11 its settings live in `pnpm-workspace.yaml` (`saveExact`, `engineStrict`, `allowBuilds` in place of `onlyBuiltDependencies`, `overrides`, `auditConfig`); `.npmrc` is no longer read for them, so there is none. pnpm 12 also refuses a release younger than its minimum release age: `eslint` is 10.12.0 and `@fission-ai/openspec` 1.14.2 rather than the day-old latest, and no exclusion was added.
- **TypeScript 6.0.3, not 7.** typescript-eslint supports TypeScript below 6.1, and Nx 23.3 installs 6.0.
- **Generator output removed.** The Nx library generator adds a root `vitest.config.mts` whose `**/vitest.config.*` project glob would descend into nested working trees (decision 5), a coverage provider (a non-goal), `importHelpers` (which needs `tslib`, a dependency `shared/core` may not have) and `customConditions`; all were removed.
- **The derived `result.spec.ts` imports `'../index.js'`, not `'../index'`.** `nodenext` resolution requires the extension (TS2835), and without it the narrowing assertions passed vacuously over `any`. No assertion changed.
- **A project's `eslint.config.mjs` may import the root one by relative path.** The boundary rule otherwise flags the import Nx itself generates; the exemption is an exact regular expression, in the configuration-file block only.
- **OpenSpec's generated `.claude/commands/opsx/` and `.claude/skills/openspec-*/` are not formatted**, for the reason decision 4 gives for the generated workflow block: `openspec update` rewrites them.
- **The `change-scope` requirement on what counts as documentation was split in two.** The pinned OpenSpec CLI rejects a requirement over 500 characters under `--strict`; the commit hook caught it. Behaviour and scenarios are unchanged.
- **An unjudged change runs every project's checks.** The first cut of the hooks fell back to the affected projects, and a documentation-only change with a broken classifier reaches none; probing found it. `unjudged` now runs `nx run-many`.
- **`undici` is overridden to 7.30.1** under `nx` 23.3.0, which pins 7.29.0, affected by two high advisories fixed in 7.29.1. **The `braces` advisory GHSA-vfj7-8cjw-p6xm is ignored**: no fixed release exists, and it is reached only through the OpenSpec CLI's globbing of this repository's own paths.
- **Code review, round 1.** `Failure` and `Success` gained a literal `kind`, because two structurally identical classes narrowed `Result<string, string>` to `never` (a scenario and its derived test were added first). `shared-core`'s library `tsconfig` carries no Node types, so `Buffer` or `process` cannot type-check in code the web and mobile apps share. The commit hook passes paths unquoted (`core.quotePath=false`) and runs every project's checks for a path holding a comma, which `nx affected --files` cannot take. On `main`, each push runs in a concurrency group of its own commit, so no merge commit's run is cancelled or replaced while queued (code review, round 2). The Dependabot exemption requires both its trailer and one of the two headers it writes. Tags in a push are not judged, and a tags-only push checks nothing. CI judges a pull request with the wrapper and classifier taken from its base commit, so a pull request is not judged by a classifier or wrapper it changes, short of changing the workflow itself, which review covers; an unjudged pull request runs `nx run-many`. Round 2: the push hook recognises a tag by the remote ref, not the local one; the commit hook runs every project's checks for a path Git still quotes; the classifier stays a single file, since CI copies it alone. `kind` is public: it is what makes the two classes structurally distinct, and it is an implementation detail of `Result`, not a second interface callers are meant to use; `isSuccess()` and `isFailure()` remain the specified way to tell them apart.
- **CI probes (task 8.4).** A failing `format:check` skipped `audit` and `openspec validate`, which decision 7 runs whatever the verdict; the three now run whenever dependencies installed, so each reports on every pull request.
- **After the first merge.** The CI fix above was pushed after PR #5 merged at `8316b2d`, so it ships in a pull request of its own. Dependabot's first run proposed `@types/node` 26 for a Node 24 project (#9); `dependabot.yml` now ignores its major updates, which follow `.nvmrc` by hand.
- **Accepted, not changed.** The commit hook checks the working tree rather than the staged blobs, so a partial `git add -p` can pass or fail on what is not staged; an empty staged change (a message-only amend) runs every project's checks; the push hook diffs against the local `origin/main`, which a stale fetch inflates into `full`. Each errs towards running more, and CI is the authority.
- **commitlint 21 does not count URLs toward line length**, so the Dependabot exemption (decision 8) was verified with a long plain line rather than a long URL.

## Risks / Trade-offs

- [Nx plugin and package names shift between majors, e.g. where the Vitest plugin lives] → decisions name what each tool must provide, not a package version; apply installs the current release and records the resolved names in `AGENTS.md` only where a contributor needs them.
- [`pnpm audit --audit-level high` fails a pull request over an advisory unrelated to it] → accepted: the fix is a dependency bump, which Dependabot opens; an advisory with no fix is recorded and excluded through `pnpm.auditConfig.ignoreCves` with the reason beside it, never by lowering the level.
- [A working tree whose `.husky/_` exists but whose dependencies are not installed cannot commit, because the hooks call `pnpm exec`; a tree with no `.husky/_` runs no hooks at all] → provisioning is named (decision 10); `--no-verify` remains available and CI repeats every hook check.
- [The one-off Markdown reformat touches many files and can conflict with another branch editing docs] → it is a separate commit, so a conflict is resolved by re-running Prettier rather than by hand.
- [Encoding constraints for tags no project carries yet cannot be shown to fail now] → the constraints that can fail today are provoked (tasks); each other row is first exercised by the change that adds a project carrying its tag, which owes the same provocation for its own row.
- [Commits slow down as projects grow, because the commit hook runs the affected projects' tests] → `nx affected` and the local cache bound the cost to what the change reaches; documentation-only commits stand down; a hook can be bypassed with `--no-verify` and CI still runs everything.
- [A later change makes a program read a Markdown file and nobody adds it to the exceptions, so later edits to it stand down silently] → `AGENTS.md` states the obligation where every session reads it (task 9.1). No guard test enforces it at this scope, unlike `commerce-ops`'s; that is an accepted residue, revisited when the first reader appears.
- [The classifier skips checks while reporting success if it is wrong] → it fails closed (decision 11), its rule is specified and unit-tested, and CI's verdict line names what stood down.
- [Local Node is 22] → provisioning installs 24; `engines` with `engine-strict` makes `pnpm install` refuse the wrong major rather than proceed.
