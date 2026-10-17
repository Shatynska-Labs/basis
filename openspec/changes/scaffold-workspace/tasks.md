## 0. Before apply

The plan is committed, then tests are derived from `specs/shared-core/spec.md` into `libs/shared/core/src/lib/result.spec.ts` (decision 9) and from `specs/change-scope/spec.md` into `tools/change-scope/src/docs-only.spec.ts` (decision 11) by an author other than the implementer. Apply starts only once both hold.

## 1. Provisioning

- [ ] 1.1 Install Node.js 24 LTS (`nvm install 24`), write `.nvmrc` with `24`, run `nvm use` and `corepack enable`; verify `node -v` reports v24 in the working tree.

## 2. Workspace

- [ ] 2.1 Write the root `package.json` (private, `engines.node` `>=24 <25`, `packageManager` pinned to the current pnpm 10 release), `pnpm-workspace.yaml` (`apps/*`, `libs/**`, `tools/*`) and `.npmrc` (`save-exact=true`, `engine-strict=true`); verify `pnpm install` succeeds and refuses under Node 22 (`nvm exec 22 pnpm install` fails on the engine check).
- [ ] 2.2 Run `nx init` declining Nx Cloud, set `neverConnectToCloud: true` in `nx.json`, and `nx add` the JS, ESLint and Vitest plugins (design decision 1); verify `pnpm nx report` lists them and `pnpm nx show projects` runs.
- [ ] 2.3 Add `.claude/worktrees/` to `.gitignore`; verify `git check-ignore .claude/worktrees/x` matches.
- [ ] 2.4 List the packages `pnpm install` reports as having ignored build scripts in `pnpm.onlyBuiltDependencies`; verify a fresh `pnpm install --frozen-lockfile` prints no ignored-build warning.

## 3. TypeScript, ESLint, Prettier, EditorConfig

