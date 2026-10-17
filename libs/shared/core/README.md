# shared-core

Language-level additions every layer may use (`scope:shared`, `type:core`; ADR-0012 §6). It depends on nothing.

- `Result<F, S>`, `success`, `failure`: expected failures as values (ADR-0012 §5).

Tests: `pnpm nx test shared-core`.
