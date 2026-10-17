# ADR-0001: Health Connect as the wearable data source

**Status:** accepted · **Date:** 2026-10-17

## Context

Steps, heart rate, workouts, and sleep must be obtained automatically from wearables; the reference device is a Galaxy Watch. Samsung Health has no public cloud API. The Samsung Health Data SDK requires a Samsung partnership to distribute an app; without approval it works only in developer mode.

## Decision

Read data from **Health Connect** on Android. Samsung Health syncs its data there (a toggle in Samsung Health settings). In Phase 0, use an existing bridge (HC Webhook, open source) to validate the data; afterwards, our own Expo client with `react-native-health-connect` and background sync. Health Connect access lives behind an anti-corruption layer in the `metrics` context.

## Alternatives considered

- Samsung Health Data SDK directly — requires a partnership, ties the product to one brand.
- Built-in Health Connect export (ZIP to cloud storage) — too slow for daily tracking.
- Aggregators (Terra, Sahha, Junction) — paid and unnecessary complexity.

## Consequences

- Independence from the wearable brand (Pixel Watch and others that write to Health Connect).
- No Samsung partnership needed.
  − Background reads require a separate permission; Samsung battery optimization may throttle sync.
  − The data set is limited to what Samsung writes to Health Connect (validate in Phase 0).
