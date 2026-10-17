## Why

The foundation (ADR-0005, ADR-0012, `AGENTS.md` "Development Tooling" and "Testing Strategy") decides the toolchain, but nothing installs it: the repository has no `package.json`, no lint, typecheck, test or format target, and no CI. Every later change, starting with `identity` and `metrics` in roadmap Phase 1, needs a gate to verify against, and a gate that runs over an empty workspace passes without checking anything. This change is the first slice of Phase 1: the workspace, the gate, and one real library for the gate to run on.

## What Changes

- **Workspace**: Nx on pnpm workspaces at the repository root; Node.js 24 LTS through `.nvmrc` and `engines`; pnpm pinned through `packageManager` and Corepack; `pnpm-workspace.yaml` covering `apps/*`, `libs/**` and `tools/*`.
- **TypeScript**: strict, in Nx's TypeScript project-references setup, each library a pnpm workspace package; no decorator options yet, since no project compiles Nest code.
- **ESLint**: flat config with the Nx and typescript-eslint presets and `eslint-config-prettier`; `@nx/enforce-module-boundaries` carrying ADR-0012 §7's full `depConstraints` table and external-import bans now, so the first library of each tag is checked from its first commit.
- **Prettier** and **EditorConfig** at the root; every existing Markdown file formatted once, in a commit of its own.
- **Vitest** as the library test runner, run through the Nx `test` target.
- **Local hooks** (husky): `pre-commit` runs lint-staged (ESLint and Prettier on staged files), gitleaks when installed, and `lint`, `typecheck` and `test` over the projects the staged change affects; `pre-push` runs `lint`, `typecheck`, `test`, `integration` and `build` over the projects the push affects relative to `origin/main`; `commit-msg` runs commitlint with the Conventional Commits preset. Hooks catch failures before CI does; CI stays the authority.
- **Documentation-only changes stand down**: one declaration, `tools/change-scope`, judges whether a change is documentation-only — Markdown anywhere, or YAML under `openspec/`, and nothing else. Where it is, the commit hook, the push hook and CI skip the project checks and say so, and still run the checks whose subject is documentation: Prettier, `openspec validate`, gitleaks and commitlint. Anything it cannot judge receives the full checks.
- **CI** (GitHub Actions): on pull requests and pushes to `main`, `pnpm nx affected -t lint typecheck test integration build e2e` with `nrwl/nx-set-shas`, as `AGENTS.md` fixes it, plus a whole-repository Prettier check, gitleaks, commitlint over the pull request's commits, `pnpm audit` at high severity, and `openspec validate`.
- **Dependabot** for npm (weekly, minor and patch grouped) and GitHub Actions (monthly).
- **`libs/shared/core`** (`scope:shared`, `type:core`): `Result<F, S>` with `failure` / `success`, as ADR-0012 §5 and §6 state it, with its unit tests.
- A pull-request template naming the change and its stage.

Not in this change: `apps/api`, `apps/web`, `apps/mobile`, any other library, the `integration` and `e2e` targets (they arrive with the first project that has them), Docker Compose, deployment.

## Capabilities

### New Capabilities

- `shared-core`: language-level additions shared by every layer, starting with `Result<F, S>`.
- `change-scope`: deciding whether a set of changed paths is documentation-only, the one rule the hooks and CI share.

### Modified Capabilities

None. The workspace and its gate are tooling: their requirements are recorded in `design.md` and proved by provoking each check to fail (tasks), not by specification scenarios. The rule they share for documentation-only changes is the exception, specified as `change-scope`, because a mistake in it skips checks while reporting success.

## Impact

- New root files: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `nx.json`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.nvmrc`, `commitlint.config.mjs`, `.husky/`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/pull_request_template.md`.
- New projects: `libs/shared/core`, `tools/change-scope`.
- `AGENTS.md` "Testing Strategy": the test-path glob widens to `{apps,libs,tools}/**/*.spec.{ts,tsx}`.
- Existing Markdown under `docs/`, `openspec/specs/` and the root reformatted by Prettier; content unchanged. Archived change records are left as written.
- `.gitignore` gains `.claude/worktrees/`, the Claude Code working-tree root, beside the existing `.worktrees/`.
- Contributors need Node.js 24 and Corepack; gitleaks locally is optional.
- `AGENTS.md` "Development Tooling" gains the hooks and their documentation-only stand-down, gitleaks, Dependabot and the CI steps beyond `nx affected`, and the project names its provisioning steps for a new working tree.