- [ ] 3.1 Write the strict TypeScript project-references base (`tsconfig.base.json`, root `tsconfig.json`) as decision 2 describes; verify `pnpm nx sync:check` passes.
- [ ] 3.2 Write `eslint.config.mjs`: Nx and typescript-eslint presets, `includeIgnoreFile` over `.gitignore`, `@nx/enforce-module-boundaries` with every ADR-0012 §7 row and external-import ban and the `type:app` tags of decision 3, `eslint-config-prettier` last; verify `pnpm eslint .` runs clean.
- [ ] 3.3 Write `.prettierrc` (`singleQuote: true`, `proseWrap: "preserve"`), `.prettierignore` (decision 4) and `.editorconfig` (utf-8, lf, two-space indent, final newline, trailing whitespace trimmed except in Markdown); add `format` and `format:check` scripts; wrap `AGENTS.md`'s workflow block in `prettier-ignore-start`/`-end` outside its markers (decision 4); run `pnpm prettier --write` over every non-Markdown file; verify `pnpm prettier --check . '!**/*.md'` passes.
- [ ] 3.4 Commit the configuration so far (`build: scaffold the nx workspace`), then run `pnpm format` over the repository and commit only its output as `style: format markdown with prettier`; verify that commit's diff touches no file under `openspec/changes/archive/` and nothing between `AGENTS.md`'s workflow markers, `git diff --stat HEAD~1 -- ':!*.md'` is empty, and `pnpm format:check` passes.

## 4. `libs/shared/core`

- [ ] 4.1 Generate `libs/shared/core` as package `@basis/shared-core` with the Vitest test runner and no bundler, tagged `scope:shared`, `type:core`, its `package.json` declaring no dependency, keeping the derived `src/lib/result.spec.ts` and discarding generated sample code (decision 9); verify `pnpm nx show project shared-core` lists `lint`, `typecheck` and `test` and no `build`.
- [ ] 4.2 Implement `Result`, `Failure`, `Success`, `failure` and `success` in `src/lib/result.ts` (decision 9) and export them from `src/index.ts`; verify the derived tests for `specs/shared-core/spec.md` pass with `pnpm nx run-many -t test`.
- [ ] 4.3 Run `pnpm nx run-many -t lint typecheck test`; verify all pass.

## 5. `tools/change-scope`

- [ ] 5.1 Generate `tools/change-scope` as a Vitest-tested project tagged `scope:tooling`, `type:tooling`, keeping the derived `src/docs-only.spec.ts`; add the `type:tooling` row and set `erasableSyntaxOnly: true` (decision 11); verify `pnpm nx show project change-scope` lists `lint`, `typecheck` and `test`.
- [ ] 5.2 Implement `src/docs-only.ts` (decision 11): the exported classifier and the standard-input entry point, standard library only; verify the derived tests pass and `printf 'docs/a.md\n' | node tools/change-scope/src/docs-only.ts` prints `docs-only`, `printf 'docs/a.md\nx.ts\n' | …` prints `full`, and an empty input prints `full`.

## 6. Hooks

- [ ] 6.1 Add husky (`prepare: husky`), lint-staged, commitlint with `@commitlint/config-conventional` and `commitlint.config.mjs`; write `.husky/pre-commit`, `.husky/pre-push` and `.husky/commit-msg` as decision 6 describes, each calling `tools/change-scope` and falling back to the full checks on any failure of it; verify `pnpm install` sets `core.hooksPath` to `.husky/_`.
- [ ] 6.2 Verify the hooks: a commit with message `bad message` is rejected; a staged unformatted `.ts` file is reformatted in the commit; with `gitleaks` on `PATH` a staged file holding a fake AWS key pair is rejected; with it absent, a benign staged file commits and the hook prints the skip line; a staged type error and a staged failing test in `shared-core` each block the commit; a commit staging only `docs/*.md` prints the stand-down line and runs no `nx` target; a commit staging a `.md` and a deletion of a `.ts` file runs the project checks; `git mv libs/shared/core/src/lib/result.ts docs/result.md` runs the project checks; with the classifier made to exit non-zero, a docs-only commit prints the could-not-judge line and runs the project checks. Pre-push, with `git push --dry-run` against a scratch branch: a docs-only branch prints the stand-down line and the judged ref; a code branch runs `nx affected`; a forced classifier failure, a push of a ref other than `HEAD`, and a push with an uncommitted change each print why the push was not judged and run the full checks. Undo each probe with `git reset` and `git restore`.

## 7. CI, Dependabot, pull-request template

- [ ] 7.1 Add the OpenSpec CLI as a pinned dev dependency; verify `pnpm openspec validate --all --strict` passes locally.
- [ ] 7.2 Write `.github/workflows/ci.yml` with the `check`, `secrets` and `commits` jobs of decision 7, gitleaks pinned with its checksum verified; verify with `actionlint` that the workflow parses, and that `pnpm audit --audit-level high` passes locally.
- [ ] 7.3 Write `.github/dependabot.yml` and `.github/pull_request_template.md` (decision 8); verify `actionlint` is unaffected, both prefixes pass `commitlint` (`echo 'chore(deps): bump x' | pnpm exec commitlint`, likewise `ci: bump y`), a Dependabot-shaped message with a body line over 100 characters and the `Signed-off-by: dependabot[bot]` trailer passes, and the same message without the trailer fails.

## 8. The gate fails on what it claims to catch

Each probe is made in a commit or on a scratch branch and undone with version control; none reaches the branch.

- [ ] 8.1 Boundaries: an import of a third-party package (e.g. `zod`) in `libs/shared/core/src/lib/result.ts` fails `lint` with the boundary rule, while the spec file's `vitest` import passes (decision 3); a temporary second library tagged `type:util`, imported from `shared-core`, fails `lint`, from production and from test files alike; the test-runner configuration's `vitest` import passes; in `tools/change-scope`, an import of `@basis/shared-core` and of a third-party package each fail `lint`, and `node:fs` passes.
- [ ] 8.2 `typecheck` fails on a type error in `shared-core`; `test` fails on a broken assertion; `format:check` fails on an unformatted Markdown file; `openspec validate --all --strict` fails on a scenario written with three `#`.
- [ ] 8.3 Working-tree scoping (decision 5): create `.worktrees/probe` and `.claude/worktrees/probe` inside this tree with `git worktree add`, each holding a lint error, a type error, a failing test and an unformatted file; from this tree's root, `pnpm eslint .`, `pnpm format:check`, `pnpm nx run-many -t lint typecheck test` and `pnpm nx show projects` report none of them; remove both probes with `git worktree remove --force`.
- [ ] 8.4 After pushing, the first CI run passes on the branch's pull request; a scratch branch with an unformatted file and a non-conventional commit message, opened as a draft pull request, fails `check` and `commits`; a second draft pull request changing only `docs/*.md` passes `check` with the stand-down line in its log and the `nx affected` step skipped; a third, changing only `docs/*.md` with the classifier forced to fail, runs `nx affected` after the could-not-judge line. All three target this change's branch, not `main`, so their diff is the probe alone (`on: pull_request` carries no branch filter); close them and delete the branches.

## 9. Conventions

- [ ] 9.1 Update `AGENTS.md` "Development Tooling" with the hooks (convenience, not a gate), gitleaks, Dependabot and the CI steps beyond `nx affected`; add the hooks' documentation-only stand-down and its declaration (decision 11); write the obligation that a change making code, a test or a build read, import, bundle or copy a Markdown file adds it to `tools/change-scope`'s exceptions; add the provisioning steps of decision 10; remove "These commands exist once the workspace is scaffolded" from "Testing Strategy"; verify `pnpm format:check` passes and the managed workflow block is untouched (`git diff` shows no change inside it).
- [ ] 9.2 Ask the operator to require the `check`, `secrets` and `commits` jobs on `main` in the repository's branch protection once they have run; record the answer in this change. After the first merge, verify the push-to-`main` run passes, which exercises `nx-set-shas`'s base lookup (decision 7).
