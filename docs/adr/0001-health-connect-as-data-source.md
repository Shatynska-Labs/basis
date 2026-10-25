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

## Phase 0 findings

**Confirmed** on 2026-10-25 (`record-phase-0-findings`). HC Webhook closed whenever its type list was edited, so heart rate, sleep and exercise never reached the temporary intake; the findings come instead from the operator's inspection of Health Connect's own data view (Data and access, and each type's entries) on the reference device, covering about one week of data.

| Domain-model metric (§1) | Health Connect type | Observed                                                                                     | Writer         |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------- | -------------- |
| `steps`                  | Steps               | present                                                                                      | —              |
| `hr_zone_minutes`        | Heart rate          | present; sample density not inspected                                                        | —              |
| `workout`                | Exercise            | present: 3 sessions in a week (2 walking, 1 running), each with exercise type, start and end | Samsung Health |
| `sleep`                  | Sleep               | present, with stages (light, deep, …; the full set not noted)                                | —              |
| `resting_hr`             | Resting heart rate  | not inspected                                                                                | —              |

A dash means the writer was not noted. An exercise session carries no heart rate: `hr_zone_minutes` is computed from the heart-rate records overlapping the interval.

**Unverified**, owed by `sync-health-connect-from-the-mobile-app`'s verification on the reference device: whether strength workouts are detected automatically or only when started on the watch (open question 2); heart-rate sample density outside workouts; resting heart rate; the writing app and device (phone or watch) per type; the full set of sleep stages; record shapes (samples or aggregates); resend behaviour; and sync latency.
