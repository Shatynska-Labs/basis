# 04. Domain Model: Metrics, Habits, Evaluation

**Status:** draft v0.2 · **Date:** 2026-10-17

The model has layers: **metrics → habit rules → daily evaluation → week and progression**,
plus separate areas for **results**, **observers**, and **Stake**. Mapping to bounded
contexts — `docs/architecture/context-map.md`.

## 1. Metrics (normalized data) — `metrics` context

A habit never talks to a data source directly — only to a metric. Each source
(Health Connect, manual input, later Apple Health) has an adapter into the normalized form.

| Metric | Meaning | Sources |
|---|---|---|
| `steps` | steps over an interval | Health Connect |
| `hr_zone_minutes` | minutes in a heart-rate zone (zones derived from max HR in the profile) | Health Connect (heart rate) |
| `workout` | session: type, start, end, duration | Health Connect, manual |
| `sleep` | session: sleep onset, wake-up, duration (asleep stages only, if available) | Health Connect |
| `meal` | meal: time, photo, slot, plate score | app (`nutrition` context) |
| `resting_hr` | resting heart rate | Health Connect |
| `body` | weight, measurements | manual (later smart scales) |
| `lab_result` | lab indicator | manual |

Generic metric record:

```ts
type MetricRecord = {
  userId: string;
  metric: MetricType;
  start: string;           // ISO with time zone
  end?: string;
  value?: number;
  payload?: Record<string, unknown>; // workout type, sleep stages, etc.
  source: 'health_connect' | 'manual' | 'app' | string;
  sourceRecordId?: string; // for idempotency
};
```

Consistency with Health Connect: steps are the daily total as Health Connect computes it
(de-duplicated across phone and wearable); sleep counts only asleep stages when the device records them.

## 2. Habit rule — `habits` context

A habit is configuration, not code. A template is a set of rules the user can modify.

```ts
type HabitRule = {
  id: string;
  title: string;
  metric: MetricType;
  filter?: { zoneMin?: number; workoutTypes?: string[]; mealSlot?: string };
  window?: { from: string; to: string };   // local time, e.g. '05:00'–'10:00'
  aggregate: 'sum' | 'max' | 'count' | 'duration' | 'time_of';
  tiers: { min: number; target: number; stretch?: number };
  direction?: 'higher_is_better' | 'within_range' | 'earlier_is_better';
  weeklyGoal: { level: 'min' | 'target'; days: number }; // e.g. target 5/7
  enabledFrom?: string;    // enablement date (gradual start)
  manualAllowed: boolean;
};
```

### Health starter template (values are assumptions until calibration)

| Habit | Metric and window | Minimum | Target | Week |
|---|---|---|---|---|
| Steps | `steps`, whole day | from calibration | 10,000 | target 5/7 |
| Morning intensity | `hr_zone_minutes` zone 3+, 05:00–10:00 | 5 min | 10 min | target 4/7 |
| Evening strength | `workout` type strength, 17:00–23:00 | 5 min | 10 min | target 4/7 |
| Sleep duration | `sleep`, duration | 6 h | 7 h | target 5/7 |
| Sleep schedule | `sleep`, onset time | before 00:00 | 22:30–23:30 | target 5/7 |
| Regular meals | `meal` within windows: breakfast by 08:00, lunch by 14:00, dinner by 20:00 | 2 on time | 3 on time | target 5/7 |
| Healthy plate | `meal` with score ≥ 3/4 | 1 | 2 | target 4/7 |

## 3. Daily evaluation

### Habit status per day

| Status | Meaning |
|---|---|
| `stretch` | ≥ stretch tier |
| `target` | ≥ target |
| `min` | ≥ minimum — "held the line" |
| `miss` | data present, minimum not reached |
| `no_data` | no data — neutral, counts neither for nor against |
| `excused` | illness / travel / holiday; capped, e.g. 3 per month |
| `calibration` | calibration period, no evaluation |

### Day boundaries
- Sleep belongs to the day it **ended**.
- A day is "closed" the next morning (e.g., 10:00 local time) to account for sync latency.
  Until then the status is provisional.
- After closing, the status is recalculated if late data arrives (and flagged as such).

### Day summary (human language)
- all active habits ≥ `min` → "held the line";
- most ≥ `target` → "strong day";
- otherwise → "today happened, tomorrow is new".

## 4. Week and progression

