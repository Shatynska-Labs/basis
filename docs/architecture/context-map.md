# Context Map

**Status:** draft v0.1 · **Date:** 2026-10-17 · Decision: ADR-0010.

## Contexts

| Context | Type | Responsibility | Key concepts | Layering |
|---|---|---|---|---|
| `habits` | core | habit rules, daily and weekly evaluation, "never miss twice", calibration, goal progression | `HabitRule`, `DayEvaluation`, `WeekEvaluation`, `Tier`, `HabitStatus`, `GoalChangeProposal` | full |
| `metrics` | supporting | ingestion and normalization of source data; idempotency | `MetricRecord`, `Source`, `SourceStatus` | moderate; ACL to Health Connect |
| `nutrition` | supporting | meals, slots, plate assessment, manual correction | `Meal`, `MealSlot`, `PlateAssessment` | moderate; ACL to the AI provider |
| `results` | supporting | weight (trend), measurements, progress photos, lab results | `WeightEntry`, `Measurement`, `ProgressPhoto`, `LabResult` | simple module |
| `sharing` | supporting | invitations, access, roles, reactions | `Share`, `Invitation`, `Scope`, `Role`, `Reaction` | simple module |
| `stake` | supporting | virtual balance, buffer, settlements, confirmation | `StakeLedgerEntry`, `Settlement`, `Buffer`, `StakeSettings` | full; ACL to monobank |
| `insights` | supporting | weekly reviews, change suggestions (LangGraph) | `WeeklyReview`, `Suggestion` | moderate; ACL to the AI provider |
| `identity` | generic | authentication, profile, time zone, heart-rate zones | `User`, `Profile` | simple module |
| `notifications` | generic | push and reminders | `Notification`, `ReminderRule` | simple module |

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

## Domain events (initial set)

| Event | Published by | Consumers | Payload |
|---|---|---|---|
| `MetricRecorded` | metrics | habits | userId, metric, interval, source |
| `SourceStatusChanged` | metrics | habits, notifications | userId, source, status |
| `MealAssessed` | nutrition | habits, notifications | userId, mealId, slot, score |
| `AssessmentCorrected` | nutrition | habits | userId, mealId, newScore |
| `DayEvaluated` | habits | notifications | userId, date, provisional statuses |
| `DayClosed` | habits | stake, sharing, notifications | userId, date, final statuses |
| `HabitMissedTwice` | habits | notifications, sharing | userId, habitId, dates |
| `WeekClosed` | habits | stake, insights, sharing, notifications | userId, week, goal summary |
| `GoalChangeProposed` | insights | habits, notifications | userId, habitId, proposal |
| `GoalChanged` | habits | stake, insights | userId, habitId, old/new, effectiveFrom |
| `SettlementDue` | stake | notifications | userId, week, amount |
| `SettlementConfirmed` | stake | sharing, notifications | userId, week, by (mono / manual) |
| `ShareGranted` / `ShareRevoked` | sharing | notifications | ownerId, viewer, scopes |

Events are named in the past tense and carry only identifiers and minimal data; consumers fetch
full data through the owning context's public query.

## Nx structure

```
libs/
  habits/
    domain/          scope:habits  type:domain          # pure TS
    application/     scope:habits  type:application     # use cases, ports
    infrastructure/  scope:habits  type:infrastructure  # Nest, ORM, adapters
    contracts/       scope:habits  type:contracts       # events, DTOs, Zod
  stake/             # same split
  metrics/           # domain + infrastructure (ACL) + contracts
  nutrition/         # domain + infrastructure (ACL) + contracts
  insights/          # application (graphs) + infrastructure + contracts
  results/  sharing/  identity/  notifications/   # feature + contracts
  shared/
    util/            scope:shared  type:util
    api-client/      scope:shared  type:data-access
```

Dependency rules — ADR-0005.
