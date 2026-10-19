## 1. Library

- [ ] 1.1 Create `libs/shared/infrastructure` mirroring `libs/shared/core` (`package.json` named `@basis/shared-infrastructure`, tags `scope:shared` and `type:infrastructure`, exports, `main`, `types` and `files` on `dist/`, `drizzle-orm` and `pg` dependencies at the exact versions `apps/api` declares; `tsconfig.lib.json` emitting JavaScript; `tsconfig*.json`, `vitest.config.mts`, `eslint.config.mjs`; `README.md` recording what enters it, the driving/driven split and design decision 6). Add it to the root `tsconfig.json` references, run `pnpm install` and `pnpm nx sync`, and verify that `pnpm nx show project shared-infrastructure` lists the tags and a `build` target, and that `pnpm-lock.yaml` holds one `drizzle-orm` peer variant
- [ ] 1.2 Add `src/driven/database.ts` (`DATABASE`, `Database` per design decision 4) and `src/index.ts`, and verify that `pnpm nx build shared-infrastructure` emits `dist/index.js`

## 2. Boundary rules

- [ ] 2.1 In `eslint.config.mjs`, let `type:infrastructure` depend on `type:infrastructure`, and verify that the derived boundary spec passes and `pnpm nx run-many -t lint` stays green

## 3. The API takes the shared token

- [ ] 3.1 Add `@basis/shared-infrastructure` to `apps/api`'s `dependencies` and `dependsOn: ["^build"]` to its `build` target. In `database.module.ts`, import `DATABASE` and `Database` from the library, remove the local declarations, and create the connection without `{ schema }`. Update `schema.ts`'s comment and every import of `DATABASE` in `apps/api` specs and `tests/`
- [ ] 3.2 Delete `libs/shared/infrastructure/dist`, then verify with `pnpm nx run-many -t lint typecheck test build`, `pnpm nx run-many -t integration` and `pnpm nx e2e api-e2e`, and with `docker build -f apps/api/Dockerfile .` followed by the container answering `/health`

## 4. Record

- [ ] 4.1 Amend ADR-0012 §6 (the library's row) and §7 (`type:infrastructure` row), and add the library to `AGENTS.md` where shared libraries are named if any. Verify `pnpm format:check` and `openspec validate --all --strict`
- [ ] 4.2 Dispose of `test-plan.md`'s _Missing shared arrangement_ entries

## 5. Ship

- [ ] 5.1 Merge the implementation pull request and wait for the operator's word that staging's deploy is healthy
- [ ] 5.2 Confirm on staging, or record a waiver
- [ ] 5.3 Promote, on the operator's act, and wait for the smoke wait to pass
- [ ] 5.4 Delete `share-the-database-connection` from `docs/backlog.md`, and update the entries it unblocks, in the archive pull request
