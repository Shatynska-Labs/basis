## 1. Dependencies and integration target

- [x] 1.1 Add `drizzle-orm` and `pg` to `apps/api` `dependencies`; `drizzle-kit`, `@types/pg` to the root `devDependencies`; `testcontainers`, `@testcontainers/postgresql` and `pg` to `libs/shared/testing`, declining their install scripts in `allowBuilds` (an explicit `false` where pnpm requires a decision); `@basis/shared-testing` as a `devDependency` of `apps/api`; verify `pnpm install` and `pnpm audit --audit-level high` pass
- [x] 1.2 Add the `integration` target to `nx.json` `targetDefaults` and opt `apps/api` into it; add `apps/api/vitest.integration.config.mts` and exclude integration specs from `apps/api/vitest.config.mts`; include `tests/**` and the new configuration in `apps/api/tsconfig.spec.json`; verify `pnpm nx show projects --with-target integration` lists `api`

## 2. Testcontainers setup

- [x] 2.1 Add `startPostgres()` and `freshDatabase()` to `libs/shared/testing` (`postgres:18.6`, a comment naming the infrastructure repository's `platform/docker-compose.yml`), and the Vitest `ProvidedContext` type for the run's URL; update its README
- [x] 2.2 Add `apps/api/tests/integration/global-setup.ts` starting one server per run through an injectable start function (default `startPostgres`), not catching its failure, and providing its URL; verify the `integration-testing` scenarios' specs pass with `pnpm nx run api:integration`

## 3. Database connection and migrations

- [x] 3.1 Add `apps/api/src/database/`: reading `DATABASE_URL`, the global database module (pool with `application_name` `basis-api`, Drizzle database, a pool `error` listener logging the error's class and code and never the URL, pool ended on shutdown), `schema.ts`; import the module in `AppModule`; verify the `api-persistence` unit specs pass
- [x] 3.2 Add `apps/api/drizzle.config.ts`, the `db-generate` target, and generate the baseline migration into `apps/api/migrations/`; add `migrations` to `apps/api/package.json` `files`
- [x] 3.3 Add `apps/api/src/migrate.ts` (applies the history, redacts the URL and password from any failure, exit status `0`/`1`); verify the `api-persistence` integration specs pass
- [x] 3.4 Set an unreachable `DATABASE_URL` in `apps/api-e2e/vitest.e2e.config.mts`; verify `pnpm nx e2e api-e2e` passes, including the unreachable-database scenario
- [x] 3.5 Build the image locally (`docker build -f apps/api/Dockerfile .`) and verify `/app/migrations` and `/app/dist/migrate.js` are in it

## 4. Delivery

- [x] 4.1 `tools/delivery/src/render-env.ts`: render `DATABASE_URL` from `DATABASE_PASSWORD`, refusing an empty one; update the existing render specs' calls for the new input
- [x] 4.2 `tools/delivery/src/check-compose.ts`: check every declared service's resolved image, passing a configuration without `migrate`
- [x] 4.3 `deploy/api/docker-compose.yml`: add the `migrate` service and `api`'s `depends_on`; update the file's header comment
- [x] 4.4 `.github/actions/deliver-api/action.yml`: the `database-password` input, refused when empty, passed to rendering through `env:`; `deploy.yml` and `promote.yml` pass `secrets.BASIS_API_DATABASE_PASSWORD`
- [x] 4.5 Verify `pnpm nx test delivery` passes, and `docker compose config` resolves the Compose file with a rendered sample `.env`

## 5. Record and verification

- [x] 5.1 `AGENTS.md` (_Deployment_: the migration service and `BASIS_API_DATABASE_PASSWORD`; _Testing Strategy_: the Testcontainers helpers, integration specs in `apps/*/tests/integration` as well as libraries', a project opting into `integration` excluding its integration specs from `test`, and api-e2e not on Testcontainers yet); `apps/api/README.md`; `docs/backlog.md` entries `share-the-database-connection` and `probe-the-database-before-delivery`
- [x] 5.2 Dispose of the `test-plan.md` _Missing shared arrangement_ entries
- [x] 5.3 Run `pnpm nx run-many -t lint typecheck test integration build e2e`, `pnpm nx sync:check`, `pnpm format:check`, `openspec validate --all --strict`

## 6. Ship

- [x] 6.1 Operator: provision `basis-api`'s database on `main-staging` and store `BASIS_API_DATABASE_PASSWORD` in `staging` (infrastructure `docs/onboard-an-application.md` §3.2), before the merge — done 2026-10-19 on the operator's instruction, by the recipe verbatim through `ops-claude`; checks: database owned by `basis-api`, `pgexporter` has no `CONNECT`, no role statement in `docker logs`
- [x] 6.2 Merge the implementation; staging's Deploy run succeeds — pull request #26, merged 2026-10-19 as `ebc0b22`; staging's Deploy run 39292414549 succeeded
- [x] 6.3 Confirm on staging: the `migrate` container exited `0` and `drizzle.__drizzle_migrations` in `basis-api` holds the baseline — confirmed by the operator on 2026-10-19: `migrate` exited `0` ("Migrations applied."), one migration recorded, no table outside `drizzle`, `/health` named `ebc0b22`
- [x] 6.4 Operator: provision `basis-api`'s database on `main-production` and store `BASIS_API_DATABASE_PASSWORD` in `production`; promote; the promotion's wait passes — provisioned by the operator with the recipe on 2026-10-19 (checks as for staging pass); promotion run 39293600189 of `ebc0b22` succeeded; on production `migrate` exited `0`, one migration recorded, no table outside `drizzle`
- [x] 6.5 Archive; delete nothing from `docs/backlog.md` except as the archive re-read directs
