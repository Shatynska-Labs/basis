---
kind: change
waits_on: []
design_with: []
workstream: reach-the-calibration-period
recorded_by: add-identity-authentication
re_checked: 2026-10-21
---

`identity`'s profile: the user's time zone, which every day and week is computed in (Conventions, Time), and the heart-rate zone parameters `hr_zone_minutes` needs (`docs/product/04-domain-model.md` §1). Open question 3 of `docs/product/06-risks-and-open-questions.md` (max heart rate from an age formula or entered by the user) is the operator's to answer. It extends `identity.users`, or adds a profile table, behind `GET /me` or a profile route.

- **Kind**: It owes an `identity` delta and the operator's answer to open question 3.
- **Waits on**: (`add-identity-authentication`, archived, gives users an identity).
- **Recorded by**: `add-identity-authentication`, which the operator split into authentication first and the profile next.
