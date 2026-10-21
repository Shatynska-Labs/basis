# identity-authentication Specification

## Purpose

How a person signs in to the API: a verified Google ID token opens a session whose bearer token every non-public route requires, account creation is limited to an allowlist of emails, and signing out revokes the session.

## Requirements

### Requirement: A Google ID token is verified before it is trusted

The API SHALL accept a Google ID token only when its signature verifies against Google's published key set, its issuer is `accounts.google.com` or `https://accounts.google.com`, its audience is one of the configured client IDs, it has not expired beyond 30 seconds of clock skew, and its `email_verified` claim is `true`. Any other token SHALL fail sign-in with kind `unauthenticated` and code `identity.invalid-id-token`.

#### Scenario: A valid token yields the Google account

- **WHEN** a token signed by a key in the key set, issued by `https://accounts.google.com` for a configured client ID, unexpired, with `sub` `1098`, `email` `ann@example.org`, `email_verified` `true` and `name` `Ann` is verified
- **THEN** verification yields subject `1098`, email `ann@example.org` and display name `Ann`

#### Scenario: A token without a name

- **WHEN** an otherwise valid token has no `name` claim
- **THEN** verification yields display name `null`

#### Scenario: A token failing any check is refused

- **WHEN** a token is signed by a key outside the key set, or names another issuer, or another audience, or expired more than 30 seconds ago, or has `email_verified` `false` or absent, or is not a JWT
- **THEN** verification fails with kind `unauthenticated` and code `identity.invalid-id-token`

#### Scenario: Google's key set cannot be obtained

- **WHEN** a token is verified while Google's key set cannot be fetched (a network error, a timeout or a non-`200` answer)
- **THEN** verification does not fail as `identity.invalid-id-token`; `POST /auth/google` answers `500` with a problem document holding only `type`, `title` and `status`, and the failure is logged

#### Scenario: No client ID is configured

- **WHEN** the configured client IDs are empty and an otherwise valid token is verified
- **THEN** verification fails with code `identity.invalid-id-token`

### Requirement: Signing in with Google opens a session

`POST /auth/google`, a public route, SHALL take a body `{ "idToken": <non-empty string> }`. For a verified token whose subject has a user, it SHALL update that user's email and display name from the token, open a session for that user, and answer `200` with `{ "token", "expiresAt" }`.

#### Scenario: A known Google account signs in

- **WHEN** a user exists with Google subject `1098` and email `old@example.org`, and `POST /auth/google` carries a valid token for subject `1098` with email `ann@example.org`
- **THEN** the response is `200` with a `token` and an `expiresAt`, and the user's stored email is `ann@example.org`

#### Scenario: An invalid token is refused

- **WHEN** `POST /auth/google` carries a token failing verification
- **THEN** the response is a `401` problem document with `code` `identity.invalid-id-token` and the header `WWW-Authenticate: Bearer`, and no session is opened

#### Scenario: A body without a token is refused

- **WHEN** `POST /auth/google` carries `{}` or `{ "idToken": "" }`
- **THEN** the response is a `400` problem document

### Requirement: Only an allowed email can create an account

When a verified token's subject has no user, sign-in SHALL create a user with that subject, email and display name and open a session only if the token's email, lowercased, is on the configured sign-up allowlist. Otherwise sign-in SHALL fail with kind `forbidden` and code `identity.sign-up-not-allowed`, creating nothing. A known subject SHALL sign in whether or not its email is on the list.

#### Scenario: An allowed email creates an account

- **WHEN** the allowlist is `ann@example.org` and a valid token for an unknown subject `2001` with email `Ann@Example.org` signs in
- **THEN** a user with subject `2001` and email `Ann@Example.org` is created and the response is `200` with a session

#### Scenario: An email not on the list is refused

- **WHEN** the allowlist is `ann@example.org` and a valid token for an unknown subject with email `bob@example.org` signs in
- **THEN** the response is a `403` problem document with `code` `identity.sign-up-not-allowed`, and no user or session is created

#### Scenario: An empty allowlist admits nobody new

- **WHEN** the allowlist is empty and a valid token for an unknown subject signs in
- **THEN** the response is `403` with `code` `identity.sign-up-not-allowed`

