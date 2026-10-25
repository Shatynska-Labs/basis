---
kind: change
waits_on: []
waits_for: "the Phase 1 decision on data sources (`reach-the-calibration-period`'s open question)."
design_with: []
workstream: reach-the-calibration-period
recorded_by: validate-health-connect-data
re_checked: 2026-10-25
---

The temporary intake authenticates HC Webhook with an ordinary 30-day session token pasted into the bridge (`validate-health-connect-data` design decision 1). If a third-party bridge stays a data source after Phase 1, beside or instead of Basis's own mobile client, give each user a long-lived, revocable key that is valid only for sending data, stored as a digest like sessions.

- **Kind**: It owes an `identity-authentication` delta and the operator's decision that bridges remain a source.
- **Recorded by**: `validate-health-connect-data`, where the operator chose the session token for Phase 0, since ADR-0001's own client needs no separate key.
- **Re-checked**: 2026-10-25 (by `record-phase-0-findings`).
