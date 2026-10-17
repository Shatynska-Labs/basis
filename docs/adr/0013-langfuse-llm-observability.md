# ADR-0013: Self-hosted Langfuse for LLM observability

**Status:** accepted · **Date:** 2026-10-17

## Context

The `nutrition` and `insights` contexts run LangGraph.js graphs (ADR-0004). They need tracing to debug them, and datasets and evals to measure plate-assessment and weekly-review quality against the PRD's manual-correction signal (above 30% corrected means the prompt needs work).

Without a rule, traces would carry what the graphs see: meal photos and health context. `docs/product/06-risks-and-open-questions.md` lets meal photos leave the system only to the AI provider's vision model, and only with explicit consent. A hosted tracing service would be a second recipient.

## Decision

**Langfuse, self-hosted on the existing Hetzner infrastructure**, for tracing, datasets and evals.

- Traces stay on Hetzner; no trace data leaves the system.
- **Traces hold references, not photos.** The graph adapter records a meal photo as its Object Storage reference, never the image: Langfuse's LangChain callback records model inputs verbatim by default, so the adapter sets a `mask` function that replaces image content (base64 data and image URLs) with the photo's storage reference before a span is sent. Presigned URLs never appear in a trace, since one is a usable credential until it expires.
- **Only the system operator sees production traces**, for debugging, and every access is logged. Audit logs and data-retention policies are Enterprise features of self-hosted Langfuse; the open-source build keeps traces indefinitely. Without a licence, the deploying change puts the Langfuse UI behind the reverse proxy, restricted to the operator, with the proxy's access log as the record, and runs a scheduled job that deletes traces past the retention period through Langfuse's public API. Evals run on datasets built from consented or synthetic data.
- Traces are personal data: each carries the user's identifier, is kept for a bounded retention period, and is deleted with the account, including any media in Langfuse's blob storage as a backstop should the mask miss one. The retention value, and the choice between the Enterprise licence and the self-built purge and logging, belong to the change that deploys Langfuse.
- Evals measure quality; they are not part of the CI gate.
- The Langfuse SDK is used only in `infrastructure` (ADR-0012).

## Alternatives considered

- **LangSmith with masking** of photos and personal data — hosted and convenient, but it needs a DPIA addition and trusts the masking to be complete.
- **LangSmith on synthetic data only** — evals without privacy exposure, but no production tracing.
- **No dedicated tool** — logs and ad-hoc scripts; no datasets, no eval history.

## Consequences

- Health data and meal photos never reach a third party for observability.
- One tool for traces, datasets and evals, with LangGraph.js support.
- The tool is already known from earlier projects.
  − More services to operate: self-hosted Langfuse brings its own PostgreSQL, ClickHouse, Redis and blob storage.
  − Account deletion has to reach Langfuse as well as the application's tables.
  − Upgrades and backups of the Langfuse stack are ours.
  − On the open-source build, retention and access logging are ours to build (a purge job, proxy access logs), or an Enterprise licence is a cost.
  − The trace-masking function is security-relevant code: a gap in it puts a photo in a second store.
