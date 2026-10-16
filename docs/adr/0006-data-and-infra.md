# ADR-0006: PostgreSQL, Redis/BullMQ, Hetzner Object Storage

**Status:** accepted · **Date:** 2026-10-17

## Context

We need relational data (metrics, rules, statuses), asynchronous photo processing, and file storage; there is a Hetzner server with an infrastructure repository.

## Decision

**PostgreSQL** — the main database (and the LangGraph.js checkpointer); each table belongs to exactly one bounded context. **Redis + BullMQ** (`@nestjs/bullmq`) — queues (photo assessment, day recalculation, reminders). **Hetzner Object Storage** (S3-compatible) — photos, uploaded from the client via presigned URLs.

## Alternatives considered

- Storing photos on the server disk — scales and backs up worse.
- A separate time-series database — premature at the expected data volume.
- A database per context — unnecessary operational overhead for a modular monolith.

## Consequences

+ Everything stays within the existing Hetzner infrastructure.
+ The user never waits for the AI: photo → queue → result → push.
− Two more services to operate (Redis, Object Storage).