#### Scenario: A known account outside the list still signs in

- **WHEN** a user exists with subject `1098`, the allowlist does not contain its email, and a valid token for subject `1098` signs in
- **THEN** the response is `200` with a session

### Requirement: A session token is random, returned once and stored as a hash

A session's token SHALL be 32 random bytes encoded as base64url without padding. The API SHALL store only the token's SHA-256 digest, with the user, the creation time and an expiry 30 days after creation, and SHALL return the token only in the sign-in response, with `expiresAt` as an ISO 8601 timestamp carrying an offset.

#### Scenario: The stored session does not hold the token

- **WHEN** a sign-in at `2026-10-20T10:00:00Z` answers a token
- **THEN** the token is 43 characters of base64url, the stored session holds the token's SHA-256 digest and not the token, and its expiry and the response's `expiresAt` are `2026-11-19T10:00:00Z`

#### Scenario: Concurrent first sign-ins of one account

- **WHEN** two sign-ins with valid tokens for the same unknown, allowed subject run at once
- **THEN** both answer `200`, and exactly one user with that subject exists

#### Scenario: Two sign-ins get different tokens

- **WHEN** the same user signs in twice
- **THEN** the two tokens differ and two sessions are stored

### Requirement: Every route requires a session unless declared public

Every route SHALL require `Authorization: Bearer <token>` naming a session that exists, has not expired and has not been revoked, unless the route is declared public. Otherwise the API SHALL answer `401` with a problem document whose `code` is `identity.invalid-session`, and the header `WWW-Authenticate: Bearer`. `GET /health` and `POST /auth/google` SHALL be public.

#### Scenario: No credentials

- **WHEN** `GET /me` is requested without an `Authorization` header, or with a scheme other than `Bearer`, or with an empty token
- **THEN** the response is `401`, content type `application/problem+json`, `code` `identity.invalid-session`, with `WWW-Authenticate: Bearer`

#### Scenario: An unknown, expired or revoked session

- **WHEN** `GET /me` presents a token with no stored session, or one whose expiry has passed, or one that was revoked
- **THEN** the response is `401` with `code` `identity.invalid-session`

#### Scenario: A valid session passes

- **WHEN** `GET /me` presents the token of an unexpired, unrevoked session
- **THEN** the request reaches the route as that session's user

#### Scenario: The scheme is case-insensitive

- **WHEN** `GET /me` presents `authorization: bearer <valid token>`
- **THEN** the request reaches the route

#### Scenario: Public routes need no session

- **WHEN** `GET /health` is requested without an `Authorization` header
- **THEN** the response is `200` with the health report

### Requirement: The current user can be read

`GET /me` SHALL answer `200` with the caller's `id`, `email` and `displayName` (`null` when Google gave no name).

#### Scenario: The caller reads themselves

- **WHEN** the user with email `ann@example.org` and display name `Ann` requests `GET /me` with a valid session
- **THEN** the response is `200` with `{ "id": <their id>, "email": "ann@example.org", "displayName": "Ann" }`

### Requirement: Signing out revokes the presented session

`POST /auth/sign-out` SHALL revoke the session whose token it is presented with, and answer `204`. The user's other sessions SHALL stay valid.

#### Scenario: A revoked session no longer authenticates

- **WHEN** a user with sessions A and B posts `POST /auth/sign-out` with A's token, then requests `GET /me` with A's token and with B's token
- **THEN** sign-out answers `204`, the request with A's token answers `401`, and the request with B's token answers `200`

### Requirement: Session tokens and ID tokens are not logged

The API SHALL NOT write a session token, its digest, or a Google ID token to its log.

#### Scenario: A refused sign-in is not logged with its token

- **WHEN** `POST /auth/google` is refused for an invalid token `eyJhbGciOiJSUzI1NiJ9.e30.c2ln`
- **THEN** no log line contains `eyJhbGciOiJSUzI1NiJ9.e30.c2ln`

#### Scenario: A successful sign-in is not logged with its token

- **WHEN** a sign-in answers a session token
- **THEN** no log line contains the token or its digest
