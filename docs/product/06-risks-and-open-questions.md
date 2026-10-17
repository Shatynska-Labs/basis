# 06. Risks, Privacy, Open Questions

**Status:** draft v0.2 · **Date:** 2026-10-17

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Health Connect does not provide the needed wearable data (strength workouts, HR zones, sleep stages) | Medium | High | Phase 0 prototype via HC Webhook before main development; manual input as a first-class source |
| R2 | Background sync throttled by Samsung battery optimization | High | Medium | Battery optimization exemption in onboarding; sync on app open; "not synced recently" status |
| R3 | AI misjudges plates | High | Medium | Component-based scoring, `confidence` field, manual correction, tracking the correction rate |
| R4 | The system becomes too rigid → the user quits | Medium | High | Tiers, weekly evaluation, `no_data`, `excused`, gradual enablement, one goal change per week |
| R5 | The money stake creates stress around food | Medium | High | Weekly settlement, penalty cap, nutrition habits excluded from stakes, "reward only" mode |
| R6 | Leak of sensitive health data | Low | Very high | Encryption, minimal data sent to external APIs, granular access, audit log of observer access |
| R7 | Scope creep | High | Medium | Hard MVP boundaries in the PRD; everything new goes through OpenSpec and the roadmap |
| R8 | Intense-activity habits harm the user's health | Low | High | Doctor consultation recommended in onboarding; goals by heart-rate zones; no medical advice |
| R9 | Bounded-context boundaries erode ("just this one import") | Medium | Medium | Nx boundary lint rules in CI; events instead of direct calls (ADR-0005, ADR-0010) |

## Lightweight privacy assessment (DPIA-lite)

| Data | Sensitivity | Stored in | Visible to | Leaves the system? |
|---|---|---|---|---|
| Steps, heart rate, sleep, workouts | High (health) | Postgres, Hetzner | Data owner; observers — habit aggregates only | No |
| Meal photos | Medium | Object Storage | Data owner; coach — with permission | **Yes**, to the AI provider's vision model — explicit consent required |
| Weight, measurements | High | Postgres | Only with explicit permission | No |
| Body photos | Very high | Object Storage, encrypted | Data owner only by default | No |
| Lab results | Very high (GDPR special category) | Postgres, encrypted | Data owner only by default | No (no AI interpretation in MVP) |
| LLM traces (graph inputs and outputs, including meal photos and health context) | High | Self-hosted Langfuse on Hetzner (ADR-0013) | Data owner; developers for debugging and evals | No; kept for a bounded retention period and deleted with the account |
| monobank token | Critical | Encrypted (KMS/secret store) | No one | Only to the monobank API |
| monobank transactions | High (financial) | Only relevant ones (transfers to the jar) | Data owner; referee — "settled" status only | No |

Requirements:
- explicit consent before sending meal photos to the AI provider (review the provider's data retention terms);
- export of all data and full account deletion;
- audit log of observer access;
- before opening to new users — a privacy policy and a GDPR compliance review.

## Open questions

1. What exactly does the reference device (Galaxy Watch) write to Health Connect (Phase 0)?
2. Does the wearable detect strength workouts automatically, or only when started manually?
3. Max heart rate for zones — age-based formula or a value entered by the user?
4. Authentication: magic link, Google OAuth, or both?
5. Which AI provider for vision (quality, price, data retention terms)?
6. Is post-meal reflection ("why did I eat?") part of MVP?
7. Day closing time — 10:00 or something else?
8. Monthly `excused` cap — 3 or another value?
9. ~~Product name~~ — **Basis** chosen.
10. How does a transfer to a monobank jar appear in the statement (for reliable detection)?
11. Does a group stake pot (DietBet-style) fall under gambling regulation in Ukraine?
12. How should life areas (health, household, finances, etc.) be modeled — as separate contexts,
    extensions to `habits`, or configuration? To be decided during implementation (ADR-0010).
