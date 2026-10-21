# shared-infrastructure Specification

## Purpose

The shared library through which a context's infrastructure takes the API's database, who may depend on it, its driving/driven layout, and that the built API runs with it.

## Requirements

### Requirement: The API's database is provided under a shared token

The project SHALL provide the library `@basis/shared-infrastructure`, at `libs/shared/infrastructure`, carrying the tags `scope:shared` and `type:infrastructure`. It SHALL export the injection token `DATABASE` and the type `Database`. The API SHALL provide its Drizzle database, connected to the database `DATABASE_URL` names, under that token.

#### Scenario: The library is a workspace project with the declared tags

- **WHEN** the workspace's projects are listed
- **THEN** `shared-infrastructure` is among them with the tags `scope:shared` and `type:infrastructure`

#### Scenario: The API's database is resolved through the shared token

- **WHEN** the API's application context is created with `DATABASE_URL` set to `postgres://basis:secret@db.internal:5432/basis`, and the provider for `DATABASE` imported from `@basis/shared-infrastructure` is resolved from it
- **THEN** it is a Drizzle database whose connection is configured with exactly that URL

### Requirement: Only infrastructure libraries and the API depend on the shared infrastructure

A context's `type:infrastructure` library and `apps/api` SHALL be able to import `@basis/shared-infrastructure` without a module-boundary violation. A library of any other type, and the web and mobile apps, SHALL NOT; linting SHALL report such an import as an error.

#### Scenario: An infrastructure library may import it

- **WHEN** the module-boundary constraints that apply to a library tagged `type:infrastructure` and a context scope are read
- **THEN** they allow a dependency on a library tagged `type:infrastructure` and `scope:shared`

#### Scenario: The API may import it

- **WHEN** a source file in `apps/api` imports `@basis/shared-infrastructure`
- **THEN** linting reports no violation

#### Scenario: Other layers may not import it

- **WHEN** a source file in a `type:core` library, or the module-boundary constraints for `type:domain`, `type:application`, `type:contracts`, `type:util` or `type:data-access`, or for the web or mobile app, are checked against a dependency on `@basis/shared-infrastructure`
- **THEN** the dependency is reported, or is not allowed, respectively

### Requirement: The shared infrastructure is split into driving and driven

Every non-spec source file of `libs/shared/infrastructure/src` other than `index.ts` SHALL be under `src/driving/` or `src/driven/`, and the database token SHALL be under `src/driven/`.

#### Scenario: The layout holds

- **WHEN** the library's non-spec source files are listed
- **THEN** each one other than `src/index.ts` is under `src/driving/` or `src/driven/`, and `DATABASE` is defined in a file under `src/driven/`

### Requirement: The built API runs with the shared infrastructure

The API's build SHALL build `@basis/shared-infrastructure` first, and the built API SHALL resolve it at runtime from the library's compiled output, both in the workspace and in the package `pnpm deploy --filter api --prod` produces for the image.

#### Scenario: The built API starts

- **WHEN** the API is built and `node dist/main.js` is started with `DATABASE_URL` naming a database where nothing listens, and `GET /health` is requested
- **THEN** the response has status `200`

#### Scenario: The deployed package starts

- **WHEN** the API is built, `pnpm deploy --filter api --prod` writes its package to an empty directory, and `node dist/main.js` is started there with `DATABASE_URL` naming a database where nothing listens, and `GET /health` is requested
- **THEN** the response has status `200`

#### Scenario: The library's package exposes compiled output

- **WHEN** the library's `package.json` is read
- **THEN** its exports resolve to JavaScript files under `dist/`, not to TypeScript sources

### Requirement: Other contexts read the caller from the shared infrastructure

The shared infrastructure SHALL provide, under `src/driving/`, a `Public` decorator that declares a route or controller public, and a `CurrentUser` parameter decorator that yields the authenticated caller as `{ userId }`. A context SHALL NOT need to import `identity`'s infrastructure to read the caller.

#### Scenario: A route reads its caller

- **WHEN** a controller outside `identity` takes `@CurrentUser()` and is requested with a valid session of user `u1`
- **THEN** the parameter is `{ userId: "u1" }`

#### Scenario: A declared public route

- **WHEN** a controller method marked `@Public()` is requested without credentials
- **THEN** it is not refused for lack of a session
