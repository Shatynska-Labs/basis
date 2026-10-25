## Context

The backlog entry planned to read `GET /health-connect/deliveries/summary` on production after several days of HC Webhook deliveries. On staging, heart rate, sleep and exercise never arrived because HC Webhook closes while its type list is edited, and the operator could not enable every type. Rather than debug the bridge, the operator inspected Health Connect itself on the reference device (Health Connect → Data and access, and each type's entries) on 2026-10-25.

What the operator observed:

| Domain-model metric (§1) | Health Connect type | Observed                                                                                     | Writer         |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------- | -------------- |
| `steps`                  | Steps               | present                                                                                      | —              |
| `hr_zone_minutes`        | Heart rate          | present; sample density not inspected                                                        | —              |
| `workout`                | Exercise            | present: 3 sessions in a week (2 walking, 1 running), each with exercise type, start and end | Samsung Health |
| `sleep`                  | Sleep               | present, with stages (light, deep, …; the full set not noted)                                | —              |
| `resting_hr`             | Resting heart rate  | not inspected                                                                                | —              |

A dash means the writer was not noted.

## Goals / Non-Goals

**Goals:**

- Record what Health Connect provides from the reference device, with the source and date of the observation, and what it leaves unverified.
- Confirm ADR-0001 and close `validate-the-data-source`.

**Non-Goals:**

- Fixing or replacing HC Webhook, or waiting for days of intake data.
- Answering open question 2 now (operator, 2026-10-25: no time or opportunity for a strength-workout test).
- Removing the temporary intake (`retire-the-health-connect-intake`), or deciding whether a third-party bridge stays a source (`reach-the-calibration-period`'s open question).
- Background sync under battery optimization (R2), already left to `sync-health-connect-from-the-mobile-app`.

## Decisions

**1. The findings come from Health Connect's own data view, not the intake.** It shows what is stored in Health Connect, which is exactly what Basis's client will read, whereas the intake shows only what one bridge forwarded. It cannot show sync latency, record shapes (samples or aggregates) or resend behaviour; those are recorded as unverified and given an owner in decision 4. Alternative: fix HC Webhook and wait several days — rejected by the operator as time spent on a throwaway tool.

**2. ADR-0001 is confirmed, not adjusted.** Steps, heart rate, exercise sessions and sleep with stages all reach Health Connect, so Health Connect covers the automated metrics. Only Exercise was seen to be written by Samsung Health; which app and device (phone or watch) writes each other type was not noted and is recorded as unverified, since `steps` is de-duplicated across phone and wearable (domain model §1). The ADR gains a **Phase 0 findings** section holding the table above, the unverified points and the date; its Decision and Status are unchanged. A separate findings document was considered and rejected: the ADR's own Consequences line ("validate in Phase 0") is where a reader looks for the result.

**3. Heart-rate zones rest on separate heart-rate samples.** A Health Connect exercise session carries type, start and end but no heart rate; `hr_zone_minutes` is computed from heart-rate records overlapping the interval. Whether Samsung writes samples often enough outside workouts is unverified and is a question for the client's first read.

**4. Open question 2 and the other unverified points move to `sync-health-connect-from-the-mobile-app`.** That step is already verified by hand on the reference device and makes the client's first read, so it checks: the strength-workout test (one session not started on the watch, one started as strength training); heart-rate sample density; resting heart rate; the writing app and device per type; the full set of sleep stages; record shapes (samples or aggregates); resend behaviour; and latency. They are written into `reach-the-calibration-period`'s Open questions, beside open question 3, and against open question 2 in `06-risks-and-open-questions.md`.

**5. `validate-the-data-source`'s Done when drops open question 2.** Its Done when required both open questions; the operator deferred one, so the condition is revised to "confirms or adjusts ADR-0001 and answers open question 1". With this change archived, every step is archived and the revised condition holds, so the workstream file moves to `docs/workstreams/archive/<date>-validate-the-data-source.md` in the archive commit.

**6. R1 stays at Medium likelihood, with its mitigation revised.** The needed types are present, but two things it names are still unverified: strength-workout detection and heart-rate sample density outside workouts, which `hr_zone_minutes` rests on. The mitigation becomes: Phase 0 confirmed the types exist (ADR-0001's findings); strength and heart-rate-zone habits wait on `sync-health-connect-from-the-mobile-app`'s verification; manual workouts remain a first-class source.

## Risks / Trade-offs

- [The observation is a single look at one week of data] → recorded with its date and scope; the client's first read on the reference device re-checks it.
- [Strength workouts may only be recorded when started by hand] → manual input is already a source of `workout` (domain model §1); a habit rule depending on strength detection waits on open question 2.

## Migration Plan

None. Documentation only. **Promote** is waived at archive: nothing reaches production.
