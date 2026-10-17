# Design: project-foundation

The foundation records the nine decisions of `rules/project-foundation.md`. The discovery phase already settled most of them in `docs/`, which remains the top-level source of truth; each section below states the decision and names the document that argues it, rather than restating the argument.

## Identity

### What it is

**Basis** is a framework for building the regular habits that form the foundation of a person's life. It credits habits automatically from data wherever possible, with manual input as a first-class fallback, and evaluates adherence through tiers and weekly goals rather than a binary daily check-off. Habits can belong to any life area; the first is health. (`docs/product/01-vision.md`)

### Problem it solves

Meaningful change comes from regular actions sustained over months, and such plans fall apart not for lack of knowledge but because of all-or-nothing streak logic, trying to change too much at once, tedious manual tracking, goals set without regard to the real starting level, and lack of outside support. Existing trackers are mostly binary, streak-based and weakly integrated with the data devices already collect. (`docs/product/01-vision.md`, `docs/product/02-competitive-analysis.md`)

### Intended audience

- **Users** — people building a durable system of regular actions who value automation and a gentle yet disciplined approach. In MVP: an Android phone plus a wearable writing to Health Connect, using both mobile and web.
- **Observers** — people a user invites to see their progress and support them, through a web page without installing the app.
- **Coaches** (post-MVP) — professionals with extended access granted by the user.

(`docs/product/01-vision.md`, `docs/product/03-prd-mvp.md`)

## Scope

The MVP is a working product core in the health life area, suitable for daily use for at least three months, on a multi-user architecture without public onboarding (`docs/product/03-prd-mvp.md`, user stories US-1 to US-24):

- **Mobile (Android):** background Health Connect sync, camera, weight, measurements, day and week status, push.
- **Web:** trend dashboard, history, habit settings, lab results, observer management, observer page.
- **Backend contexts:** `metrics`, `habits`, `nutrition`, `results`, `sharing`, `insights`, `identity`, `notifications`.
- **Seven starter habits** as the health template (`docs/product/04-domain-model.md`).
- **Authentication** — email magic link or Google OAuth, decided in its own change.

Delivery follows the phases of `docs/product/05-roadmap.md`: data-source validation, foundation, habits core, nutrition, results and observers, weekly review. Each feature is its own change.

## Non-Goals

Never, by product principle (`docs/product/01-vision.md`, `docs/product/03-prd-mvp.md`):

- counting calories or macros;
- diagnosing or giving medical advice;
- penalizing missing data;
- publishing user data openly — sharing is by invitation only;
- initiating bank transfers — the Stake module only calculates and verifies.

Not in MVP (`docs/product/03-prd-mvp.md`, `docs/product/05-roadmap.md`): the Stake module (right after MVP), the coach role, correlations in the weekly review, the doctor report, public onboarding, the template library, group challenges, habits outside the health area, iOS and Apple Health, lab-result OCR.

Not in the architecture, for now (ADR-0010): microservices, event sourcing, separate read models (full CQRS; command and query separation at the application level is adopted), a transactional outbox, a database per context.

## Technology

TypeScript throughout (ADR-0004):

| Layer | Choice | ADR |
|---|---|---|
| Mobile (primary) | Expo (React Native) with a dev build, `react-native-health-connect` | 0001, 0002 |
| Web | Vite + React, TanStack Router, TanStack Query, ECharts (`echarts-for-react`) | 0003, 0009 |
| Backend | NestJS 12; `@nestjs/cqrs` for commands, queries and integration events; LangGraph.js (`@langchain/langgraph`) for AI workflows | 0004, 0012 (supersedes 0004 in part) |
| Data | PostgreSQL with Drizzle ORM and drizzle-kit migrations; Redis + BullMQ (`@nestjs/bullmq`) | 0006, 0011 |
| Files | Hetzner Object Storage (S3-compatible), presigned uploads | 0006 |
| LLM observability | Langfuse, self-hosted on Hetzner: tracing, datasets, evals | 0013 |
| Contracts and validation | Zod, through Standard Schema in NestJS route decorators | 0012 |
| Infrastructure | the existing Hetzner server and infrastructure repository | 0006 |
| Monorepo | Nx on pnpm workspaces | 0005 |

### Decisions made during foundation

