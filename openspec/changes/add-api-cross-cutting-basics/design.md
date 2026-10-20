## Context

See proposal.md, Why. `apps/api` is a NestJS 12 application built by `@nx/js:swc`. `AppModule` imports a global `DatabaseModule`, whose pool factory calls `readDatabaseUrl(process.env)`, and declares `HealthController`, which reads `APP_VERSION` at module load. `main.ts` reads `PORT`. Specs and integration tests create the application context with `NestFactory.createApplicationContext(AppModule)` and set `process.env` around it. The e2e suite starts the built `dist/main.js` as a child process and reads its output. `@nestjs/common` 12.1.3 provides `ConsoleLogger` with `json` and `redact` options, and `StandardSchemaValidationPipe`, which validates against the `schema` passed to `@Body`, `@Query` and `@Param`. `zod` 4 implements Standard Schema. `libs/shared/core` exports `Result`. `libs/shared/domain` does not exist. `libs/shared/infrastructure` is built to `dist/` and imported by the API at runtime, and its `src/driving/` folder has no files yet.

## Goals / Non-Goals

**Goals:**

- One validated configuration, read once, from which every API component takes its values.
- Machine-readable logs in which secret-named properties never appear in clear.
- One error body for every failure, and one mapping from a domain failure to a status, usable by every context's controllers.
- Schema validation of requests that works the moment a route names a schema.

**Non-Goals:**

