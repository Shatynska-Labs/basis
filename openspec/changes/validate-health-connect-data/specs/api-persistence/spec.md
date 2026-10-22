## MODIFIED Requirements

### Requirement: The migration history starts with a baseline

The API's migration history SHALL be one drizzle-kit history owned by the API, starting with a baseline migration that creates no table, so that the first delivery records a migration without introducing a schema no change has specified. Every table a later migration creates SHALL be in the schema of the context that owns it (ADR-0011), never in `public`.

#### Scenario: The baseline creates nothing

- **WHEN** the migration process has migrated an empty database
- **THEN** the database holds no table in the schema `public`, and every table outside the schema of the migration record is in the schema of a context

#### Scenario: Identity's tables are in its schema

- **WHEN** the migration process has migrated an empty database
- **THEN** the tables outside the schema of the migration record are exactly `identity.users`, `identity.sessions` and `metrics.health_connect_deliveries`
