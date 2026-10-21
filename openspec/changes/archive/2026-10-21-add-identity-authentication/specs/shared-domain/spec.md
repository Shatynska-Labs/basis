## MODIFIED Requirements

### Requirement: A domain error carries a kind, a code and a message

The shared domain SHALL provide an abstract `DomainError` whose instances have a `kind`, one of `"not-found"`, `"conflict"`, `"rule-violated"`, `"forbidden"` and `"unauthenticated"`, a string `code` and a string `message`. A `DomainError` SHALL NOT be an instance of `Error`, since it is returned in a `Result`, not thrown (ADR-0012 §5).

#### Scenario: A subclass declares its kind and code

- **WHEN** a class extending `DomainError` with `kind` `"not-found"` and `code` `"habit.not-found"` is constructed with the message `"No such habit."`
- **THEN** the instance's `kind` is `"not-found"`, its `code` is `"habit.not-found"`, its `message` is `"No such habit."`, it is an instance of `DomainError`, and it is not an instance of `Error`

#### Scenario: The unauthenticated kind

- **WHEN** a class extending `DomainError` declares `kind` as `"unauthenticated"`
- **THEN** the code type-checks

#### Scenario: Only the four kinds type-check

- **WHEN** a class extending `DomainError` declares `kind` as `"teapot"`
- **THEN** the code does not type-check
