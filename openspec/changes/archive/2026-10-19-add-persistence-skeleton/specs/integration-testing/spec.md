## Purpose

How integration specs run: apart from unit specs, against a throwaway PostgreSQL started for each run, so that verification needs Docker and nothing else, never a shared or long-lived database, and fails rather than passes when it cannot reach what it needs.

## ADDED Requirements

### Requirement: Integration specs run only through the integration target

A project's `*.integration.spec.ts` files under `tests/integration/` SHALL be run by its `integration` target and SHALL NOT be collected by its `test` target. `apps/api` SHALL have an `integration` target.

#### Scenario: The API has an integration target

- **WHEN** the workspace's projects with an `integration` target are listed
- **THEN** `api` is among them

#### Scenario: The unit run leaves integration specs out

- **WHEN** the files the `api` project's `test` target collects are listed
- **THEN** none of them is under `tests/integration/` or ends in `.integration.spec.ts`

### Requirement: Each integration run gets a throwaway PostgreSQL

An integration run SHALL start its own PostgreSQL server in a container before its first spec, of the same major version as the shared PostgreSQL instance the hosts run (18), give every spec of the run a connection URL to it, and remove the container when the run ends.

#### Scenario: The run's server

- **WHEN** a spec of an integration run connects with the URL the run provides and asks the server for `server_version_num`
- **THEN** the server answers, and its major version is 18

### Requirement: Each spec can take a fresh database

The shared test arrangement SHALL give a spec, on request, a database of its own on the run's server: newly created, holding no tables, and distinct from every other database requested in the run.

#### Scenario: Two fresh databases

- **WHEN** a spec requests two fresh databases
- **THEN** their URLs name two different databases, and each holds no table in the schema `public`

### Requirement: An integration run without a container runtime fails

An integration run SHALL fail, with a non-zero status, when its PostgreSQL server cannot be started, as when no container runtime can be reached, rather than skipping its specs or reporting success. The run's setup SHALL NOT catch a failed start.

#### Scenario: The server cannot be started

- **WHEN** the run's setup is given a server start that fails with an error
- **THEN** the setup rejects with that error, and no connection URL is provided
