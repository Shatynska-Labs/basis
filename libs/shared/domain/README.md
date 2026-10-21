# shared-domain

Building blocks every context's `domain` may use (`scope:shared`, `type:domain`; ADR-0012 §6). It depends on nothing.

- `DomainError`, `DomainErrorKind`: an expected failure, returned in a `Result` rather than thrown (ADR-0012 §5), with a `code` and a `kind` (`not-found`, `conflict`, `rule-violated`, `forbidden`, `unauthenticated`) that driving adapters map, for HTTP through `toResponse` in `@basis/shared-infrastructure`.

It is built to `dist/`, because `identity`'s libraries import it at runtime (`add-identity-authentication` design decision 12).

Tests: `pnpm nx test shared-domain`.
