# api-persistence Specification

## Purpose

How the API is given its PostgreSQL database, how it holds a connection to it, and how the API's one migration history is applied to a database, without the API's liveness depending on that database.

## Requirements

### Requirement: The API is given its database by DATABASE_URL alone

The API SHALL take the database it connects to from the environment variable `DATABASE_URL`, a PostgreSQL connection URL, used unchanged. It SHALL refuse to start when `DATABASE_URL` is unset or empty, with a message naming `DATABASE_URL`.

#### Scenario: No database URL

- **WHEN** the API's database configuration is read from an environment where `DATABASE_URL` is unset, or set to the empty string
- **THEN** it fails with a message naming `DATABASE_URL`

#### Scenario: A database URL is taken unchanged

- **WHEN** the API's database configuration is read from an environment where `DATABASE_URL` is `postgres://basis:secret@db.internal:5432/basis`
- **THEN** the URL it connects with is exactly that value

### Requirement: The API's connection reaches the database it is given

With `DATABASE_URL` naming a reachable PostgreSQL database, a query issued through the API's database connection SHALL be answered by that database, and closing the API SHALL release every connection it opened.

#### Scenario: A query reaches the database

- **WHEN** the API's application context is created with `DATABASE_URL` naming a reachable database, and a query selecting `current_database()` is issued through its database connection
- **THEN** the answer is the name of the database `DATABASE_URL` names

#### Scenario: Closing the API releases its connections

- **WHEN** the API's application context has issued a query through its database connection and is then closed
- **THEN** the database reports no remaining connection whose `application_name` is `basis-api`

### Requirement: Starting the API does not connect to the database

The API SHALL open no database connection while starting, so that a configured but unreachable database does not keep it from starting or from answering `GET /health`.

#### Scenario: An unreachable database at startup

- **WHEN** the built API is started with `DATABASE_URL` naming a database at an address where nothing listens, and `GET /health` is requested
- **THEN** the response has status `200` and a body whose `status` is `"ok"`

### Requirement: The migration process applies the API's migration history

The API SHALL ship a migration process, run as `node dist/migrate.js` from the API's package, that applies every migration of the API's migration history not yet applied to the database `DATABASE_URL` names, in order, and exits with status `0`. Run against a database already holding every migration, it SHALL apply nothing and exit with status `0`.

#### Scenario: An empty database is migrated

- **WHEN** the migration process is run with `DATABASE_URL` naming a database holding no tables
- **THEN** it exits with status `0`, and the database's migration record holds one entry per migration in the history

#### Scenario: A migrated database is migrated again

- **WHEN** the migration process is run a second time against the same database
- **THEN** it exits with status `0` and the migration record holds the same entries as before

### Requirement: The migration history starts with a baseline

The API's migration history SHALL be one drizzle-kit history owned by the API, starting with a baseline migration that creates no table, so that the first delivery records a migration without introducing a schema no change has specified. Every table a later migration creates SHALL be in the schema of the context that owns it (ADR-0011), never in `public`.

#### Scenario: The baseline creates nothing

- **WHEN** the migration process has migrated an empty database
- **THEN** the database holds no table in the schema `public`, and every table outside the schema of the migration record is in the schema of a context

#### Scenario: Identity's tables are in its schema

- **WHEN** the migration process has migrated an empty database
- **THEN** the tables outside the schema of the migration record are exactly `identity.users` and `identity.sessions`

### Requirement: A failed migration fails the migration process without disclosing the URL

The migration process SHALL exit with a non-zero status when `DATABASE_URL` is unset or empty, naming `DATABASE_URL`, and when the database cannot be reached or a migration fails. Nothing it writes to standard output or standard error SHALL contain the database URL or its password.

#### Scenario: No database URL for the migration

- **WHEN** the migration process is run with `DATABASE_URL` unset
- **THEN** it exits with a non-zero status and its output names `DATABASE_URL`

#### Scenario: An unreachable database

- **WHEN** the migration process is run with `DATABASE_URL` naming a database at an address where nothing listens, with the password `n0t-a-real-pa55word`
- **THEN** it exits with a non-zero status, and its output contains neither `n0t-a-real-pa55word` nor the URL

#### Scenario: A refused password

- **WHEN** the migration process is run against a reachable database with a password the database refuses, `n0t-a-real-pa55word`
- **THEN** it exits with a non-zero status, and its output contains neither `n0t-a-real-pa55word` nor the URL
