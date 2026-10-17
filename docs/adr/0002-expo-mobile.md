# ADR-0002: Expo (React Native + TypeScript) for the mobile app

**Status:** accepted · **Date:** 2026-10-17

## Context

The mobile app is the primary interface (camera, weight, day status) and must read Health Connect natively. A PWA has no access to Health Connect.

## Decision

**Expo** with a custom dev build (not Expo Go), `react-native-health-connect` (Expo integration built in since v4). Builds distributed via EAS.

## Alternatives considered

- Flutter (`health`) — comparable, but Dart is outside the team's main stack, and Flutter Web is weak for a dashboard.
- Native Kotlin — best Health Connect support, but Android only.
- PWA — no Health Connect access.

## Consequences

- Familiar stack (React, TS), one language with web and backend.
- A path to iOS via `@kingstinct/react-native-healthkit` without a rewrite.
  − Native modules require a dev build and prebuild.
