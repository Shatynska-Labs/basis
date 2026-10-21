# identity-application

`identity`'s use cases (`scope:identity`, `type:application`; ADR-0012 §1, §2), sent on `@nestjs/cqrs`'s buses (`add-identity-authentication`):

- `SignInWithGoogle` (command): verifies the ID token, creates the account only for an allowlisted email, and opens a 30-day session, returning its token once.
- `SignOut` (command): revokes the presented session.
- `AuthenticateSession` (query): the user of an unrevoked, unexpired session.
- `GetCurrentUser` (query).

Ports, each an abstract class serving as its own injection token: `GoogleIdTokenVerifier`, `Clock`, the write repositories `UserRepository` and `SessionRepository`, and the read ports `UserReader` and `SessionReader`; `SIGN_UP_ALLOWLIST` carries the allowlist. Failures (`InvalidIdToken`, `SignUpNotAllowed`, `InvalidSession`) are `DomainError`s returned in a `Result`. `IDENTITY_HANDLERS` lists the handlers for the composition root.

It is built to `dist/`, because the API imports it at runtime.
