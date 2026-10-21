## MODIFIED Requirements

### Requirement: The API's configuration is validated as a whole

The API SHALL read its configuration from the environment variables `DATABASE_URL`, `PORT`, `APP_VERSION`, `GOOGLE_CLIENT_IDS` and `SIGNUP_ALLOWED_EMAILS`, and validate all of them together when the API is created, yielding a configuration of `databaseUrl`, `port`, `appVersion`, `googleClientIds` and `signupAllowedEmails`. When any variable is invalid, validation SHALL fail with an error that names every invalid variable.

#### Scenario: A complete environment is read

- **WHEN** the configuration is read from `DATABASE_URL=postgres://basis:secret@db.internal:5432/basis`, `PORT=8080`, `APP_VERSION=3f2c9e1`, `GOOGLE_CLIENT_IDS=123-web.apps.googleusercontent.com` and `SIGNUP_ALLOWED_EMAILS=ann@example.org`
- **THEN** it is `databaseUrl` `postgres://basis:secret@db.internal:5432/basis`, `port` `8080`, `appVersion` `"3f2c9e1"`, `googleClientIds` `["123-web.apps.googleusercontent.com"]` and `signupAllowedEmails` `["ann@example.org"]`

#### Scenario: Every invalid variable is named at once

- **WHEN** the configuration is read with `DATABASE_URL` unset and `PORT=abc`
- **THEN** validation fails with an error naming both `DATABASE_URL` and `PORT`

## ADDED Requirements

### Requirement: Google client IDs are an optional list

`GOOGLE_CLIENT_IDS` unset or empty SHALL yield `googleClientIds` `[]`. Otherwise it SHALL be split on commas, each entry trimmed, empty entries skipped, and every remaining entry SHALL match `^[A-Za-z0-9.-]+\.apps\.googleusercontent\.com$`, or validation fails naming `GOOGLE_CLIENT_IDS` without its value.

#### Scenario: Two client IDs

- **WHEN** the configuration is read with `GOOGLE_CLIENT_IDS=" 1-web.apps.googleusercontent.com, ,2-android.apps.googleusercontent.com"`
- **THEN** `googleClientIds` is `["1-web.apps.googleusercontent.com", "2-android.apps.googleusercontent.com"]`

#### Scenario: Unset client IDs

- **WHEN** the configuration is read with `GOOGLE_CLIENT_IDS` unset, or empty
- **THEN** `googleClientIds` is `[]`

#### Scenario: A malformed client ID

- **WHEN** the configuration is read with `GOOGLE_CLIENT_IDS=not-a-client-id`
- **THEN** validation fails naming `GOOGLE_CLIENT_IDS`, and the error does not contain `not-a-client-id`

### Requirement: The sign-up allowlist is an optional list of emails

`SIGNUP_ALLOWED_EMAILS` unset or empty SHALL yield `signupAllowedEmails` `[]`. Otherwise it SHALL be split on commas, each entry trimmed and lowercased, empty entries skipped, and every remaining entry SHALL match `^[^\s@,]+@[^\s@,]+\.[^\s@,]+$`, or validation fails naming `SIGNUP_ALLOWED_EMAILS` without its value.

#### Scenario: Entries are normalised

- **WHEN** the configuration is read with `SIGNUP_ALLOWED_EMAILS=" Ann@Example.org ,,bob@example.org"`
- **THEN** `signupAllowedEmails` is `["ann@example.org", "bob@example.org"]`

#### Scenario: Unset allowlist

- **WHEN** the configuration is read with `SIGNUP_ALLOWED_EMAILS` unset, or empty
- **THEN** `signupAllowedEmails` is `[]`

#### Scenario: A malformed entry

- **WHEN** the configuration is read with `SIGNUP_ALLOWED_EMAILS=ann@example.org,carol`
- **THEN** validation fails naming `SIGNUP_ALLOWED_EMAILS`, and the error contains neither `carol` nor `ann@example.org`

### Requirement: Disabled sign-in is logged at startup

When `googleClientIds` is empty, the API SHALL log one `warn` entry at startup with the message `Sign-in with Google is disabled: GOOGLE_CLIENT_IDS names no client.` and SHALL start.

#### Scenario: No client IDs

- **WHEN** the API starts with `GOOGLE_CLIENT_IDS` unset, or `","`
- **THEN** it logs one `warn` entry with that message and listens

#### Scenario: Client IDs set

- **WHEN** the API starts with `GOOGLE_CLIENT_IDS=1-web.apps.googleusercontent.com`
- **THEN** no entry with that message is logged
