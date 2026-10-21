## 1. Foundations

- [x] 1.1 Give `libs/shared/core` and `libs/shared/domain` builds, as `libs/shared/infrastructure` has (design decision 12). In the root `eslint.config.mjs`, set `enforceBuildableLibDependency: false` in `boundaries(false)`, add `jose` to `frameworkAndSdkPackages` (decision 13), and forbid `libs/*/infrastructure/src/driving/**` importing from `driven/`, in two blocks: non-spec files repeating the shared-testing patterns, specs with only the `/driven/` pattern (decision 5)
- [x] 1.2 Add `unauthenticated` to `DomainErrorKind`, and `401` to `toResponse`'s status map (decision 9)
- [x] 1.3 Add optional `headers` to `ProblemException`, sent by `ProblemFilter` (decision 7)
- [x] 1.4 Make `toResponse` set `WWW-Authenticate: Bearer` for kind `unauthenticated` (decision 9)
- [x] 1.5 Add `libs/shared/infrastructure/src/driving/authentication.ts` with `Public`, `CurrentUser` and `AuthenticatedUser`, exported from the index (decision 7)

## 2. Configuration

- [x] 2.1 Add `GOOGLE_CLIENT_IDS` and `SIGNUP_ALLOWED_EMAILS` to `loadConfig` and `AppConfig` (decision 10)
- [x] 2.2 Log the disabled-sign-in warning at startup when `googleClientIds` is empty (decision 10)

## 3. The identity context

- [x] 3.1 Create `libs/identity/contracts`, `libs/identity/application` and `libs/identity/infrastructure` (tags `scope:identity` and their `type:`), built, as `dependencies` of `apps/api`. Add `@nestjs/cqrs` and `jose` at exact versions. Run `pnpm install` and `pnpm nx sync` (decisions 5 and 13)
- [x] 3.2 Contracts: `SignInWithGoogleRequest`, `SessionResponse`, `CurrentUserResponse` (decision 5)
- [x] 3.3 Application: ports, failures, and the `SignInWithGoogle`, `SignOut`, `AuthenticateSession` and `GetCurrentUser` handlers (decisions 2, 3, 4, 5 and 6)
- [x] 3.4 Infrastructure, driven: the `identity` schema's tables, the repositories, `JoseGoogleIdTokenVerifier` and the system clock (decisions 1, 4 and 14)
- [x] 3.5 Infrastructure, driving: `SessionGuard`, `AuthController` and `MeController`; the composition root `src/identity.module.ts` with `IdentityModule.forRootAsync`, registering the guard as `APP_GUARD` (decisions 5, 7 and 8)
- [x] 3.6 Wire `IdentityModule` into `AppModule` from `APP_CONFIG`; mark `HealthController` `@Public()`; re-export `identity`'s tables from `apps/api/src/database/schema.ts` and generate migration `0001` with `pnpm nx run api:db-generate` (decisions 5, 7 and 14)

## 4. Delivery

- [x] 4.1 Add the `google-client-ids` (required) and `signup-allowed-emails` (optional) inputs to `.github/actions/deliver-api/action.yml`, render them in `tools/delivery/src/render-env.ts`, and pass them from `deploy.yml` and `promote.yml` (decision 11)

## 5. Record and verify

- [x] 5.1 Update `apps/api/README.md` (sign-in, sessions, the allowlist and its limits, the new variables, how to obtain a test ID token), `libs/shared/infrastructure/README.md`, a README for each new library, ADR-0012 §6's `shared/infrastructure` row, and `docs/product/06-risks-and-open-questions.md`: question 4 answered (Google only), and a DPIA-lite row for account data (Google subject, email, display name, session digests). Record `invite-users-to-sign-up` and `add-identity-profile` in `docs/backlog.md`
- [x] 5.2 Dispose of `test-plan.md`'s _Missing shared arrangement_ entries
- [x] 5.3 Verify with `pnpm nx run-many -t lint typecheck test build`, `pnpm nx run-many -t integration`, `pnpm nx e2e api-e2e`, `pnpm format:check`, `pnpm nx sync:check` and `openspec validate --all --strict`

## 6. Ship

- [x] 6.1 Operator, before merging: create the Google Cloud OAuth client and set `BASIS_API_GOOGLE_CLIENT_IDS` (variable) and `BASIS_API_SIGNUP_ALLOWED_EMAILS` (secret) in both Environments (Migration Plan)
- [ ] 6.2 Merge the implementation pull request and wait for the operator's word that staging's deploy is healthy
- [ ] 6.3 Confirm on staging: `GET /me` without a session answers `401`; an allowlisted Google account's ID token from the OAuth Playground signs in, `GET /me` answers it, sign-out makes the token answer `401`; a Google account not on the list answers `403`
- [ ] 6.4 Promote, on the operator's act, and wait for the smoke wait to pass
- [ ] 6.5 Archive, updating `docs/backlog.md` entries this change touches
