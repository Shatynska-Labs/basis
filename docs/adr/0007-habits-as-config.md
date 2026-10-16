# ADR-0007: Habits as configuration; deterministic logic outside the LLM

**Status:** accepted · **Date:** 2026-10-17

## Context

The product must support different users with different habit sets and, later, life areas beyond health. Status calculation must be predictable, testable, and explainable.

## Decision

A habit is a `HabitRule` record (metric, filter, window, aggregation, tiers, weekly goal) defined by a shared Zod schema in `libs/habits/contracts`. The rule engine is pure, deterministic code in `libs/habits/domain` with unit tests. LLMs are used only for plate assessment and weekly reviews; their suggestions always require human confirmation.

## Alternatives considered

- Habits as code (a function per habit) — doesn't scale to other users.
- Daily evaluation via LLM — unpredictable, expensive, untestable.

## Consequences

+ Habit templates and new life areas without changing the core.
+ Every status can be expanded down to its source data.
− The rule schema must be expressive enough (windows, direction, ranges) — design carefully in OpenSpec.
