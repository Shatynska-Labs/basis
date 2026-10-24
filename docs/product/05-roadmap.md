# 05. Roadmap

**Status:** draft v0.3 · **Date:** 2026-10-17

Phases are indicative; each feature within a phase is implemented as a separate OpenSpec change.

## Phase 0 — Data source validation

- Receive Health Connect data via an existing bridge (HC Webhook) on a temporary endpoint.
- Determine which data is actually available from the reference device (Galaxy Watch via Samsung Health):
  sleep stages, heart rate, workout sessions (strength detection), sync latency.
- Verify background sync under aggressive battery optimization.
- **Outcome:** ADR-0001 confirmed or adjusted; list of metrics available for automation.

The remaining work and its order: [`validate-the-data-source`](../workstreams/validate-the-data-source.md).

## Phase 1 — Foundation

- Nx monorepo (pnpm workspaces), `shared` libraries, module boundary rules, CI with `nx affected`.
- NestJS modular monolith skeleton; `identity` (auth, profile: time zone, heart-rate zone parameters);
  `metrics` with idempotent ingestion and the Health Connect ACL.
- Expo dev build: reading Health Connect, background sync.
- Deployment on Hetzner (Postgres, Redis, Object Storage).
- **Outcome:** device data reaches the server; the calibration period starts.

The remaining work and its order: [`reach-the-calibration-period`](../workstreams/reach-the-calibration-period.md).

## Phase 2 — Habits core

- `habits` domain: metrics → daily statuses → week → "never miss twice"; domain events.
- Health starter template; gradual enablement; `excused`.
- Mobile: "Today" and "Week" screens, data source status, manual check-offs.
- Web: rule settings, history.

## Phase 3 — Nutrition

- Camera, uploads via presigned URLs, slot detection by time.
- `nutrition` context: BullMQ queue + LangGraph graph for plate assessment; manual correction.
- Meal push reminders.

## Phase 4 — Results and observers

- `results`: weight (trend), measurements, progress photos, lab results (manual entry), resting heart rate.
- Web trend dashboard (ECharts).
- `sharing`: invitations, granular permissions, observer page, reactions.

## Phase 5 — Weekly review

- `insights`: LangGraph graph producing a weekly summary + one goal-change suggestion confirmed by the user.
- **MVP complete**, followed by a period of use and adjustment.

## Post-MVP

1. **Stake** — virtual balance, buffer, weekly settlement, monobank webhook confirmation.
2. Post-meal reflection (if not included in MVP).
3. Correlations in the weekly review.
4. Doctor report export.
5. Coach role.

## Product expansion

- Onboarding for new users, habit template library, custom rule builder.
- Habits outside the health area (household, finances, learning, creativity) with manual and
  integration-based data sources.
- Build distribution via EAS.
- Group challenges.
- iOS / Apple Health.
- Full privacy package: consents, export, deletion, privacy policy.
