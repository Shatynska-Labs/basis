## 1. Configuration

- [ ] 1.1 Add `zod` to `apps/api`'s `dependencies` (the workspace's resolved version). Add `apps/api/src/config/` with `loadConfig(env)`, `ConfigError`, the `APP_CONFIG` token, the `AppConfig` type and a global `ConfigModule` (design decision 1)
- [ ] 1.2 Make `DatabaseModule`'s pool factory and `HealthController` inject `APP_CONFIG`. Import `ConfigModule` in `AppModule`. Keep `readDatabaseUrl` for `migrate.ts`
- [ ] 1.3 Add the `process.env` restriction for `apps/api/src/**` to `eslint.config.mjs` (design decision 2)

## 2. Logging and startup

- [ ] 2.1 Add `apps/api/src/logging/` with `SECRET_KEYS` and `createLogger()` (design decision 4)
- [ ] 2.2 Rewrite `main.ts`: logger first, `NestFactory.create(AppModule, { logger, abortOnError: false })`, the `ConfigError` and other-failure handling, and `listen` on `config.port` taken from `APP_CONFIG` (design decision 3)

## 3. Errors and validation

- [ ] 3.1 Create `libs/shared/domain` mirroring `libs/shared/core` (`@basis/shared-domain`, tags `scope:shared` and `type:domain`, no build, README). Add `DomainError` and `DomainErrorKind`. Add it to the root `tsconfig.json` references and run `pnpm install` and `pnpm nx sync`
- [ ] 3.2 In `libs/shared/infrastructure/src/driving/`, add `problem.ts` (`Problem`, `ProblemException`, `problem(status, extras)`) and `to-response.ts` (design decisions 5 and 7). Export them from `src/index.ts`. Add `@nestjs/common` at `apps/api`'s exact version, and `@basis/shared-core` and `@basis/shared-domain` as type-only references
- [ ] 3.3 Add `apps/api/src/http/` with `ProblemFilter`, the validation pipe's `exceptionFactory` and `HttpModule` providing `APP_FILTER` and `APP_PIPE`. Import it in `AppModule` (design decisions 8 and 9)

## 4. Record and verify

- [ ] 4.1 Update `apps/api/README.md` (configuration, JSON logs, the secrets-in-params rule, the error format), `libs/shared/infrastructure/README.md` (its `driving/` contents) and ADR-0012 §6's `shared/infrastructure` row
- [ ] 4.2 Dispose of `test-plan.md`'s _Missing shared arrangement_ entries
- [ ] 4.3 Verify with `pnpm nx run-many -t lint typecheck test build`, `pnpm nx run-many -t integration`, `pnpm nx e2e api-e2e`, `pnpm format:check` and `openspec validate --all --strict`

## 5. Ship

- [ ] 5.1 Merge the implementation pull request and wait for the operator's word that staging's deploy is healthy
- [ ] 5.2 Confirm on staging: the API's container log lines are JSON, and `GET /no-such-route` answers a `404` problem document
- [ ] 5.3 Promote, on the operator's act, and wait for the smoke wait to pass
- [ ] 5.4 Archive, updating `docs/backlog.md` entries this change touches
