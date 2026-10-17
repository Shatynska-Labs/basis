# Basis

<!-- ai-toolkit:project-foundation -->
## What it is

**Basis** is a framework for building the regular habits that form the foundation of a person's life. It credits habits automatically from data wherever possible, with manual input as a first-class fallback, and evaluates adherence through tiers and weekly goals rather than a binary daily check-off. Habits can belong to any life area; the first is health: physical activity and sleep from wearables via Health Connect, nutrition with AI assessment of meal photos, and long-term results such as weight and lab results.

## Problem

Meaningful change comes from regular actions sustained over months, and such plans fall apart not for lack of knowledge but because of all-or-nothing streak logic, trying to change too much at once, tedious manual tracking, goals set without regard to the real starting level, and lack of outside support. Existing trackers are mostly binary, streak-based and weakly integrated with the data devices already collect.

## Audience

- **Users** — people building a durable system of regular actions who value automation and a gentle yet disciplined approach. In MVP: an Android phone plus a wearable writing to Health Connect, using both mobile and web.
- **Observers** — people a user invites to see their progress and support them, through a web page without installing the app.
- **Coaches** (post-MVP) — professionals with extended access granted by the user.

## Scope

The MVP is a working product core in the health life area, suitable for daily use for at least three months, on a multi-user architecture without public onboarding:

- **Mobile (Android):** background Health Connect sync, camera, weight, measurements, day and week status, push.
- **Web:** trend dashboard, history, habit settings, lab results, observer management, observer page.
- **Backend contexts:** `metrics`, `habits`, `nutrition`, `results`, `sharing`, `insights`, `identity`, `notifications`.
- **Seven starter habits** as the health template.
- **Authentication** — email magic link or Google OAuth, decided in its own change.

Delivery follows the phases in [`docs/product/05-roadmap.md`](docs/product/05-roadmap.md). Requirements: [`docs/product/03-prd-mvp.md`](docs/product/03-prd-mvp.md).

## Non-Goals

Never, by product principle: counting calories or macros; diagnosing or giving medical advice; penalizing missing data; publishing user data openly (sharing is by invitation only); initiating bank transfers (the Stake module only calculates and verifies).

Not in MVP: the Stake module (right after MVP), the coach role, correlations in the weekly review, the doctor report, public onboarding, the template library, group challenges, habits outside the health area, iOS and Apple Health, lab-result OCR.

Not in the architecture, for now: microservices, event sourcing, separate read models (full CQRS — command and query separation at the application level is adopted), a transactional outbox, a database per context.

## Technology

TypeScript throughout.

| Layer | Choice |
|---|---|
| Mobile (primary) | Expo (React Native) with a dev build, `react-native-health-connect` |
| Web | Vite + React, TanStack Router, TanStack Query, ECharts (`echarts-for-react`) |
| Backend | NestJS 12; `@nestjs/cqrs` for commands, queries and domain events; LangGraph.js (`@langchain/langgraph`) for AI workflows |
| Data | PostgreSQL with Drizzle ORM and drizzle-kit migrations; Redis + BullMQ (`@nestjs/bullmq`) |
| Files | Hetzner Object Storage (S3-compatible), presigned uploads |
| LLM observability | Langfuse, self-hosted on Hetzner |
| Contracts and validation | Zod, through Standard Schema in NestJS route decorators |
| Infrastructure | the existing Hetzner server and infrastructure repository |
| Monorepo | Nx on pnpm workspaces |

Decisions and alternatives: [`docs/adr/`](docs/adr/README.md).

## Architecture

A modular monolith with pragmatic DDD and ports and adapters ([ADR-0010](docs/adr/0010-ddd-modular-monolith.md), superseded in part by [ADR-0012](docs/adr/0012-context-structure.md); [context map](docs/architecture/context-map.md)):

- **Three apps** — `apps/mobile`, `apps/web`, `apps/api` — over libraries.
- **Bounded contexts:** `habits` (core), `metrics`, `nutrition`, `results`, `sharing`, `stake`, `insights`, `identity`, `notifications`.
- **Every context has the same shape:**

  ```
  libs/<context>/
    domain/            optional; only where there are real invariants
    application/       commands/ and queries/ (command or query + handler), ports
    infrastructure/
      driving/         what calls the context: HTTP, event subscribers, BullMQ processors, schedules, webhooks
      driven/          what the context calls: Drizzle repositories, AI provider, object storage, push, monobank API
    contracts/         the public surface: events, query interfaces, Zod DTOs
  ```

- **CQRS at the application level:** `@nestjs/cqrs` command and query buses, separate read and write repositories over one database; domain events through its `EventBus`; async work through BullMQ.
- **Where frameworks may appear:** `domain` is pure TypeScript (no Nest, ORM, HTTP or implicit "now"); `application` may use only `@nestjs/common` and `@nestjs/cqrs` decorators; everything else lives in `infrastructure`.
- **Errors are values:** expected failures are returned as `Result<F, S>`, not thrown.
- **`libs/shared`** is a Shared Kernel: `core` (`Result` and other language-level additions), `domain` (`Entity`, `AggregateRoot`, `ValueObject`, `DomainError`, `Rule`), `util` (dates, time zones, units), `api-client`.
- **Boundaries are enforced** by `@nx/enforce-module-boundaries` with `scope:*` and `type:*` tags ([ADR-0005](docs/adr/0005-nx-monorepo.md), tag table superseded by [ADR-0012](docs/adr/0012-context-structure.md)); a violation is a lint error.
- **One PostgreSQL database**; each context's tables live in PostgreSQL schemas it owns (one Drizzle schema per context, plus a checkpointer schema where a context runs a graph), and Drizzle row types never leave `infrastructure` ([ADR-0011](docs/adr/0011-drizzle-orm.md)).
<!-- /ai-toolkit:project-foundation -->

## Documentation

The discovery-phase documents in [`docs/`](docs/README.md) are the top-level source of truth; every change goes through OpenSpec (`openspec/`).
