## Purpose

The API's liveness report: what a container runtime, a deploy and an operator read to tell that the API process is up and which build it is running.

## ADDED Requirements

### Requirement: The API reports that it is alive

The API SHALL answer `GET /health` with status `200` and a JSON body whose `status` field is the string `"ok"`.

#### Scenario: A running API answers its health check

- **WHEN** `GET /health` is requested of a running API
- **THEN** the response has status `200`, a JSON content type, and a body whose `status` is `"ok"`

### Requirement: The health report names the running build

The health report's `version` field SHALL be the build identifier the API process was started with, unchanged, and SHALL be the string `"unknown"` when the process was started with none or with an empty one.

#### Scenario: A build identifier is reported unchanged

- **WHEN** the API is started with the build identifier `3f2c9e1` and `GET /health` is requested
- **THEN** the body's `version` is `"3f2c9e1"`

#### Scenario: No build identifier is reported as unknown

- **WHEN** the API is started with no build identifier, or with an empty one, and `GET /health` is requested
- **THEN** the body's `version` is `"unknown"`

### Requirement: The health report carries nothing else and asks for nothing

The health report SHALL be served without authentication, and its body SHALL contain exactly the fields `status` and `version`, so that it discloses nothing about users, configuration or the environment beyond the build.

#### Scenario: The health check needs no credentials

- **WHEN** `GET /health` is requested with no credentials of any kind
- **THEN** the response has status `200`

#### Scenario: The body holds only status and version

- **WHEN** `GET /health` is requested
- **THEN** the body's keys are exactly `status` and `version`

### Requirement: The health report depends on nothing outside the process

The API SHALL start and answer `GET /health` with `200` when no database, queue, cache, object store or other external service is reachable, so that the report means the process is alive and nothing more.

#### Scenario: Health is reported with no external service available

- **WHEN** the API is started where no database, queue, cache or object store is reachable, and `GET /health` is requested
- **THEN** the response has status `200` and a body whose `status` is `"ok"`
