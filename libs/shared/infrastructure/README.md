# shared-infrastructure

Infrastructure every context's `infrastructure` library may use (`scope:shared`, `type:infrastructure`; `share-the-database-connection`).

- Sources are split into `src/driving/` (what calls in) and `src/driven/` (what is called), as in a context's `infrastructure` (ADR-0012 §1); `src/index.ts` only re-exports.
- **The database** (`src/driven/database.ts`): the `DATABASE` injection token and the `Database` type. `apps/api`'s database module provides the Drizzle database under the token; the pool, `DATABASE_URL` and migrations stay in `apps/api`. `Database` carries no schema type, so repositories use the query builder over their own context's tables.
- **The caller** (`src/driving/authentication.ts`; `add-identity-authentication`): `Public()`, which declares a route or controller reachable without a session, and `CurrentUser()`, a parameter decorator yielding the authenticated caller, `AuthenticatedUser` (`{ userId }`). `identity`'s session guard records the caller with `setAuthenticatedUser`, so another context's controllers read it without depending on `identity`.
- **Problem documents** (`src/driving/problem.ts`, `src/driving/to-response.ts`; `add-api-cross-cutting-basics`): `Problem`, `problem(status, extras)` and `ProblemException`, an RFC 9457 error body the API's exception filter renders, and `toResponse(result)`, which a context's controller returns: a success's value, or a problem whose status the `DomainError`'s kind sets, with `WWW-Authenticate: Bearer` for kind `unauthenticated`. A `ProblemException` may carry response headers. `toResponse` declares the shapes of `Result` and `DomainError` it reads, written when those libraries were unbuilt.
- **`TransactionManager`** (ADR-0011 rule 2), when first needed: its AsyncLocalStorage adapter goes in `src/driven/`; each context's `application` declares the port, which the adapter satisfies structurally, bound in the context's infrastructure module.
- Only `type:infrastructure` libraries and `apps/api` may depend on it (`eslint.config.mjs`).
- It is built to `dist/` and its package exports the build, because the API imports it at runtime and ships it in its image. Targets that resolve it depend on `^build`; a consumer declares it as a `dependency` (`workspace:*`).

Tests: `pnpm nx test shared-infrastructure`.
