# api

The NestJS API (`deploy-api-skeleton`), with its PostgreSQL connection and migration history (`add-persistence-skeleton`).

- **Database.** The API connects to the database `DATABASE_URL` names and refuses to start without it. The connection is opened on the first query, so `/health` answers whether or not the database is reachable. The pool and the Drizzle database are provided by `src/database/database.module.ts`.
- **Migrations.** One drizzle-kit history (ADR-0011): `drizzle.config.ts` reads every context's schema through `src/database/schema.ts` and writes to `migrations/`, which ships in the image beside `dist/`. Generate a migration after changing a schema with `pnpm nx run api:db-generate` (no database needed), and review the SQL it writes. Apply the history with `pnpm nx build api` then `DATABASE_URL=postgres://… node apps/api/dist/migrate.js`; deliveries run the same command as the Compose service `migrate` before the API starts. It exits `1` on any failure, printing the error with the URL and its password redacted.
- **Tests.** Unit specs beside their files (`pnpm nx test api`); integration specs in `tests/integration/` against a throwaway PostgreSQL per run (`pnpm nx run api:integration`, needs Docker); end-to-end in `apps/api-e2e`.