- A per-request access log (operator's decision; it can be proposed separately).
- A configurable log level or log format. Nothing logs at `debug` yet.
- JSON output from the migration process (`dist/migrate.js`). It prints its own redacted lines, specified in `api-persistence`; the logging requirements cover the HTTP server process only.
- Moving the migration process onto the configuration. It reads only `DATABASE_URL`, and its own redaction and refusal are specified in `api-persistence`.
- A `contracts` library or any context endpoint. The pipe is exercised by test routes.
- Validating responses (`StandardSchemaSerializerInterceptor`).

## Decisions

1. **Configuration: a Zod schema in `apps/api/src/config/`, provided under an `APP_CONFIG` token by a global `ConfigModule`.** `loadConfig(env)` returns `{ databaseUrl, port, appVersion }` or throws `ConfigError`, whose message lists each invalid variable with a fixed description, built by the API and not taken from Zod's issue text, and never contains a value. The rules are:
   - `DATABASE_URL`: a non-empty string, used unchanged, as `api-persistence` requires.
   - `PORT`: unset or empty means `3000`, matching today's `|| 3000`. Otherwise it must be a decimal integer from `1` to `65535`.
   - `APP_VERSION`: unset or empty means `"unknown"`.

   The provider's factory reads `process.env`, so `createApplicationContext(AppModule)` in existing specs still refuses a missing `DATABASE_URL`, with a message naming it. The configuration is validated when the module is created, not lazily, so all variables are checked before anything listens. `DatabaseModule` and `HealthController` inject `APP_CONFIG`. `readDatabaseUrl` stays, for `migrate.ts`. Alternative: `@nestjs/config`. It adds a dependency and a second validation mechanism around the same Zod schema.

2. **`process.env` is read only by the configuration.** In `eslint.config.mjs`, a `no-restricted-properties` rule for `process.env` covers `apps/api/src/**`, except `src/config/**`, `src/migrate.ts` and specs. A later component cannot then bypass validation.
3. **Startup failure.** `main.ts` creates the logger (decision 4) first and calls `NestFactory.create(AppModule, { logger, abortOnError: false })` inside `try`. On a `ConfigError` it logs an `error` entry: the message `Configuration is invalid.`, with param `variables` listing the invalid variables' names and descriptions. It then sets `process.exitCode = 1` and returns without listening. Any other startup error is logged by name and stack and also exits `1`. `abortOnError: false` makes Nest rethrow rather than `process.abort()`, so the exit status is `1`, not a signal. Nest's own exception handler may also log the `ConfigError` before rethrowing; its message is value-free by decision 1, so a second entry discloses nothing, and nothing requires there to be only one.
4. **Logging: Nest's `ConsoleLogger` with `json: true`, `colors: false` and `redact` over `SECRET_KEYS`** (operator's decision), built by `createLogger()` in `apps/api/src/logging/`. It is passed to `NestFactory.create`, so every `Logger` in the app, Nest's own included, writes through it. `SECRET_KEYS` are `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `cookie`, `databaseUrl`, `database_url`, `connectionString` and `connection_string`. Nest matches them case-insensitively at any depth, so `DATABASE_URL` matches `database_url` and `ApiKey` matches `apiKey`; a camelCase and a snake_case form are both listed because case-insensitivity does not bridge the underscore. Nest's `redact` copies only the objects that contain a matching property and does not mutate the caller's (its documented behaviour); a spec checks it. `ConsoleLogger` prints string messages, error messages and stacks as is, so the rule is **a secret goes only into structured params, never into a message string**. The rule is written in `apps/api/README.md`, and lint cannot enforce it. Existing log calls already comply: the pool's idle error logs class and code only. Alternative: pino through `nestjs-pino`. It is faster and has path-based redaction and request logs, but adds two dependencies and a second logging API.
5. **Error body: RFC 9457 problem details** (operator's decision). Content type `application/problem+json`. Members:
   - `type`: always `"about:blank"`. No problem types are published.
   - `title`: the status's reason phrase (`STATUS_CODES` from `node:http`).
   - `status`.
   - optional `detail`.
   - extensions: `code` for a domain failure, `errors` (`[{ path, message }]`, `path` an array of keys) for a validation failure.

   `Problem` and `ProblemException extends HttpException` live in `libs/shared/infrastructure/src/driving/problem.ts`, because a context's controllers and the API's filter both need them.

6. **`DomainError` in a new `libs/shared/domain`** (operator's decision; ADR-0012 §6 already lists it there). It is an abstract class with `abstract readonly kind: DomainErrorKind`, `abstract readonly code: string` and `readonly message: string`. `DomainErrorKind` is `'not-found' | 'conflict' | 'rule-violated' | 'forbidden'`. It does not extend `Error`: it is a value returned in a `Result`, and a stack would suggest a throw (ADR-0012 §5). The kinds are domain-neutral, and the HTTP statuses stay in infrastructure. An application handler's expected failure extends it too, since `type:application` may depend on `type:domain` of `scope:shared`. The library mirrors `libs/shared/core`, has no build, and has no runtime consumer yet, as `share-the-database-connection` decision 5 prescribes ("they gain one when production code first imports them at runtime").
7. **`toResponse(result)` in `libs/shared/infrastructure/src/driving/to-response.ts`**, mapping failures centrally (operator's decision). It returns the success's value. For a failure, it throws `ProblemException` with:
   - status by kind: `not-found` 404, `conflict` 409, `rule-violated` 422, `forbidden` 403;
   - `detail` = message, `code` = code.

   Throwing an `HttpException` from a driving adapter is Nest's mechanism for producing a response, not a defect, so ADR-0012 §5 holds for `domain` and handlers. The function reads `kind`, `code` and `message` and calls `result.isFailure()`, through shapes it declares itself (`DomainFailure`, `DomainOutcome`) that `Result<DomainError, S>` satisfies. _Amended during apply:_ the plan had it import `Result` and `DomainError` as types only, but `@nx/enforce-module-boundaries` (`enforceBuildableLibDependency`) refuses any import, type-only included, from a buildable library of a non-buildable one. Giving `shared-core` and `shared-domain` a build instead was tried and refused too: a buildable library's specs could then no longer import the non-buildable `@basis/shared-testing` (`shared-testing`'s boundary spec). `apps/api`'s specs pass a real `DomainError` through `toResponse`, so their typecheck fails if the shared domain gains a kind the map lacks. The library gains `@nestjs/common` at the API's exact version. Alternative: an interceptor that unwraps a returned `Result`. It is less code per route, but implicit, and it types every handler as returning `Result`.

8. **One global exception filter, `ProblemFilter`, in `apps/api/src/http/`**, registered with the validation pipe as `APP_FILTER` and `APP_PIPE` providers of an `HttpModule` that `AppModule` imports. Tests that create the module get them too. The filter handles these cases, in order:
   - A `ProblemException` is rendered as its problem.
   - Any other `HttpException` below `500`, such as Nest's 404 for an unknown route, is rendered with its status, the reason phrase, and `detail` taken from its message.
   - An `HttpException` of `500` or above is rendered with its status and a body holding only `type`, `title` and `status`, and logged as a defect is.
   - A thrown value that is not an `HttpException` but has `expose === true` and a numeric `status` or `statusCode` from `400` to `499` (the `http-errors` objects Express's body parser raises, such as `413` for an oversized body; `expose` is how `http-errors` marks an error safe to show a client) is rendered with that status and a body holding only `type`, `title` and `status`, and is not logged.
   - Anything else is a defect: `500`, a body holding only `type`, `title` and `status`, and one `error` log entry under context `ProblemFilter`. For an `Error`, the entry carries its name, message and stack. For any other thrown value, it carries only the value's type (`typeof`), since the value itself may hold anything.

   An upstream SDK error (an AI provider's or monobank's) may carry a 4xx `status` of its own but no `expose`, so it stays a defect: answered `500` and logged, as ADR-0012 §5 has it.

   `title` is the reason phrase from `STATUS_CODES`, or `"Error"` for a status with none.

   `4xx` responses are not logged.

9. **Validation: `StandardSchemaValidationPipe` with `transform: true`** and an `exceptionFactory` producing a `400` `ProblemException` with `detail` `"The request is invalid."` and `errors` from the issues: `path` from the issue path's keys, `message` the issue's message. A Zod default message does not echo the input value. A custom message in a `contracts` schema is that schema's author's responsibility. The pipe validates only parameters that name a `schema`, so `GET /health` is unaffected.
10. **Verification.** Unit specs cover `loadConfig`, `createLogger`'s redaction, `toResponse`, and the filter and pipe, through a spec-local controller over an application built from `HttpModule`. The e2e suite covers startup refusal of an invalid `PORT` without disclosure, and that the built API's output lines are JSON. The existing `api-persistence` and `api-health` suites must stay green unchanged.

## Risks / Trade-offs

- [A secret interpolated into a message string is not redacted] → the rule in decision 4 and the README. Review is the guard. Message text cannot be redacted by key.
- [JSON logs are harder to read locally] → accepted; a text format can be added behind an option when someone needs it.
- [`abortOnError: false` changes how other startup failures end] → they are logged and exit `1`, which a container runtime treats the same as before.
- [`toResponse` declares the shapes of `Result` and `DomainError` rather than importing them, so they can drift] → a new `DomainErrorKind` fails `apps/api`'s typecheck through `http-errors.spec.ts` (decision 7). `toResponse` relies only on `isFailure()` and `value`, the parts of `Result` its specification states.
- [A `500` body discloses nothing, so a client cannot report which defect it hit] → the log entry carries the stack. A request identifier belongs with the access log, which is out of scope.

## Migration Plan

No data or schema change. The API's environment variables and defaults are unchanged. Only a value that never worked, such as a non-numeric `PORT`, is now refused. Rollback is a promotion of the previous commit.
