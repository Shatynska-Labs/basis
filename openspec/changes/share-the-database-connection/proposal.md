## Why

`add-persistence-skeleton` gives `apps/api` a global Nest database module that provides the Drizzle database under the `DATABASE` injection token, declared in `apps/api/src/database/`. A context's `infrastructure` library cannot import from an app (ADR-0012 §7), so the first Drizzle repository (`identity` or `metrics`, roadmap Phase 1) has nowhere to take the token from. `docs/backlog.md` records this as `share-the-database-connection`, to be done before that repository.

## What Changes

- Add the library `libs/shared/infrastructure` (`@basis/shared-infrastructure`, tags `scope:shared` and `type:infrastructure`). Like every infrastructure library, its sources are split into `driving/` and `driven/` folders. The connection lives in `driven/`.
- Move the `DATABASE` token and the `Database` type there. `apps/api`'s database module provides the database under the shared token. The `pg` pool, its private token, `DATABASE_URL` handling and the migration process stay in `apps/api`.
- Make `Database` independent of any context's schema. A shared library cannot see the schemas, which `apps/api` collects for drizzle-kit, so repositories use Drizzle's query builder over the tables they import, not the relational query API.
- Let a `type:infrastructure` library depend on the shared `type:infrastructure` library, in `eslint.config.mjs` and in ADR-0012's tag table. Add the library to ADR-0012 §6's table. These amend the tables, not a decision.
- Give the library a JavaScript build and ship it with the API. `apps/api` has so far imported no workspace library at runtime, and a workspace library's package points at TypeScript sources that neither `node dist/main.js` nor the image's `pnpm deploy` output can run.
- Record where ADR-0011's `TransactionManager` lives: the adapter goes in `libs/shared/infrastructure/src/driven/`, and each context's `application` declares the port. It is recorded only; the change that first needs a transaction implements it.

## Capabilities

### New Capabilities

- `shared-infrastructure`: the shared library through which a context's infrastructure takes the API's database, who may depend on it, its driving/driven layout, and that the built API runs with it.

### Modified Capabilities

None. `api-persistence`'s requirements do not name the token's location and stay unchanged.

## Impact

- New project `libs/shared/infrastructure`; `apps/api/src/database/database.module.ts` and its spec; `apps/api/package.json` (dependency, build ordering); `eslint.config.mjs`; root `tsconfig.json` and `apps/api/tsconfig.app.json` references; `docs/adr/0012-context-structure.md` (tables); `docs/backlog.md` (entry deleted at archive).
- The image now carries a workspace library's build output. Runtime behaviour of the API is unchanged.
