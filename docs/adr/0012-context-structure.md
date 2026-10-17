# ADR-0012: Context structure — ports and adapters, CQRS, Result

**Status:** accepted; supersedes in part ADR-0004, ADR-0005, ADR-0010 · **Date:** 2026-10-17

## Context

ADR-0010 split contexts into fully layered ones (`habits`, `stake`) and plain Nest modules with a thin service layer, routed domain events through the Nest EventEmitter, and kept Nest out of everything but `infrastructure`. ADR-0005's tag table followed that split with `type:feature`. ADR-0004 chose NestJS without fixing a version or saying where its decorators may appear.

Earlier projects of the same team settled a different shape: DDD with clean architecture and CQRS in a NestJS API (three layers, `domain` optional, a `shared` module with a `core` for language-level additions such as `Result`), and ports and adapters with `infrastructure` split into `driving` and `driven` in a later modular monolith. One shape for every context is easier to learn, to generate and to review than two.

## Decision

### 1. Every context has the same shape

Supersedes ADR-0010 §3.

```
libs/<context>/
  domain/            optional; only where there are real invariants
  application/       commands/ and queries/ (command or query + handler), ports
  infrastructure/
    driving/         what calls the context
    driven/          what the context calls
  contracts/         the public surface
```

- **`domain`** — entities, value objects, aggregates, domain errors, rules. Present where the context has invariants worth modelling (`habits`, `stake`, and others as they earn it); absent otherwise.
- **`application`** — one folder per command or query, each holding the message and its handler; ports for read repositories, write repositories and gateways.
- **`infrastructure/driving`** — adapters that call into the context: HTTP controllers, domain-event subscribers, BullMQ processors, schedules, webhooks.
- **`infrastructure/driven`** — adapters the context calls: Drizzle repositories (ADR-0011), the AI provider, object storage, push, the monobank API.
- **`contracts`** — events, query interfaces and Zod DTOs: the only part another context or app may import.

`domain`, `application`, `infrastructure` and `contracts` are separate Nx libraries. `driving` and `driven` are folders inside `infrastructure`; a driving adapter reaches a driven one only through `application`, enforced with `no-restricted-imports`.

Anti-corruption layers fall into the adapters: Health Connect data arrives from the phone through a driving HTTP adapter in `metrics`; the monobank webhook is a driving adapter and the monobank API a driven one in `stake`; the AI provider is a driven adapter in `nutrition` and `insights`. External formats never reach `application` or `domain`.

### 2. CQRS at the application level

Commands and queries go through the `@nestjs/cqrs` `CommandBus` and `QueryBus`, with separate read and write repositories over the one database. Separate read models remain out of scope, as ADR-0010 states.

### 3. Domain events through the `@nestjs/cqrs` `EventBus`

Supersedes ADR-0010 §5's in-process Nest EventEmitter, so one mechanism carries commands, queries and events. Async work still goes through BullMQ.

### 4. NestJS 12, and where its decorators may appear

Supersedes ADR-0004 in part: the backend runs on **NestJS 12**. Nest still relies on the legacy `experimentalDecorators` and `emitDecoratorMetadata`, because its dependency injection reads constructor types through `reflect-metadata` and the TC39 standard has no parameter decorators.

- **`domain`, `shared/core`, `shared/domain`, `shared/util`** — pure TypeScript: no Nest, no ORM, no HTTP, no implicit "now".
- **`application`** — may use `@nestjs/common` and `@nestjs/cqrs` (`@CommandHandler`, `@QueryHandler`, `@EventsHandler`, `@Inject`) and no other framework.
- **`infrastructure`** — everything else.
- **Validation** — request bodies, queries and parameters are validated with the Zod schemas from `contracts` through NestJS 12's Standard Schema support in route decorators.

### 5. Errors are values

Expected failures are returned as `Result<F, S>` (`failure` / `success`) by `domain` and by handlers, and mapped to responses by driving adapters. Throwing is for defects.

### 6. `libs/shared` is a Shared Kernel

| Library | Holds | Tag |
|---|---|---|
| `shared/core` | additions where the language falls short, starting with `Result` | `type:core` |
| `shared/domain` | `Entity`, `AggregateRoot`, `ValueObject`, `DomainError`, `Rule` | `type:domain` |
| `shared/util` | dates, time zones, units | `type:util` |
| `shared/api-client` | the typed client and TanStack Query hooks | `type:data-access` |

`core`, `domain` and `util` are usable from any context's `domain` and from the web and mobile apps.

### 7. Tags and boundaries

Supersedes ADR-0005's boundary-rule table.

| Tag | May depend on |
|---|---|
| `type:core` | nothing |
| `type:util` | `type:core`, `type:util` |
| `type:contracts` | `type:contracts`, `type:core`, `type:util` |
| `type:domain` | `type:domain` of the same scope or `scope:shared`, `type:core`, `type:util` |
| `type:application` | `type:domain` and `type:contracts` of the same scope; `type:contracts` of other scopes; `type:core`, `type:util` |
| `type:infrastructure` | `type:application`, `type:domain`, `type:contracts` of the same scope; `type:contracts` of other scopes; `type:core`, `type:util` |
| `type:data-access` | `type:contracts`, `type:core`, `type:util` |
| `scope:<context>` | its own scope, `scope:shared`, and only `type:contracts` of other contexts |
| apps | any library |

External imports are constrained in the same `depConstraints`:

- `type:core`, `type:util`, `type:domain` — `bannedExternalImports`: every framework, ORM, database, queue, HTTP and SDK package.
- `type:application` — `bannedExternalImports`: the same set except `@nestjs/common` and `@nestjs/cqrs`; plain libraries stay allowed.
- `type:contracts` — `allowedExternalImports`: `zod` only, because the web and mobile apps consume contracts as well as the API.

A violation is a lint error and is fixed, never silenced with `eslint-disable`.

## Alternatives considered

- **Keep ADR-0010's split** (fully layered `habits` and `stake`, plain modules elsewhere) — fewer files in simple contexts, but two shapes to learn, and a simple context that grows has to be restructured.
- **A framework-free `application`** — handlers registered through wrappers in `infrastructure`; the purest layering, at the price of a wrapper per handler.
- **Driving and driven as separate Nx libraries** (`type:driving`, `type:driven`) — Nx enforces the split, but every context doubles its infrastructure projects.
- **Fastify or Hono with a hand-written composition root instead of NestJS** — no decorators anywhere, but the module system, the three buses and the queue wiring would be built by hand.
- **Effect-TS** — typed errors and layered dependency injection in place of `Result` and Nest, but a new paradigm for the whole codebase.
- **The Nest EventEmitter for domain events** — works, but a second mechanism beside the CQRS buses.

## Consequences

+ One shape for every context: a simple context grows a `domain` without restructuring.
+ Every invocation path is a driving adapter over the same use case, so HTTP, events, queues and schedules share the handlers.
+ Framework use is bounded by lint, not by review.
− Simple contexts carry `application` and `contracts` even when their logic is thin.
− `application` depends on `@nestjs/common` and `@nestjs/cqrs`.
− Legacy decorators need tooling support: Vitest compiles Nest code through SWC, because esbuild does not emit decorator metadata.
