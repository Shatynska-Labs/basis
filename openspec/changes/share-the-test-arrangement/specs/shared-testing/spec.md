## Purpose

Gives the project one place for shared test arrangement (builders, fixtures, fakes and stubs) and guarantees that production code cannot depend on it, so that specs stop declaring drifting copies of the same arrangement.

## ADDED Requirements

### Requirement: Shared test arrangement has one home

The project SHALL provide a single library, `@basis/shared-testing`, at `libs/shared/testing`, carrying the tags `scope:shared` and `type:testing`. It SHALL be the location recorded in `AGENTS.md` under _Testing Strategy_ as the shared test arrangement. It SHALL be the only library carrying `type:testing`.

#### Scenario: The location is recorded

- **WHEN** a reader looks under _Testing Strategy_ in `AGENTS.md` for the shared test arrangement
- **THEN** it names `libs/shared/testing` and `@basis/shared-testing`, and no longer states that the project has none

#### Scenario: The library is a workspace project with the declared tags

- **WHEN** the workspace's projects are listed
- **THEN** `shared-testing` is among them with the tags `scope:shared` and `type:testing`, and no other project carries `type:testing`

### Requirement: Specs and test configuration may use shared test arrangement

A spec file, a Vitest or Jest configuration file, or an ESLint configuration file in any library or app SHALL be able to import `@basis/shared-testing` without a module-boundary violation.

#### Scenario: A spec in a library imports the shared arrangement

- **WHEN** a `*.spec.ts` file in a `type:domain`, `type:application`, `type:infrastructure` or `type:core` library, or in an app, imports `@basis/shared-testing`
- **THEN** linting reports no violation

### Requirement: Production code cannot import shared test arrangement

A source file that is not a spec file, a file under a `tests/` directory or test configuration SHALL NOT import `@basis/shared-testing` in any project. Linting SHALL report such an import as an error.

#### Scenario: A production source file imports the shared arrangement

- **WHEN** a non-spec `*.ts` file in a library or app imports `@basis/shared-testing`
- **THEN** linting reports an error

#### Scenario: A file under a tests directory is test code

- **WHEN** a `*.ts` file under `tests/` in a library imports `@basis/shared-testing`
- **THEN** linting reports no violation

### Requirement: The shared arrangement depends on no other workspace library

`@basis/shared-testing` SHALL NOT depend on any other workspace library, so that a spec in any library can import it without forming a project cycle and no bounded context's library is reachable from it.

#### Scenario: The shared arrangement imports a workspace library

- **WHEN** a file in `libs/shared/testing` imports another workspace library, such as `@basis/shared-core` or a library tagged with a context scope
- **THEN** linting reports a module-boundary violation
