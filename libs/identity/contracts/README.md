# identity-contracts

`identity`'s public surface (`scope:identity`, `type:contracts`; ADR-0012 §1): the Zod schemas of signing in and of the current user (`SignInWithGoogleRequest`, `SessionResponse`, `CurrentUserResponse`; `add-identity-authentication` design decision 5). Plain TypeScript and Zod only, so the web and mobile apps may consume it.

It is built to `dist/`, because the API imports it at runtime.
