# ADR-0010: Pragmatic DDD and a modular monolith

**Status:** accepted; superseded in part by ADR-0012 · **Date:** 2026-10-17

> ADR-0012 §1 replaces point 3 (every context has the same shape, `domain` optional), and §3 replaces point 5 in mechanism and in meaning: contexts interact through integration events defined in `contracts`, published on the `@nestjs/cqrs` `EventBus`, while domain events stay inside their context. Point 2's "contexts do not import each other's domain" and point 4 still hold.

## Context

Basis must grow with new functionality (new life areas, Stake, challenges, coaches) without increasing coupling. Habit evaluation and stake logic are complex and must remain understandable and testable. The team prefers Domain-Driven Design, but without excessive ceremony.

## Decision

1. **Modular monolith.** One NestJS app split into bounded contexts (`docs/architecture/context-map.md`). Microservices are not considered.
2. **Bounded contexts = Nx boundaries.** Each context has its own `scope:<context>`; contexts do not import each other's domain.
3. **Full layering only where logic is complex:** `habits` and `stake` have `domain / application / infrastructure / contracts` layers. Other contexts (`results`, `sharing`, `identity`, `notifications`) are plain Nest modules with a thin service layer.
4. **The domain layer is pure TypeScript:** no Nest, ORM, HTTP, or implicit "now" (time is passed in explicitly).
5. **Contexts interact via domain events** (in-process Nest EventEmitter); asynchronous tasks (AI, reminders, recalculations) go through BullMQ.
6. **Anti-corruption layers** for external systems: Health Connect (`metrics`), monobank (`stake`), the AI provider (`insights`, `nutrition`). External formats never leak into domain models.
7. **Ubiquitous language** — terms from the domain model and glossary (`04-domain-model.md` §9) are used consistently in code, docs, and UI.

### Deliberately not doing (for now)

- event sourcing;
- full CQRS (separate read models for the dashboard are allowed if queries become heavy);
- transactional outbox (add if guaranteed event delivery becomes necessary);
- a database per context (one Postgres, but each table belongs to one context, and other contexts' tables are never read directly).

### Open question

How to model life areas (health, household, finances, etc.) — as separate contexts, extensions to `habits`, or configuration — will be decided during implementation. The word "domain" is used only in the DDD sense; spheres of habits are called "life areas".

## Alternatives considered

- **Layered architecture without contexts** (controllers / services / repositories for everything) — faster to start, but coupling grows with every feature.
- **Full DDD + CQRS + event sourcing** — excessive for the product's size.
- **Microservices** — operational complexity without need.

## Consequences

+ New features are added as subscribers to existing events, without changing the core.
+ The `habits` core is tested in isolation, without a database or framework.
+ Context boundaries are checked by the Nx linter (ADR-0005).
− More files and layers in `habits` and `stake`.
− Requires discipline: no shortcuts via direct imports of another context.
