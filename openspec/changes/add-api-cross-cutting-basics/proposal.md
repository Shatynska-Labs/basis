## Why

The API so far serves only `GET /health`. The first context endpoints (`identity`, `metrics`, roadmap Phase 1) need four cross-cutting basics in place before them, so that each context does not invent its own:

- The API reads its environment piecemeal (`DATABASE_URL` in the database module, `APP_VERSION` in the health controller, `PORT` in `main.ts`), and a malformed value such as a non-numeric `PORT` is not refused at startup.
- Logs are Nest's default coloured text, which a log pipeline cannot parse. Nothing masks a secret passed to a log entry, although the Conventions require that secrets are "never logged".
- ADR-0012 §5 returns expected failures as `Result` and has driving adapters map them to responses, but no mapping exists, nor a `DomainError` (ADR-0012 §6 plans it in `shared/domain`), nor a single error body.
- ADR-0012 §4 validates requests with the Zod schemas from `contracts` through NestJS 12's Standard Schema support, but no validation pipe is registered, so a schema in a route decorator would do nothing.

## What Changes

- **Configuration.** A Zod schema in `apps/api` validates `DATABASE_URL`, `PORT` and `APP_VERSION` together when the API is created. An invalid environment stops the API before it listens, with a structured log entry naming every invalid variable and never echoing a value. The database module and the health controller take their values from the validated configuration. Lint forbids `process.env` elsewhere in `apps/api/src`, except in the migration process.
- **Logging.** The API logs its HTTP server process (`dist/main.js`) through Nest 12's `ConsoleLogger` in JSON mode: one JSON object per line, bootstrap included. The migration process keeps its own output. Its `redact` option masks properties whose names mark them as secrets (`password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `cookie`, `databaseUrl`, `database_url`, `connectionString`, `connection_string`), at any depth and in any letter case. Redaction does not reach string messages, so a secret goes only into structured params, never into a message string. The README records this rule.
- **Errors.** Every error response is an RFC 9457 problem document (`application/problem+json`). A new library `libs/shared/domain` (`@basis/shared-domain`) holds an abstract `DomainError` with a `code` and a `kind` from a closed set. `libs/shared/infrastructure/src/driving/` gains `toResponse(result)`, which returns a success's value or throws a `ProblemException` whose status is set by the failure's kind. A global exception filter in `apps/api` renders problems, other HTTP exceptions and defects. A defect, or an `HttpException` of status `500` or above, is answered without disclosing its message, and logged. A client error raised outside Nest and marked safe to expose (an `http-errors` object with `expose: true`, such as the body parser's `413`) keeps its status.
- **Request validation.** A global `StandardSchemaValidationPipe` validates every parameter whose route decorator carries a `schema`. A failure is a `400` problem listing each issue's path and message. On success the handler receives the parsed value.

## Capabilities

### New Capabilities

- `api-configuration`: the environment the API reads, how it is validated, and how an invalid one stops the API.
- `api-logging`: the API's log format and the redaction of secret-named properties.
- `api-http-errors`: the problem-document format of error responses, the mapping from a domain failure's kind to a status, request validation, and defect handling.
- `shared-domain`: `DomainError`, and that the shared domain depends on nothing.

### Modified Capabilities

None. `api-persistence`'s refusal to start without `DATABASE_URL` and `api-health`'s report hold unchanged, and now rest on the validated configuration.

## Impact

- `apps/api`: `main.ts`, `app.module.ts`, new `src/config/`, `src/logging/`, `src/http/`; `database.module.ts` and `health.controller.ts` take configuration by injection; `package.json` gains `zod`; `README.md`.
- New project `libs/shared/domain` (tags `scope:shared`, `type:domain`). It is not built, because nothing shipped imports it at runtime yet.
- `libs/shared/infrastructure`: `src/driving/` (first files), `@nestjs/common` dependency, and its README.
- `eslint.config.mjs`: the `process.env` restriction for `apps/api/src`.
- The API's stdout changes from text to JSON lines. Nothing parses it today.
- Out of scope: a per-request access log, JSON output from the migration process, a configurable log level, and any context endpoint or `contracts` library.
