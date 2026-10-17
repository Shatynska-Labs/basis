# Context Map

**Status:** draft v0.1 · **Date:** 2026-10-17 · Decisions: ADR-0010, ADR-0012.

## Contexts

| Context         | Type       | Responsibility                                                                              | Key concepts                                                                                | `domain` layer; ACL                                                        |
| --------------- | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `habits`        | core       | habit rules, daily and weekly evaluation, "never miss twice", calibration, goal progression | `HabitRule`, `DayEvaluation`, `WeekEvaluation`, `Tier`, `HabitStatus`, `GoalChangeProposal` | yes                                                                        |
| `metrics`       | supporting | ingestion and normalization of source data; idempotency                                     | `MetricRecord`, `Source`, `SourceStatus`                                                    | yes; ACL to Health Connect (driving)                                       |
| `nutrition`     | supporting | meals, slots, plate assessment, manual correction                                           | `Meal`, `MealSlot`, `PlateAssessment`                                                       | yes; ACL to the AI provider (driven; the LangGraph.js graph behind a port) |
| `results`       | supporting | weight (trend), measurements, progress photos, lab results                                  | `WeightEntry`, `Measurement`, `ProgressPhoto`, `LabResult`                                  | no                                                                         |
| `sharing`       | supporting | invitations, access, roles, reactions                                                       | `Share`, `Invitation`, `Scope`, `Role`, `Reaction`                                          | no                                                                         |
| `stake`         | supporting | virtual balance, buffer, settlements, confirmation                                          | `StakeLedgerEntry`, `Settlement`, `Buffer`, `StakeSettings`                                 | yes; ACL to monobank (webhook driving, API driven)                         |
| `insights`      | supporting | weekly reviews, change suggestions (LangGraph)                                              | `WeeklyReview`, `Suggestion`                                                                | no; ACL to the AI provider (driven; the LangGraph.js graph behind a port)  |
| `identity`      | generic    | authentication, profile, time zone, heart-rate zones                                        | `User`, `Profile`                                                                           | no                                                                         |
| `notifications` | generic    | push and reminders                                                                          | `Notification`, `ReminderRule`                                                              | no                                                                         |

## Relationships

```
Health Connect ──ACL──▶ metrics ──MetricRecorded──▶ habits ◀── nutrition (MealAssessed)
                                                      │
                          DayClosed / WeekClosed / HabitMissedTwice
                                                      │
                ┌──────────────┬──────────────┬───────┴──────┬──────────────┐
                ▼              ▼              ▼              ▼              ▼
              stake        insights        sharing     notifications     results
                │              │                                       (independent,
   monobank ──ACL┘              └── GoalChangeProposed ──▶ habits        reads profile)
```

- `habits` knows nothing about `stake`, `insights`, or `sharing` — they subscribe to its events.
- `nutrition` notifies `habits` about assessed meals; `habits` treats them as the `meal` metric.
- `insights` only **proposes** a goal change; `habits` applies it after the user confirms.
- `sharing` reads other contexts' aggregates through their public queries (contracts), never their tables.

## Integration events (initial set)

These are integration events (ADR-0012 §3): defined in the publishing context's `contracts`, published on the `EventBus` after commit. Domain events raised inside a context are not listed here and never leave it.

| Event                           | Published by | Consumers                               | Payload                                 |
| ------------------------------- | ------------ | --------------------------------------- | --------------------------------------- |
| `MetricRecorded`                | metrics      | habits                                  | userId, metric, interval, source        |
| `SourceStatusChanged`           | metrics      | habits, notifications                   | userId, source, status                  |
| `MealAssessed`                  | nutrition    | habits, notifications                   | userId, mealId, slot, score             |
| `AssessmentCorrected`           | nutrition    | habits                                  | userId, mealId, newScore                |
| `DayEvaluated`                  | habits       | notifications                           | userId, date, provisional statuses      |
| `DayClosed`                     | habits       | stake, sharing, notifications           | userId, date, final statuses            |
| `HabitMissedTwice`              | habits       | notifications, sharing                  | userId, habitId, dates                  |
| `WeekClosed`                    | habits       | stake, insights, sharing, notifications | userId, week, goal summary              |
| `GoalChangeProposed`            | insights     | habits, notifications                   | userId, habitId, proposal               |
| `GoalChanged`                   | habits       | stake, insights                         | userId, habitId, old/new, effectiveFrom |
| `SettlementDue`                 | stake        | notifications                           | userId, week, amount                    |
| `SettlementConfirmed`           | stake        | sharing, notifications                  | userId, week, by (mono / manual)        |
| `ShareGranted` / `ShareRevoked` | sharing      | notifications                           | ownerId, viewer, scopes                 |

Events are named in the past tense and carry only identifiers and minimal data; consumers fetch
full data through the owning context's public query.

## Nx structure

Every context has the same shape (ADR-0012 §1): `application`, `infrastructure` (with `driving/` and `driven/` folders) and `contracts`, plus `domain` where the table above says so.

```
libs/
  habits/
    domain/          scope:habits  type:domain          # pure TS
    application/     scope:habits  type:application     # commands/, queries/, ports
    infrastructure/  scope:habits  type:infrastructure  # driving/, driven/
    contracts/       scope:habits  type:contracts       # events, query interfaces, Zod DTOs
  stake/  metrics/  nutrition/                          # same four libraries
  insights/  results/  sharing/  identity/  notifications/   # application + infrastructure + contracts
  shared/
    core/            scope:shared  type:core            # Result and other language-level additions
    domain/          scope:shared  type:domain          # Entity, AggregateRoot, ValueObject, DomainError, Rule
    util/            scope:shared  type:util            # dates, time zones, units
    api-client/      scope:shared  type:data-access     # typed client + TanStack Query hooks
```

Dependency rules and external-import constraints — ADR-0012 §7.
