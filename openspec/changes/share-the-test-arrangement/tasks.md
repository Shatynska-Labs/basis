## 1. Library

- [x] 1.1 Create `libs/shared/testing` (`package.json` named `@basis/shared-testing` with tags `scope:shared`, `type:testing`; `tsconfig*.json`, `vitest.config.mts`, `eslint.config.mjs`, `src/index.ts`, `README.md` stating what may enter it, that it depends on no workspace library, and that consumers add it as a `devDependency`), mirroring `libs/shared/core`; verify `pnpm nx show project shared-testing` lists the tags and `pnpm nx run shared-testing:typecheck` passes
- [x] 1.2 Add the project to the root `tsconfig.json` references and run `pnpm install` so the workspace links it; verify `pnpm nx sync:check` passes

## 2. Boundary rules

- [x] 2.1 In `eslint.config.mjs` add the `type:testing` row and list `type:testing` in the allowed dependencies of every library and app type row; verify the lint spec's "spec imports" and "no workspace dependency" scenarios pass
- [x] 2.2 In `eslint.config.mjs` add the file-level `no-restricted-imports` block banning `@basis/shared-testing` outside spec files, `tests/` directories and test or tool configuration; verify the lint spec's "production code" and "tests directory" scenarios pass and `pnpm nx run-many -t lint` stays green

## 3. Verification and record

- [x] 3.1 Make the derived lint spec in `libs/shared/testing` pass with `pnpm nx test shared-testing`, with no `eslint-disable` added anywhere
- [x] 3.2 Update `AGENTS.md` _Testing Strategy_ (shared test arrangement: `libs/shared/testing`) and ADR-0012's library and tag tables; verify `pnpm format:check` passes
- [x] 3.3 Dispose of the `test-plan.md` _Missing shared arrangement_ entries (expected none) and run `pnpm nx affected -t lint typecheck test build` and `openspec validate --all --strict`
