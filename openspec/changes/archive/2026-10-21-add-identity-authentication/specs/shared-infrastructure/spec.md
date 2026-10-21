## ADDED Requirements

### Requirement: Other contexts read the caller from the shared infrastructure

The shared infrastructure SHALL provide, under `src/driving/`, a `Public` decorator that declares a route or controller public, and a `CurrentUser` parameter decorator that yields the authenticated caller as `{ userId }`. A context SHALL NOT need to import `identity`'s infrastructure to read the caller.

#### Scenario: A route reads its caller

- **WHEN** a controller outside `identity` takes `@CurrentUser()` and is requested with a valid session of user `u1`
- **THEN** the parameter is `{ userId: "u1" }`

#### Scenario: A declared public route

- **WHEN** a controller method marked `@Public()` is requested without credentials
- **THEN** it is not refused for lack of a session
