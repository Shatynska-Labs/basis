# identity-infrastructure

`identity`'s adapters (`scope:identity`, `type:infrastructure`; ADR-0012 §1; `add-identity-authentication`):

- `src/driven/`: the tables of the PostgreSQL schema `identity` (`users`, `sessions`), the Drizzle repositories and readers, `JoseGoogleIdTokenVerifier` (Google's published keys, through `jose`) and the system clock.
- `src/driving/`: `SessionGuard`, the global guard requiring a session on every route not marked `@Public()`; `AuthController` (`POST /auth/google`, `POST /auth/sign-out`) and `MeController` (`GET /me`).
- `src/identity.module.ts`: the composition root, outside both folders, binding the driven adapters to the application's ports. `IdentityModule.forRootAsync({ inject, useFactory })` takes `{ googleClientIds, signupAllowedEmails }`; the API passes them from its configuration.

A driving adapter may not import a driven one (lint; ADR-0012 §1). It is built to `dist/`, because the API imports it at runtime. Its tables reach the API's migration history through `apps/api/src/database/schema.ts`. Tests: `pnpm nx test identity-infrastructure`; the repositories are tested in `apps/api/tests/integration/`, where the migrations are.
