# Architecture Decision Records

| # | Decision | Status |
|---|---|---|
| 0001 | [Health Connect as the wearable data source](0001-health-connect-as-data-source.md) | accepted |
| 0002 | [Expo (React Native + TypeScript) for the mobile app](0002-expo-mobile.md) | accepted |
| 0003 | [Separate web app on Vite + TanStack Router/Query](0003-vite-web.md) | accepted |
| 0004 | [NestJS + LangGraph.js instead of FastAPI + LangGraph (Python)](0004-nestjs-langgraphjs.md) | accepted; superseded in part by ADR-0012 |
| 0005 | [Nx monorepo on top of pnpm workspaces](0005-nx-monorepo.md) | accepted; superseded in part by ADR-0012 |
| 0006 | [PostgreSQL, Redis/BullMQ, Hetzner Object Storage](0006-data-and-infra.md) | accepted |
| 0007 | [Habits as configuration; deterministic logic outside the LLM](0007-habits-as-config.md) | accepted |
| 0008 | [Stake module: virtual balance + monobank confirmation](0008-stake-module.md) | accepted |
| 0009 | [ECharts for web charts](0009-echarts.md) | accepted |
| 0010 | [Pragmatic DDD and a modular monolith](0010-ddd-modular-monolith.md) | accepted; superseded in part by ADR-0012 |
| 0011 | [Drizzle ORM for PostgreSQL](0011-drizzle-orm.md) | accepted |
| 0012 | [Context structure — ports and adapters, CQRS, Result](0012-context-structure.md) | accepted; supersedes in part ADR-0004, ADR-0005, ADR-0010 |
| 0013 | [Self-hosted Langfuse for LLM observability](0013-langfuse-llm-observability.md) | accepted |

A new decision is a new `NNNN-slug.md` file following the same template. A changed decision is a new ADR with the status "supersedes ADR-NNNN".
