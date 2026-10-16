# 03. PRD — MVP

**Status:** draft v0.2 · **Date:** 2026-10-17
**MVP goal:** a working product core in the health life area, suitable for daily use for at least
3 months. The architecture is multi-user; public onboarding is out of MVP scope.

## Personas

| Persona | Description | What matters in MVP |
|---|---|---|
| **User** | Android smartphone and a wearable that writes to Health Connect; uses both mobile and desktop | Mobile: photos, weight, day status. Web: trends, settings |
| **Observer** | A person invited by the user | A web page via link, no app installation |

## User stories

### Device data
- **US-1.** As a user, I want steps, heart-rate zones, workouts, and sleep to flow in automatically from Health Connect, so I don't enter anything manually.
- **US-2.** As a user, I want to log a workout manually if the wearable didn't record it.
- **US-3.** As a user, I want to see a data source status next to each habit (synced / permission missing / not synced recently / manual).

### Habits and evaluation
- **US-4.** As a user, I want the first 1–2 weeks to be a calibration period that only collects data, without evaluation.
- **US-5.** As a user, I want to see each habit's daily status (`stretch/target/min/miss/no_data/excused`).
- **US-6.** As a user, I want to see the week: "4 of 5 days at target" for each habit.
- **US-7.** As a user, I want a gentle nudge when I'm about to miss a habit for the second day in a row.
- **US-8.** As a user, I want to mark a day as `excused` (illness, travel) — no more than N times per month.
- **US-9.** As a user, I want to enable habits gradually.
- **US-10.** As a user, I want to configure habit thresholds and windows on the web.

### Nutrition
- **US-11.** As a user, I want to photograph my meal and have the meal time detected automatically.
- **US-12.** As a user, I want a component-based plate score (0–4) with a short explanation: what's good, what to improve, one tip.
- **US-13.** As a user, I want to correct the AI's assessment if it's wrong.
- **US-14.** *(candidate)* As a user, I want to optionally answer "why did I eat?".

### Weekly review
- **US-15.** As a user, I want a weekly AI review: a summary, what went well, and **one** suggested goal change (raise/lower) that I accept or reject.

### Results
- **US-16.** As a user, I want to log my weight quickly from my phone and see the trend (7-day moving average).
- **US-17.** As a user, I want to record body measurements (waist, hips, etc.) every 2–4 weeks.
- **US-18.** As a user, I want to store progress photos (monthly) privately.
- **US-19.** As a user, I want to enter lab results manually (indicator, value, unit, reference range, date) and see their trends.
- **US-20.** As a user, I want to see resting heart rate from my wearable as a trend.

### Observers
- **US-21.** As a user, I want to invite an observer via a link and choose what they see (habit adherence by default).
- **US-22.** As an observer, I want to see the user's week and leave a reaction/comment.
- **US-23.** As a user, I want to revoke access at any time.

### Reminders
- **US-24.** As a user, I want push reminders: a meal without a photo, "N more steps to minimum", weigh-in. The number of reminders is configurable.

## Scope

### In MVP
- Mobile app (Android): background Health Connect sync, camera, weight, measurements, day/week status, push;
- Web: trend dashboard, history, habit settings, lab results, observer management, observer page;
- Backend: `metrics`, `habits`, `nutrition`, `results`, `sharing`, `insights`, `identity`, `notifications` contexts;
- 7 starter habits (see `04-domain-model.md`) as a health template;
- Authentication (email magic link or Google OAuth — to be decided in OpenSpec).

### Out of MVP
- Stake module (right after MVP; see `04-domain-model.md` §6, ADR-0008);
- coach role;
- correlations in the weekly review;
- doctor report;
- public onboarding, template library, group challenges;
- habits outside the health area;
- iOS / Apple Health;
- lab-result OCR;
- calorie counting — **never**.

## Non-functional requirements

- **Privacy:** body photos and documents encrypted at the storage level; explicit consent before sending meal photos to an external AI API; full account deletion.
- **Time zones:** all calculations in the user's time zone.
- **Sync reliability:** idempotent ingestion (resending the same records does not duplicate data).
- **Performance:** photo assessment is asynchronous; the user never waits for the AI.
- **Explainability:** any day status can be "expanded" to show the data it was derived from.

## Success metrics

| Metric | Target |
|---|---|
| Daily usage | ≥ 80% of days over 3 months |
| Weeks with most weekly goals met | ≥ 60% |
| `no_data` days caused by sync failures | ≤ 5% |
| Share of plate scores corrected manually | track it; > 30% signals the prompt needs work |
| Long-term indicator trend (e.g., weight) | moving in the desired direction |
