# shared-domain Specification

## Purpose

The shared kernel's domain error: what every context's domain failure carries, and that the shared domain depends on nothing.

## Requirements

### Requirement: A domain error carries a kind, a code and a message

The shared domain SHALL provide an abstract `DomainError` whose instances have a `kind`, one of `"not-found"`, `"conflict"`, `"rule-violated"` and `"forbidden"`, a string `code` and a string `message`. A `DomainError` SHALL NOT be an instance of `Error`, since it is returned in a `Result`, not thrown (ADR-0012 §5).

#### Scenario: A subclass declares its kind and code

- **WHEN** a class extending `DomainError` with `kind` `"not-found"` and `code` `"habit.not-found"` is constructed with the message `"No such habit."`
- **THEN** the instance's `kind` is `"not-found"`, its `code` is `"habit.not-found"`, its `message` is `"No such habit."`, it is an instance of `DomainError`, and it is not an instance of `Error`

#### Scenario: Only the four kinds type-check

- **WHEN** a class extending `DomainError` declares `kind` as `"teapot"`
- **THEN** the code does not type-check

### Requirement: The shared domain depends on nothing

The shared domain SHALL import no other library of the workspace and no third-party package, and SHALL carry the tags `scope:shared` and `type:domain` (ADR-0012 §6, §7).

#### Scenario: The shared domain is used without a framework

- **WHEN** the shared domain's public entry point is imported in a test with no framework, database or network available
- **THEN** `DomainError` is usable, and the shared domain's package declares no runtime dependency and the tags `scope:shared` and `type:domain`
