# api-http-errors Specification

## Purpose

How the API answers a failure over HTTP: every error response is an RFC 9457 problem document, a domain failure is answered by its kind, a request failing its schema is refused with its issues, and a defect is answered without disclosure.

## Requirements

### Requirement: Error responses are problem documents

Every response the API sends with a status of `400` or above SHALL have the content type `application/problem+json` and a JSON body holding `type` `"about:blank"`, `title` the standard reason phrase of the status (or `"Error"` for a status that has none), and `status` the status code.

#### Scenario: An unknown route is a problem document

- **WHEN** `GET /no-such-route` is requested of the API
- **THEN** the response has status `404`, the content type `application/problem+json`, and a body whose `type` is `"about:blank"`, `title` is `"Not Found"` and `status` is `404`

#### Scenario: The health report is unaffected

- **WHEN** `GET /health` is requested of the API
- **THEN** the response has status `200`, a JSON content type that is not `application/problem+json`, and the body `api-health` specifies

### Requirement: A domain failure is answered by its kind

The shared infrastructure SHALL provide `toResponse(result)`, which returns the value of a successful `Result`. For a failed `Result` carrying a `DomainError`, it SHALL cause the API to answer with a problem document whose `status` is `404` for kind `not-found`, `409` for `conflict`, `422` for `rule-violated` and `403` for `forbidden`, whose `detail` is the error's `message`, and whose `code` is the error's `code`.

#### Scenario: A success is answered with its value

- **WHEN** a route of the API returns `toResponse` of a successful result carrying `{ "id": "h1" }`
- **THEN** the response has status `200` and the body `{ "id": "h1" }`

#### Scenario: Each kind maps to its status

- **WHEN** a route of the API returns `toResponse` of a failed result carrying a `DomainError` of each kind, with `code` `"habit.example"` and `message` `"Example failure."`
- **THEN** the response's status is `404`, `409`, `422` or `403` respectively, with the content type `application/problem+json` and a body whose `status` equals the response status, `detail` is `"Example failure."` and `code` is `"habit.example"`

### Requirement: A request failing its schema is refused

For a route parameter (a body, a query or a route parameter) whose route decorator names a Standard Schema, the API SHALL validate the incoming value against it before the handler runs. An invalid value SHALL be answered with status `400` and a problem document with an `errors` array holding, for each issue, its `path` as an array of keys and its `message`, and the handler SHALL NOT run. A valid value SHALL reach the handler as the value the schema produces.

#### Scenario: An invalid body is refused with its issues

- **WHEN** a route whose body schema requires a string `name` and a positive integer `count` is requested with the body `{ "count": -1 }`
- **THEN** the response has status `400`, the content type `application/problem+json`, an `errors` array with one entry whose `path` is `["name"]` and one whose `path` is `["count"]`, each with a non-empty `message`, and the handler was not invoked

#### Scenario: An invalid query is refused

- **WHEN** a route whose query schema requires `limit` coercible to an integer is requested with `?limit=many`
- **THEN** the response has status `400` and an `errors` entry whose `path` is `["limit"]`

#### Scenario: A valid request reaches the handler parsed

- **WHEN** a route whose query schema coerces `limit` to a number is requested with `?limit=5`
- **THEN** the handler receives `limit` as the number `5`

### Requirement: A defect is answered without disclosure and logged

A defect is anything thrown while handling a request that is either an HTTP exception of status `500` or above, or neither an HTTP exception nor an exposed client error (see the next requirement). The API SHALL answer a defect with a problem document holding exactly `type`, `title` and `status`, with status `500` or the HTTP exception's status, and SHALL write one log entry for it at level `error`.

#### Scenario: A thrown error is not disclosed

- **WHEN** a route of the API throws `new Error("n0t-for-clients")`
- **THEN** the response has status `500`, the content type `application/problem+json`, a body whose keys are exactly `type`, `title` and `status` and which does not contain `n0t-for-clients`, and an `error` entry is logged

#### Scenario: A server-side HTTP exception is not disclosed

- **WHEN** a route of the API throws `new ServiceUnavailableException("n0t-for-clients")`
- **THEN** the response has status `503`, a body whose keys are exactly `type`, `title` and `status` and which does not contain `n0t-for-clients`, and an `error` entry is logged

### Requirement: A defect's log entry discloses only what is safe

For a defect that is an `Error`, the log entry SHALL carry its name and stack. For any other thrown value, it SHALL carry the value's type and not the value.

#### Scenario: A thrown error is logged with its stack

- **WHEN** a route of the API throws `new Error("n0t-for-clients")`
- **THEN** the logged `error` entry carries the error's name and stack

#### Scenario: A thrown non-error is logged by type only

- **WHEN** a route of the API throws the string `"n0t-for-logs"`
- **THEN** the response has status `500`, and the logged `error` entry contains `string` and does not contain `n0t-for-logs`

### Requirement: A client error raised outside the framework keeps its status

When handling a request fails with a value that is not an HTTP exception but is marked `expose` `true` (as `http-errors` marks an error safe to show a client) and carries a numeric `status` or `statusCode` from `400` to `499`, the API SHALL answer with that status and a problem document holding exactly `type`, `title` and `status`, and SHALL NOT log it as a defect.

#### Scenario: An oversized body is refused as too large

- **WHEN** a route of the API accepting a JSON body is sent a JSON body larger than the body parser's limit
- **THEN** the response has status `413`, the content type `application/problem+json`, a body whose keys are exactly `type`, `title` and `status`, and no `error` entry is logged

#### Scenario: An upstream error carrying a client status is a defect

- **WHEN** a route of the API throws an `Error` with the property `status` `401` and no `expose` property
- **THEN** the response has status `500`, and an `error` entry is logged
