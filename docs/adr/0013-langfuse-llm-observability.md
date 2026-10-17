# ADR-0013: Self-hosted Langfuse for LLM observability

**Status:** accepted · **Date:** 2026-10-17

## Context

The `nutrition` and `insights` contexts run LangGraph.js graphs (ADR-0004). They need tracing to debug them, and datasets and evals to measure plate-assessment and weekly-review quality against the PRD's manual-correction signal (above 30% corrected means the prompt needs work).

Traces carry what the graphs see: meal photos and health context. `docs/product/06-risks-and-open-questions.md` lets meal photos leave the system only to the AI provider's vision model, and only with explicit consent. A hosted tracing service would be a second recipient.

## Decision

**Langfuse, self-hosted on the existing Hetzner infrastructure**, for tracing, datasets and evals.

- Traces stay on Hetzner; no trace data leaves the system.
- Traces are personal data: each carries the user's identifier, is kept for a bounded retention period, and is deleted with the account — trace records and the media Langfuse keeps in its blob storage alike. The retention value is set by the change that deploys Langfuse.
- Evals measure quality; they are not part of the CI gate.
- The Langfuse SDK is used only in `infrastructure` (ADR-0012).

## Alternatives considered

- **LangSmith with masking** of photos and personal data — hosted and convenient, but it needs a DPIA addition and trusts the masking to be complete.
- **LangSmith on synthetic data only** — evals without privacy exposure, but no production tracing.
- **No dedicated tool** — logs and ad-hoc scripts; no datasets, no eval history.

## Consequences

+ Health data and meal photos never reach a third party for observability.
+ One tool for traces, datasets and evals, with LangGraph.js support.
+ The tool is already known from earlier projects.
− More services to operate: self-hosted Langfuse brings its own PostgreSQL, ClickHouse, Redis and blob storage.
− Account deletion has to reach Langfuse as well as the application's tables.
− Upgrades and backups of the Langfuse stack are ours.
