# shared-core Specification

## Purpose

Language-level additions every layer of every context may use, starting with `Result`, the value through which `domain` and application handlers return expected failures instead of throwing (ADR-0012 §5).

## Requirements

### Requirement: A result is either a success or a failure

The shared core SHALL provide a `Result<F, S>` type whose first parameter is the failure type and second the success type, and two constructors: `success(value)` producing a successful result carrying `value`, and `failure(value)` producing a failed result carrying `value`. A result SHALL be exactly one of the two, and the carried value SHALL be readable as `value` and returned unchanged, by identity for objects.

#### Scenario: A success carries its value

- **WHEN** a result is produced by `success` with the object `{ id: 1 }`
- **THEN** reading its `value` returns that same object

#### Scenario: A failure carries its value

- **WHEN** a result is produced by `failure` with the string `"not-found"`
- **THEN** reading its `value` returns `"not-found"`

#### Scenario: A falsy value is still carried

- **WHEN** a result is produced by `success`, or by `failure`, with `0`, `""`, `false`, `null` or `undefined`
- **THEN** it is a success, or a failure respectively, and its `value` is that same value

### Requirement: A result reports which it is

Every result SHALL answer `isSuccess()` and `isFailure()`, exactly one of which returns `true`. In TypeScript, each check SHALL narrow the result, so that after `isSuccess()` returns `true` its `value` has the success type, and after `isFailure()` returns `true` its `value` has the failure type.

#### Scenario: A success reports success

- **WHEN** `isSuccess()` and `isFailure()` are called on a result produced by `success`
- **THEN** `isSuccess()` returns `true` and `isFailure()` returns `false`

#### Scenario: A failure reports failure

- **WHEN** `isSuccess()` and `isFailure()` are called on a result produced by `failure`
- **THEN** `isFailure()` returns `true` and `isSuccess()` returns `false`

#### Scenario: A check narrows the value's type

- **WHEN** a function returning `Result<string, number>` is checked with `isSuccess()` and the branch reads `value` as a `number`, and the other branch reads `value` as a `string`
- **THEN** the code type-checks, and reading the success branch's `value` as a `string` does not

#### Scenario: A check narrows when both types are the same

- **WHEN** a function returning `Result<string, string>` is checked with `isSuccess()`, and the other branch reads `value`, and likewise with `isFailure()`
- **THEN** the code type-checks, with `value` a `string` in every branch, and neither branch's result is narrowed to an impossible type

### Requirement: The shared core depends on nothing

The shared core SHALL import no other library of the workspace and no third-party package, so that every layer, the API and the web and mobile apps can use it (ADR-0012 §6, §7).

#### Scenario: The shared core is used without a framework

- **WHEN** the shared core's public entry point is imported in a test with no framework, database or network available
- **THEN** `success`, `failure` and the `Result` type are usable, and the shared core's package declares no runtime dependency
