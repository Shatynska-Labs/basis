## Why

Roadmap Phase 1's outcome is "device data reaches the server", and data reaching the server must belong to a user (Conventions, Ownership). No context exists yet, and nothing tells the API who is calling: every route it would add is open to anyone who can reach the public host. The PRD leaves the method open ("email magic link or Google OAuth — to be decided in OpenSpec", open question 4); the operator chose Google only, hand-rolled, with sign-up restricted per deployment so the repository stays public and forkable while only people the operator names can create an account.

## What Changes

- **The `identity` context**, the first context: `libs/identity/application`, `libs/identity/infrastructure` and `libs/identity/contracts` (no `domain`, per the context map), with `@nestjs/cqrs` command and query buses (ADR-0012 §2).
- **Sign-in with Google.** `POST /auth/google` takes a Google ID token, verifies its signature against Google's published keys, its issuer, its audience (one of the deployment's client IDs) and that the email is verified. A known Google account gets a session. An unknown one gets an account and a session only when its email is on the deployment's sign-up allowlist; otherwise `403`. An invalid token is `401`.
- **Sessions.** An opaque random bearer token, valid for 30 days, stored only as its SHA-256 hash. `POST /auth/sign-out` revokes the presented session.
- **Every route requires a session unless marked public.** A global guard answers `401` with a problem document and `WWW-Authenticate: Bearer`. `GET /health` and `POST /auth/google` are public. Other contexts take the caller from a `CurrentUser` decorator in the shared infrastructure, never from `identity`'s internals.
- **`GET /me`** answers the caller's `id`, `email` and `displayName`.
- **Configuration.** `GOOGLE_CLIENT_IDS` (comma-separated; unset disables sign-in) and `SIGNUP_ALLOWED_EMAILS` (comma-separated; unset lets nobody create an account) join the validated configuration.
- **Delivery.** Each Environment supplies the client IDs as the variable `BASIS_API_GOOGLE_CLIENT_IDS` (required) and the allowlist as the secret `BASIS_API_SIGNUP_ALLOWED_EMAILS` (optional, never printed), rendered into `.env`.
- **A new domain error kind**, `unauthenticated`, answered `401`.
- **Builds.** `shared-core` and `shared-domain` gain builds, since `identity` imports `Result` and `DomainError` at runtime; specs are exempt from Nx's buildable-library rule.
- **The first tables**: schema `identity` with `users` and `sessions`, in the API's migration history.

## Capabilities

### New Capabilities

- `identity-authentication`: signing in with Google, the sign-up allowlist, sessions and their revocation, the session requirement on every non-public route, and the current user.

### Modified Capabilities

- `api-configuration`: the configuration gains `GOOGLE_CLIENT_IDS` and `SIGNUP_ALLOWED_EMAILS`.
- `api-delivery`: the delivery renders the client IDs and the allowlist from the Environment.
- `shared-domain`: `DomainErrorKind` gains `unauthenticated`.
- `api-http-errors`: `toResponse` answers kind `unauthenticated` with `401` and `WWW-Authenticate: Bearer`; a problem can carry response headers.
- `shared-infrastructure` (specified by `share-the-database-connection`, merged and not yet archived): `Public` and `CurrentUser`.

## Impact

- New projects `libs/identity/{application,infrastructure,contracts}` (`scope:identity`), all built, depended on by `apps/api`.
- `libs/shared/core`, `libs/shared/domain` (`DomainErrorKind`): builds; `libs/shared/infrastructure/src/driving/`: `Public`, `CurrentUser`, `AuthenticatedUser`, `ProblemException` headers, and `toResponse`'s kind map (`DomainFailureKind`).
- `apps/api`: configuration, `ProblemFilter` (headers), `HealthController` (`@Public()`), `AppModule` imports `IdentityModule`, `src/database/schema.ts` re-exports `identity`'s tables, a new migration, `README.md`.
- Root `eslint.config.mjs`: `jose` joins the framework and SDK packages; the buildable-library rule is off for specs and test configuration; a context's `driving/` may not import its `driven/`.
- `deploy.yml`, `promote.yml`, `.github/actions/deliver-api`, `tools/delivery/src/render-env.ts`.
- New dependencies: `@nestjs/cqrs`, `jose`.
- **Operator prerequisite before merging**: a Google Cloud OAuth client, and in both Environments the variable `BASIS_API_GOOGLE_CLIENT_IDS` and the secret `BASIS_API_SIGNUP_ALLOWED_EMAILS`. Without the variable the delivery is refused.
- ADR-0012 §6 (`shared/infrastructure` row), `docs/product/06-risks-and-open-questions.md` (question 4 answered; a DPIA-lite row for account data), `docs/backlog.md` gains `invite-users-to-sign-up` and `add-identity-profile`.
- Out of scope: the profile (time zone, heart-rate zones; the next change), web and mobile sign-in, invitations, account deletion, rate limiting, listing or revoking other sessions.
