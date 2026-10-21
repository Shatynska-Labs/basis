# api-configuration Specification

## Purpose

How the API reads its environment: validated as a whole at startup, with defaults and bounds, refused without disclosing any value, and read nowhere else.

## Requirements

### Requirement: The API's configuration is validated as a whole

The API SHALL read its configuration from the environment variables `DATABASE_URL`, `PORT`, `APP_VERSION`, `GOOGLE_CLIENT_IDS` and `SIGNUP_ALLOWED_EMAILS`, and validate all of them together when the API is created, yielding a configuration of `databaseUrl`, `port`, `appVersion`, `googleClientIds` and `signupAllowedEmails`. When any variable is invalid, validation SHALL fail with an error that names every invalid variable.

#### Scenario: A complete environment is read

- **WHEN** the configuration is read from `DATABASE_URL=postgres://basis:secret@db.internal:5432/basis`, `PORT=8080`, `APP_VERSION=3f2c9e1`, `GOOGLE_CLIENT_IDS=123-web.apps.googleusercontent.com` and `SIGNUP_ALLOWED_EMAILS=ann@example.org`
- **THEN** it is `databaseUrl` `postgres://basis:secret@db.internal:5432/basis`, `port` `8080`, `appVersion` `"3f2c9e1"`, `googleClientIds` `["123-web.apps.googleusercontent.com"]` and `signupAllowedEmails` `["ann@example.org"]`

#### Scenario: Every invalid variable is named at once

- **WHEN** the configuration is read with `DATABASE_URL` unset and `PORT=abc`
- **THEN** validation fails with an error naming both `DATABASE_URL` and `PORT`

### Requirement: The database URL is required and used unchanged

`DATABASE_URL` SHALL be a non-empty string, and `databaseUrl` SHALL be that string unchanged. A value of only whitespace is non-empty and is used unchanged, as `api-persistence` refuses only an unset or empty one.

#### Scenario: A missing database URL is refused

- **WHEN** the configuration is read with `DATABASE_URL` unset, or empty
- **THEN** validation fails with an error naming `DATABASE_URL`

#### Scenario: A whitespace database URL is used unchanged

- **WHEN** the configuration is read with `DATABASE_URL` set to a single space
- **THEN** `databaseUrl` is a single space

### Requirement: The port defaults to 3000 and is bounded

`PORT` unset or empty SHALL yield `port` `3000`. Otherwise `PORT` SHALL be a decimal integer from `1` to `65535` with no sign, fraction, leading zero or surrounding characters, and `port` SHALL be its value.

#### Scenario: The port takes its default

- **WHEN** the configuration is read with `DATABASE_URL` set and `PORT` unset, or empty
- **THEN** `port` is `3000`

#### Scenario: A malformed port is refused

- **WHEN** the configuration is read with `DATABASE_URL` set and `PORT` set to each of `abc`, `0`, `65536`, `-1`, `80.5`, ` 80` and `080`
- **THEN** validation fails with an error naming `PORT`

### Requirement: The build identifier defaults to unknown

`APP_VERSION` unset or empty SHALL yield `appVersion` `"unknown"`. Otherwise `appVersion` SHALL be the value unchanged.

#### Scenario: The build identifier takes its default

- **WHEN** the configuration is read with `DATABASE_URL` set and `APP_VERSION` unset, or empty
- **THEN** `appVersion` is `"unknown"`

### Requirement: An invalid configuration stops the API without disclosing values

The built API SHALL, when its configuration is invalid, exit with a non-zero status without listening. What it writes to standard output and standard error SHALL name every invalid variable, and SHALL NOT contain the value of any environment variable it reads.

#### Scenario: An invalid port stops the API

- **WHEN** the built API is started with `DATABASE_URL=postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis` and `PORT=n0t-a-p0rt`
- **THEN** the process exits with a non-zero status, `GET /health` is never answered, and its output contains `PORT` and contains neither `n0t-a-real-pa55word` nor `n0t-a-p0rt`

### Requirement: Only the configuration reads the API's environment

No non-spec source file under `apps/api/src` other than the configuration's own files and the migration process SHALL read `process.env`, and lint SHALL report a source file that does.

#### Scenario: Reading the environment elsewhere is reported

- **WHEN** a non-spec source file under `apps/api/src`, outside the configuration's folder and other than `migrate.ts`, reading `process.env['PORT']` is linted
- **THEN** lint reports an error for it

#### Scenario: The configuration may read the environment

- **WHEN** a source file in the configuration's folder reading `process.env` is linted
- **THEN** lint reports no error for that read

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
