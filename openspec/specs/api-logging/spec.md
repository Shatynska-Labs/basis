# api-logging Specification

## Purpose

How the API writes its logs: one JSON object per line, with secret-named properties redacted.

## Requirements

### Requirement: The API writes its logs as JSON lines

Every log entry the API's HTTP server process (`dist/main.js`) writes, from process start, including the framework's own startup entries, SHALL be a single line holding one JSON object with at least the members `level` (a string) and `message`.

#### Scenario: The built API's output is JSON lines

- **WHEN** the built API is started with `DATABASE_URL` naming an address where nothing listens, `GET /health` is answered, and the process is stopped
- **THEN** its output holds at least one line, and every non-empty line parses as a JSON object with a string `level` and a `message`

### Requirement: Secret-named properties are redacted from log entries

The API's logger SHALL replace with `"[REDACTED]"` the value of every property, in the structured parameters of a log entry, whose name is one of `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `cookie`, `databaseUrl`, `database_url`, `connectionString` or `connection_string`, compared without regard to letter case and at any depth. It SHALL leave other properties unchanged, and SHALL NOT modify the object passed to it.

#### Scenario: A nested secret is redacted

- **WHEN** the API's logger logs the message `"connecting"` with the parameters `{ "target": { "host": "db.internal", "Password": "n0t-a-real-pa55word" } }`
- **THEN** the written entry contains `"[REDACTED]"` and `db.internal`, and does not contain `n0t-a-real-pa55word`, and the passed object's `Password` is still `n0t-a-real-pa55word`

#### Scenario: Every secret name is redacted

- **WHEN** the API's logger logs a message with parameters holding each of `password`, `secret`, `token`, `apiKey`, `api_key`, `authorization`, `cookie`, `databaseUrl`, `DATABASE_URL`, `connectionString` and `connection_string`, each with a distinct value
- **THEN** no one of those values appears in the written entry
