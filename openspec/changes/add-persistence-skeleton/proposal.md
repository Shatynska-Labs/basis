## Why

Every Phase 1 context (`identity`, `metrics`) stores data, and the API has no database: no connection, no migration history, no way to migrate a host, and no integration tests although CI already runs the `integration` target. Wiring the database in a change of its own keeps its deploy, secret and CI risk out of the first business change. The interim storage decision recorded under `choose-durable-data-storage` in `docs/backlog.md` (Basis's own database in each host's shared PostgreSQL instance, everything in it treated as data whose loss is tolerable) means nothing blocks it.

## What Changes

- `apps/api` reaches PostgreSQL through Drizzle ORM and `pg`, configured by `DATABASE_URL` alone, and refuses to start without it. The connection is opened lazily, so `/health` still depends on nothing outside the process.
- One drizzle-kit migration history, owned by `apps/api` (ADR-0011): `drizzle.config.ts`, a `migrations/` folder starting with a baseline migration, and a migration entry point shipped in the image.
- Every delivery migrates before the API starts: the Compose file gains a one-shot `migrate` service running the same image by digest, and the API service waits for it to complete successfully, so a failed migration fails the delivery through the host's existing `docker compose up -d --wait`.
- The database URL reaches each host as a secret: the delivery renders `DATABASE_URL` into the host's `.env` from the Environment secret `BASIS_API_DATABASE_PASSWORD`, which the infrastructure repository's provisioning recipe writes per Environment, and refuses to deliver without it. Neither the password nor the URL is printed.
- Integration tests get their setup: a Testcontainers PostgreSQL, one throwaway instance per run, of the shared instance's version, with a fresh database per spec, in `@basis/shared-testing`; an `integration` target on `apps/api` that runs `tests/integration/**/*.integration.spec.ts` apart from the unit tests; a run that cannot reach a container runtime fails.
- No table, repository or business logic is added.

## Capabilities

### New Capabilities

- `api-persistence`: how the API is given its database, how it connects, and how the migration history is applied to a database.
- `integration-testing`: how integration specs run apart from unit specs, against a throwaway PostgreSQL per run, and that they fail rather than pass without a container runtime.

### Modified Capabilities

- `api-delivery`: each delivery migrates the database before the API starts, runs the migration from the same image by digest, renders `DATABASE_URL` from the target's database password, and checks the migration service in what Compose resolves.

## Impact

- `apps/api` (database module, migration entry point, `drizzle.config.ts`, `migrations/`, `package.json` dependencies and `files`, `integration` target, test configuration); `apps/api-e2e` test configuration (an unreachable `DATABASE_URL`).
- `libs/shared/testing` (Testcontainers helpers and their dependencies).
- `deploy/api/docker-compose.yml`, `.github/actions/deliver-api/action.yml`, `.github/workflows/deploy.yml`, `.github/workflows/promote.yml`, `tools/delivery` (`render-env`, `check-compose`).
- `nx.json` (`integration` target defaults), `eslint.config.mjs` (nothing expected: `drizzle-orm`, `drizzle-kit` and `pg` are already enumerated), `AGENTS.md` (Deployment, Testing Strategy), `docs/backlog.md`.
- New dependencies: `drizzle-orm`, `pg` (runtime); `drizzle-kit`, `@types/pg`, `testcontainers`, `@testcontainers/postgresql` (development).
- **Operator prerequisites, before merging**: the infrastructure repository's database recipe (`docs/onboard-an-application.md` §3.2, `app=basis-api`, `secret=BASIS_API_DATABASE_PASSWORD`) run for `staging` on `main-staging`; before promoting, for `production` on `main-production`. Without it the staging deploy refuses to deliver.