- **The primary unit is the week** (Mon–Sun, in the user's time zone). For each habit: progress toward `weeklyGoal`.
- `no_data` and `excused` days reduce the denominator rather than counting as failures.
- **Never miss twice:** per habit; two `miss` in a row → gentle nudge + prompt to return at least to the minimum.
- **Goal progression** (suggested by the system, approved by the user):
  - goal met on ≥ 80% of days over 2 weeks → suggest ~+10%;
  - < 40% → suggest temporarily lowering it;
  - no more than **one** suggestion per week.
- **Gradual habit enablement** (example):
  - weeks 1–2 — calibration only;
  - week 3 — steps, sleep;
  - week 5 — nutrition;
  - week 7 — morning intensity and evening strength.

## 5. Plate assessment (AI) — `nutrition` context

Components (0/1 each, total 0–4, plus drink separately):

| Component | Criterion |
|---|---|
| Vegetables/fruit | ≈ half the plate, mostly vegetables |
| Protein | a healthy protein source (fish, poultry, legumes, eggs) |
| Whole grains | whole grains instead of refined |
| Fats | healthy oils, minimal ultra-processed food |
| Drink (separate) | water / tea / coffee without sugar |

AI output (structured):

```ts
type PlateAssessment = {
  components: { vegetables: 0|1; protein: 0|1; wholeGrains: 0|1; fats: 0|1; drink?: 0|1|null };
  score: number;             // 0–4
  confidence: 'low' | 'medium' | 'high';
  good: string;              // what's good
  improve?: string;          // what to watch
  tip?: string;              // one realistic tip, only when relevant
  notFood?: boolean;
};
```

Tone rules: comment on the plate, not the person; no "bad" or "harmful"; manual correction is
always available and takes precedence. The meal slot is derived from the photo time
(EXIF / upload time) but is editable.

## 6. Stake module (post-MVP) — `stake` context

Material incentives without the server ever touching money.

- **Virtual balance:** credits for meeting weekly goals; optional penalty only for "missed twice"
  or a failed weekly goal, with a weekly cap.
- `no_data` and `excused` **never** affect money.
- Nutrition habits are excluded from the stake or carry minimal weight (so food doesn't become a source of anxiety).
- **Weekly settlement:** on Sunday the amount to transfer is shown; the user makes the transfer.
- **Confirmation via monobank:** the personal API webhook reports the transaction to the "Reward"
  jar → the week is marked "settled". For other banks — manual confirmation.
- **Settings:** mode (reward only / with penalties), amounts, cap, penalty destination (e.g., a donation),
  what the jar is spent on (not food), optional referee-observer.
- **Mechanics adopted from the competitive analysis** (see `02-competitive-analysis.md`):
  - safety buffer: a week with a margin earns a day that covers a future miss without penalty;
  - 7-day change horizon: easing (lower goal, smaller stake, disabling penalties) takes effect after a week; tightening applies immediately;
  - the referee has the final say on disputed manual check-offs;
  - lottery reward as an alternative to a fixed amount;
  - planned stake fade-out once a habit has been stable for several weeks.
- Stakes are on **behavior** (weekly goals) only, never on outcomes (weight).
- Decision details — ADR-0008.

```ts
type StakeLedgerEntry = {
  userId: string;
  week: string;              // ISO week
  kind: 'reward' | 'penalty' | 'buffer' | 'settlement';
  amount: number;            // UAH, minor units
  reason: string;            // reference to habit/week
  settledBy?: 'mono_webhook' | 'manual';
  externalTxId?: string;
};
```

## 7. Results — `results` context

- **Weight:** raw points + 7-day moving average; the trend is the primary visual.
- **Measurements:** a set of fields (waist, hips, chest, arm, etc.), every 2–4 weeks.
- **Progress photos:** monthly; private by default; hint to keep the same angle and lighting.
- **Health indicators:** `lab_result` (indicator, value, unit, reference range, date, lab) +
  `resting_hr`; a trend chart per indicator.

## 8. Observers and access — `sharing` context

```ts
type Share = {
  ownerId: string;
  viewer: { userId?: string; inviteToken?: string };
  scopes: Array<'habits_weekly' | 'habits_daily' | 'meals' | 'weight' | 'measurements'
              | 'progress_photos' | 'labs' | 'stake'>;
  role: 'observer' | 'coach' | 'referee';
  createdAt: string; revokedAt?: string;
};
```

- Default: `habits_weekly`.
- Observers can leave reactions and comments.
- Revocation is immediate.

## 9. Glossary (ubiquitous language)

| Term | Meaning |
|---|---|
| Calibration | data collection period without evaluation, used to set thresholds |
| Tiers | `min / target / stretch` |
| Weekly goal | "tier X on N days out of 7" |
| Held the line | a day where all active habits are ≥ `min` |
| Never miss twice | rule: two consecutive misses trigger a nudge |
| Life area | a sphere of habits (health, household, finances, ...); not a DDD "domain" |
| Stake | the material incentive module |
| Buffer | spare days earned by exceeding a weekly goal |
| Referee | an observer with the final say on disputed check-offs in Stake |
