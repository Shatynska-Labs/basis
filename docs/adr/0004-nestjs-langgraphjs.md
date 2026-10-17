# ADR-0004: NestJS + LangGraph.js instead of FastAPI + LangGraph (Python)

**Status:** accepted; superseded in part by ADR-0012 · **Date:** 2026-10-17

> ADR-0012 §4 fixes the version (NestJS 12) and where Nest decorators may appear.

## Context

FastAPI was initially considered. The entire frontend is TypeScript; the AI part is modest (a vision call with structured output, a multi-step weekly review); the team has NestJS experience.

## Decision

Backend on **NestJS** as a modular monolith (ADR-0010); AI workflows on **LangGraph.js** (`@langchain/langgraph`) inside the `nutrition` and `insights` contexts.

## Alternatives considered

- FastAPI + LangGraph (Python) — better for heavy analytics/ML, but a second language and cross-language client generation.

## Consequences

+ One language across the monorepo; Zod schemas and habit rules shared by backend, web, and mobile.
+ A familiar framework.
− Some LangGraph features sometimes land in Python first.
− Serious statistics/ML in the future — a separate Python service if needed.