**NestJS stays, on version 12** (recorded in ADR-0012, which supersedes ADR-0004 in part). It still relies on the legacy `experimentalDecorators` and `emitDecoratorMetadata`, because its dependency injection reads constructor types through `reflect-metadata` and the TC39 standard has no parameter decorators. TypeScript keeps the legacy flag for the foreseeable future, so the cost is in tooling, not in risk: esbuild does not emit decorator metadata, so Nest code is tested through SWC. NestJS remains in wide and growing use (about 16M weekly `@nestjs/core` downloads in October 2026), and version 12 brings ESM, Vitest by default, and Standard Schema validation in route decorators, which lets the Zod `contracts` validate requests directly. Alternatives considered: Fastify or Hono with a hand-written composition root — a framework-free `application` layer, at the price of building the module system, command, query and event buses and queue wiring by hand; Effect-TS — typed errors and layered DI, but a new paradigm for the whole codebase; AdonisJS — active record, which works against DDD.

**Drizzle is the ORM** (ADR-0011). Its tables are plain TypeScript objects, not decorated classes, so the persistence model cannot become the domain model: a repository adapter maps between them. It has no lazy loading, no hidden change tracking and no relation navigation through objects, so an aggregate is loaded whole, saved whole in one transaction, and referenced from other aggregates by identifier. Each context owns its tables in its own PostgreSQL schema (`pgSchema('<context>')`), defined in that context's `infrastructure` library, so Nx boundaries enforce table ownership. Two rules come with it: Drizzle's inferred row types (`$inferSelect`, `$inferInsert`) never leave `infrastructure`, and `contracts` define their types with hand-written Zod schemas, not schemas generated from tables; and a transaction spanning several repositories is carried by a `TransactionManager` port with an AsyncLocalStorage adapter. One drizzle-kit migration history covers the database, owned by `apps/api`, whose `drizzle.config.ts` collects every context's schema — an app may depend on any library, so this crosses no boundary. The LangGraph.js checkpointer tables are the exception: the checkpointer library creates and migrates them itself, so they sit outside drizzle-kit, and each context running a graph (`nutrition`, `insights`) gives its checkpointer its own PostgreSQL schema (`nutrition_checkpoints`, `insights_checkpoints`), which keeps every table owned by one context. Alternatives considered: MikroORM — Data Mapper and Unit of Work closest to textbook DDD, but keeping it out of the domain takes discipline; TypeORM — decorators invite annotating domain classes; Prisma — one generated client for all contexts blurs ownership, and its generated types invite use in the domain.

**Langfuse, self-hosted, rather than LangSmith** (ADR-0013). Without a rule, traces of the plate assessment would carry meal photos and health context. `docs/product/06-risks-and-open-questions.md` lets meal photos leave the system only to the AI provider, with consent; a hosted tracing service would be a second recipient. Self-hosted Langfuse keeps traces on the existing Hetzner infrastructure and covers tracing, datasets and evals for LangGraph.js. Traces hold a meal photo's Object Storage reference, never the image, enforced by a Langfuse `mask` function in the graph adapter that also keeps presigned URLs out; only the system operator sees production traces, for debugging, with every access logged; evals run on consented or synthetic datasets. Access logging and retention policies are Enterprise features of self-hosted Langfuse, so without a licence the deploying change builds them (operator-only access behind the reverse proxy with its access log, a scheduled purge through the public API). Traces are personal data like any other: they carry the user's identifier, are kept for a bounded retention period, and are deleted with the account. Self-hosted Langfuse brings its own services to operate — its PostgreSQL, ClickHouse, Redis and blob storage — which is the cost of keeping the data in. Alternatives considered: LangSmith with masking of photos and personal data, which needs a DPIA addition and trusts the masking to be complete; LangSmith on synthetic data only, which gives evals but no production tracing.

## Architecture

A modular monolith with pragmatic DDD and ports and adapters (ADR-0010, superseded in part by ADR-0012; `docs/architecture/context-map.md`):

