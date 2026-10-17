# ADR-0011: Drizzle ORM for PostgreSQL

**Status:** accepted · **Date:** 2026-10-17

## Context

ADR-0006 chose PostgreSQL but no way to reach it from code. The data-access layer has to keep the domain pure (ADR-0010: no ORM in `domain`), let each bounded context own its tables, and let an aggregate be loaded and saved as a whole.

## Decision

**Drizzle ORM** with **drizzle-kit** for migrations, used only in `infrastructure/driven`.

- **The persistence model is not the domain model.** Drizzle tables are plain TypeScript objects (`pgTable(...)`), not decorated classes. A repository adapter maps between table rows and domain objects; the repository port lives in `application`.
- **Aggregates are loaded and saved whole.** There is no lazy loading, no hidden change tracking and no relation navigation through objects: a repository loads an aggregate explicitly, saves it in one transaction, and other aggregates are referenced by identifier.
- **Each context owns its tables in its own PostgreSQL schema** (`pgSchema('<context>')`), defined in that context's `infrastructure` library, so Nx boundaries (ADR-0012) keep other contexts from importing them.
- **Rule 1 — row types stay in `infrastructure`.** Drizzle's inferred types (`$inferSelect`, `$inferInsert`) never appear in `domain`, `application` or `contracts`. `contracts` define their types with hand-written Zod schemas, not schemas generated from tables.
- **Rule 2 — transactions go through a port.** A transaction spanning several repositories is carried by a `TransactionManager` port in `application`, implemented with AsyncLocalStorage in `infrastructure`.
- **One drizzle-kit migration history** covers the database, owned by `apps/api`: its `drizzle.config.ts` collects every context's schema and its `migrations/` folder holds the history. An app may depend on any library (ADR-0012 §7), so collecting the schemas there crosses no boundary, while a library doing it would.
- **The LangGraph.js checkpointer tables are the exception.** The checkpointer library creates and migrates them itself, so they sit outside drizzle-kit. Each context running a graph (`nutrition`, `insights`) gives its checkpointer its own schema (`nutrition_checkpoints`, `insights_checkpoints`) through the checkpointer's `schema` option, so every table is still owned by one context.

## Alternatives considered

- **MikroORM** — Data Mapper and a Unit of Work, closest to textbook DDD; keeping its entities out of the domain takes discipline (`EntitySchema` instead of decorators).
- **TypeORM** — decorators invite annotating domain classes, which pulls the ORM into the domain.
- **Prisma** — one generated client for every context blurs table ownership, and its generated types invite use in the domain.

## Consequences

+ The domain cannot depend on the ORM by construction.
+ Table ownership is enforced by schemas and Nx boundaries, not by agreement.
+ SQL-first queries are predictable for read repositories (CQRS, ADR-0012).
− Mappers between rows and domain objects are written by hand, mainly in `habits` and `stake`.
− The Unit of Work is ours to write: the `TransactionManager` port and its adapter.
− NestJS integration is a small provider of our own, not an official module.
