> **Discovery-phase draft — not authoritative.** Wherever this file conflicts with `docs/adr/` (ADR-0011 to ADR-0013 and the ADRs they supersede in part) or with the root `AGENTS.md`, those win. Its integration into the live documents is the backlog entry `integrate-the-context-draft` in `docs/backlog.md`.

# CLAUDE.md

Project context for Claude Code sessions. Detailed decisions live in `docs/`.

## What this is

**Basis** is a framework for building the regular habits that form the foundation of a person's life.
It automates tracking wherever possible and helps people perform important actions consistently
without excessive effort. Habits can belong to any life area: health, household, finances,
learning, creativity.

The first use cases are health habits: physical activity and sleep, credited automatically from
wearables (via Health Connect), and nutrition, with AI assessment of meal photos based on the
Harvard Healthy Eating Plate. A separate results module records long-term indicators (for health:
weight, body measurements, progress photos, lab results). Users can share their progress with
observers by invitation.

The architecture is multi-user from day one: pluggable data sources, habits as configuration
rather than code, and an area-agnostic evaluation core.

## Key product principles

1. **The system is hard to "fail".** `min / target / stretch` tiers, weekly rather than daily
   evaluation, "never miss twice" instead of streaks.
2. **Missing data is not failure.** The `no_data` status is neutral; `excused` is capped.
3. **Start from the real baseline.** A calibration period collects data without evaluation;
   habits are then enabled gradually.
4. **Automation over manual input.** Anything that can be credited from data is credited
   automatically; manual input is a first-class fallback source.
5. **AI evaluates the result, not the person.** Supportive tone; every AI assessment can be
   corrected manually.
6. **Quality over counting.** E.g., in nutrition we assess plate composition, not calories.
7. **Private by default.** Observers see habit adherence; sensitive data (including health
   indicators) is shared only selectively.
8. **Deterministic logic lives in code, not in the LLM.** LLMs are used only where content
   understanding is needed (photos, weekly reviews), and their suggestions are confirmed by a human.

## Stack

| Layer | Technology |
|---|---|
| Mobile (primary) | Expo (React Native + TypeScript), `react-native-health-connect`, dev build (not Expo Go) |
| Web (dashboard, settings, observers) | Vite + React + TypeScript, TanStack Router, TanStack Query, ECharts (`echarts-for-react`) |
| Backend | NestJS (TypeScript) modular monolith, LangGraph.js (`@langchain/langgraph`) |
| Data | PostgreSQL; Redis + BullMQ (`@nestjs/bullmq`) for queues |
| Files | Hetzner Object Storage (S3-compatible), uploads via presigned URLs |
| Infrastructure | Hetzner server, existing infrastructure repository |
| Monorepo | Nx on top of pnpm workspaces; module boundaries via `@nx/enforce-module-boundaries` |

## Architecture: pragmatic DDD

- **Modular monolith** split into bounded contexts (`docs/architecture/context-map.md`, ADR-0010):
  `habits` (core), `metrics`, `nutrition`, `results`, `sharing`, `stake`, `insights`,
  `identity`, `notifications`.
- **Full layering** (`domain / application / infrastructure / contracts`) only for `habits` and `stake`.
  Other contexts are plain Nest modules with a thin service layer.
- **Domain layer is pure TypeScript:** no Nest, ORM, HTTP, or implicit "now" (time is passed in).
- **Contexts communicate via domain events** (in-process Nest EventEmitter); async work via BullMQ.
- **Anti-corruption layers** for external systems: Health Connect (`metrics`), monobank (`stake`),
  AI provider (`nutrition`, `insights`).
- Not doing (for now): event sourcing, full CQRS, outbox, database-per-context.
  One Postgres, but each table belongs to exactly one context; no reading another context's tables.

## Monorepo structure (target)

```
apps/
  mobile/          # Expo
  web/             # Vite
  api/             # NestJS (composes context modules)
libs/
  habits/          # domain / application / infrastructure / contracts
  stake/           # domain / application / infrastructure / contracts
  metrics/         # domain / infrastructure (ACL) / contracts
  nutrition/       # domain / infrastructure (ACL) / contracts
  insights/        # application (graphs) / infrastructure / contracts
  results/ sharing/ identity/ notifications/   # feature / contracts
  shared/
    util/          # dates, time zones, units
    api-client/    # typed client + TanStack Query hooks
docs/
  product/         # vision, competitive analysis, PRD, domain model, roadmap, risks
  architecture/    # context map
  adr/             # Architecture Decision Records
openspec/          # changes following the OpenSpec process
```

## Module boundaries (Nx)

- Tags: `scope:<context>` and `type:domain | application | infrastructure | contracts | feature | util | data-access`.
- `domain` depends only on `domain` of the same context and `util`.
- A context never imports another context's `domain`/`application`/`infrastructure` — only its `contracts`.
- `infrastructure` is the only place for Nest, ORM, and external APIs.
- Full rule table: ADR-0005. Boundary violations are lint errors; do not bypass with `eslint-disable`.

## Development process

Every change goes through **OpenSpec**: research → design/specs → tests → implementation.
Documents in `docs/` are the top-level source of truth. If a change contradicts them, update
the document (or add a new ADR) first, then the code.

## Conventions

- Timestamps always carry a time zone; a user's day is computed in their local time zone.
- Sleep belongs to the day it **ended**. A day is "closed" the next morning (sync latency).
- Every entity has a `user_id`; no global settings tailored to a specific user.
- Metrics are normalized and source-agnostic (source adapters).
- "Domain" is used only in the DDD sense; health, finances, etc. are **life areas**.
- Secrets (bank tokens, API keys) are always encrypted and never logged.
- Code, comments, commit messages, and docs are written in English.

## Documents

- `docs/product/01-vision.md` — vision and principles
- `docs/product/02-competitive-analysis.md` — competitive analysis
- `docs/product/03-prd-mvp.md` — MVP requirements
- `docs/product/04-domain-model.md` — metrics, habit rules, evaluation
- `docs/product/05-roadmap.md` — phases
- `docs/product/06-risks-and-open-questions.md` — risks, privacy, open questions
- `docs/architecture/context-map.md` — bounded contexts and events
- `docs/adr/` — technical decisions