## MODIFIED Requirements

### Requirement: A domain failure is answered by its kind

The shared infrastructure SHALL provide `toResponse(result)`, which returns the value of a successful `Result`. For a failed `Result` carrying a `DomainError`, it SHALL cause the API to answer with a problem document whose `status` is `404` for kind `not-found`, `409` for `conflict`, `422` for `rule-violated`, `403` for `forbidden` and `401` for `unauthenticated`, whose `detail` is the error's `message`, and whose `code` is the error's `code`.

#### Scenario: A success is answered with its value

- **WHEN** a route of the API returns `toResponse` of a successful result carrying `{ "id": "h1" }`
- **THEN** the response has status `200` and the body `{ "id": "h1" }`

#### Scenario: Each kind maps to its status

- **WHEN** a route of the API returns `toResponse` of a failed result carrying a `DomainError` of each kind, with `code` `"habit.example"` and `message` `"Example failure."`
- **THEN** the response's status is `404`, `409`, `422`, `403` or `401` respectively, with the content type `application/problem+json` and a body whose `status` equals the response status, `detail` is `"Example failure."` and `code` is `"habit.example"`

#### Scenario: An unauthenticated failure names the scheme

- **WHEN** a route of the API returns `toResponse` of a failed result carrying a `DomainError` of kind `unauthenticated`
- **THEN** the response's status is `401` and it carries the header `WWW-Authenticate: Bearer`

## ADDED Requirements

### Requirement: A problem can carry response headers

A `ProblemException` SHALL accept optional response headers, and the API SHALL send them with the problem document.

#### Scenario: A header reaches the response

- **WHEN** a route throws a `ProblemException` of status `401` with the header `WWW-Authenticate: Bearer`
- **THEN** the response has status `401`, content type `application/problem+json`, and the header `WWW-Authenticate: Bearer`