- **Three apps** — `apps/mobile`, `apps/web`, `apps/api` — over libraries.
- **Bounded contexts:** `habits` (core), `metrics`, `nutrition`, `results`, `sharing`, `stake`, `insights`, `identity`, `notifications`.
- **Every context has the same shape** (ADR-0012, superseding ADR-0010's split between fully layered and plain contexts):

  ```
  libs/<context>/
    domain/            optional; only where there are real invariants
    application/       commands/ and queries/ (command or query + handler), ports (read and write repositories, gateways)
    infrastructure/
      driving/         what calls the context: HTTP controllers, event subscribers, BullMQ processors, schedules, webhooks
      driven/          what the context calls: Drizzle repositories, the AI provider and LangGraph.js graphs, object storage, push, the monobank API
    contracts/         the public surface: events, query interfaces, Zod DTOs
  ```

  `domain`, `application`, `infrastructure` and `contracts` are separate Nx libraries; `driving` and `driven` are folders inside `infrastructure`, and a driving adapter reaches a driven one only through `application` (enforced with `no-restricted-imports`).
- **CQRS at the application level:** commands and queries through `@nestjs/cqrs` buses, with separate read and write repositories over the one database. Separate read models remain out of scope (ADR-0010).
- **Integration events** go through the `@nestjs/cqrs` `EventBus` (replacing ADR-0010's Nest EventEmitter, so one mechanism carries commands, queries and events); async work goes through BullMQ. A context reads another only through its `contracts`. Domain events are defined in `domain` and stay inside the context; a command handler maps them to the integration events defined in `contracts` and publishes those after commit, so `domain` never depends on `contracts`.
- **LangGraph.js graphs are driven adapters** behind `application` ports in the context's language (`MealPhotoInterpreter`, `WeeklyReviewWriter`); the graph, model SDK and checkpointer stay in `infrastructure/driven`, and deterministic decisions — the plate score, the bounds of a goal change — stay in `domain`.
- **Anti-corruption layers fall into the adapters:** Health Connect data arrives from the phone through a driving HTTP adapter in `metrics`; the monobank webhook is a driving adapter and the monobank API a driven one in `stake`; the AI provider is a driven adapter in `nutrition` and `insights`. External formats never reach `application` or `domain`.
- **Where frameworks may appear:** `domain` is pure TypeScript — no Nest, no ORM, no HTTP, no implicit "now". `application` may use `@nestjs/common` and `@nestjs/cqrs` (the decorators `@CommandHandler`, `@QueryHandler`, `@Inject`, and the `EventBus`) and nothing else from a framework; event subscribers (`@EventsHandler`) are driving adapters in `infrastructure`. `infrastructure` holds everything else. This is enforced, not agreed, through `bannedExternalImports` in the `depConstraints` of `@nx/enforce-module-boundaries`: `type:domain`, `type:core` and `type:util` ban every framework, ORM, database, queue, HTTP and SDK package; `type:application` bans the same set except `@nestjs/common` and `@nestjs/cqrs`, so plain libraries (a date library, say) stay allowed. `type:contracts`, consumed by the web and mobile apps as well as the API, may import only `zod` (`allowedExternalImports`).
- **Errors are values:** `domain` and handlers return `Result<F, S>` (`failure` / `success`) instead of throwing for expected failures; throwing is for defects.
- **`libs/shared`** — a Shared Kernel:
  - `core` — additions where the language falls short, starting with `Result`;
  - `domain` — `Entity`, `AggregateRoot`, `ValueObject`, `DomainError`, `Rule`;
  - `util` — dates, time zones, units;
  - `api-client` — the typed client and TanStack Query hooks.

  `core`, `domain` and `util` are pure TypeScript, usable from any context's `domain` and from the web and mobile apps.
- **Boundaries are enforced** by `@nx/enforce-module-boundaries` with `scope:*` and `type:*` tags. ADR-0012 supersedes ADR-0005's tag table: `type:feature` gives way to `type:application`, and `type:core` is added. A violation is a lint error.
- **One PostgreSQL database**; each context's tables live in PostgreSQL schemas that context owns — one Drizzle schema per context, plus a checkpointer schema for each context running a graph — so every table belongs to exactly one context.

## Testing Strategy

Tests are written at the lowest level that can show the behaviour, and the `domain` layer carries most of them.

| Level | What | How | Where |
|---|---|---|---|
| Unit — domain | entities, value objects, rules, evaluation — every context with a `domain` library | pure, no database, framework or clock; time passed in | beside the file, `*.spec.ts` |
| Unit — application | command and query handlers | in-memory fakes for ports, including the graph ports | beside the file, `*.spec.ts` |
| Unit — graphs | LangGraph.js graph adapters in `nutrition` and `insights` | graph wiring, state and translation to the port's types with a fake model; no network | beside the adapter, `*.spec.ts` |
| Contract | ACL translation for Health Connect, the monobank webhook, the AI provider's structured output | recorded fixtures; no live external calls | beside the adapter, `*.spec.ts` |
| Integration | driven adapters against real PostgreSQL and Redis | Testcontainers, one throwaway instance per run | `libs/<context>/<lib>/tests/integration/**/*.integration.spec.ts` |
| End-to-end — API | the Nest app over HTTP | supertest against a booted app on Testcontainers | `apps/api-e2e/` |
| Web | components and routes | Testing Library; Playwright later, starting with the observer page | beside the file, `*.spec.tsx` |
| Mobile | components and hooks | React Native Testing Library | beside the file, `*.spec.tsx` |

- **Runners:** Vitest for libraries, `apps/api` and `apps/web`, with SWC (`unplugin-swc`) wherever Nest decorators are compiled; Jest with `jest-expo` for `apps/mobile`, where Vitest does not handle React Native reliably.
- **Testcontainers gives each run its own database and Redis**, which is how this project meets the workflow's rule that verification writing to a shared service takes its own namespace. Verification never uses the `docker compose` services, which are for manual local development only.
- **Not automated:** Health Connect permissions, background sync and battery-optimization behaviour are verified by hand on the reference device (Galaxy Watch via Samsung Health), starting in Phase 0.
- **AI quality is evaluated, not gated:** plate-assessment and weekly-review quality is measured with Langfuse datasets and evals; the PRD's manual-correction rate (above 30% signals the prompt needs work) is the production signal. These evals are not part of the CI gate.
- **Test command:** `pnpm nx affected -t test` in CI and `pnpm nx run-many -t test` for the whole suite; integration tests run through a separate `integration` target (`pnpm nx affected -t integration`), which needs Docker; API end-to-end tests through `pnpm nx e2e api-e2e`.
- **Test-path glob:** `{apps,libs}/**/*.spec.{ts,tsx}`, excluding `**/*.integration.spec.ts` and `apps/api-e2e/**`, for the `test` target; `apps/api-e2e/**/*.spec.ts` belongs to the `e2e` target; the `integration` target runs only `{apps,libs}/**/tests/integration/**/*.integration.spec.ts`. The exclusion keeps the Docker-dependent specs out of `test`, so CI runs each spec once.

These commands exist once the workspace is scaffolded (roadmap Phase 1); until then the project has no test suite.

## Development Tooling

- **Runtime and package manager:** Node.js 24, the current LTS line (maintained until April 2028, well past the MVP's first months of use; NestJS 12 needs at least 20.19 or 22.12), pinned in `.nvmrc` and `engines`; pnpm pinned through `packageManager` and Corepack.
- **TypeScript:** `strict`, with `experimentalDecorators` and `emitDecoratorMetadata` enabled only in projects compiling Nest code.
- **Linting:** ESLint flat config with the Nx and typescript-eslint presets and `@nx/enforce-module-boundaries`. NestJS 12 generates projects with oxlint, but the boundary rule exists only for ESLint, so ESLint stays the linter; oxlint may run beside it as a faster first pass, never instead of it.
- **Formatting:** Prettier.
- **Build and tasks:** Nx targets `lint`, `typecheck`, `test`, `integration`, `build`, `e2e`; caching and `nx affected`.
- **Continuous integration:** GitHub Actions running `pnpm nx affected -t lint typecheck test integration build e2e` with `nrwl/nx-set-shas`. No pre-commit hook is an authority; CI is.
- **Local services:** `docker compose` for PostgreSQL, Redis and Langfuse.
- **Database migrations:** drizzle-kit.
- **Commits:** Conventional Commits.
- **`.gitignore`:** extended in this change with the stack's exclusions — dependencies, build output, coverage, Nx cache and workspace data, TypeScript build info, Expo state, the generated native `android/` and `ios/` directories of the Expo app, the ESLint cache, and `.worktrees/`.
