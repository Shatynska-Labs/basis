---
kind: change
waits_on: []
waits_for: "Phase 1's Health Connect ingestion (`ingest-health-connect-metrics`)."
design_with: [move-to-durable-data-storage]
workstream: reach-the-calibration-period
recorded_by: validate-health-connect-data
re_checked: 2026-10-25
---

`validate-health-connect-data` added a temporary intake: `POST /health-connect/deliveries` and `GET /health-connect/deliveries/summary` in `libs/metrics`, the table `metrics.health_connect_deliveries`, a 10 MB body limit for that route (`apps/api/src/http/body-parsers.ts`), and README instructions for HC Webhook. Phase 1's idempotent ingestion, with Health Connect translated in a driving anti-corruption layer, replaces it. Remove the routes, the summary and the body limit, decide whether the stored deliveries are kept, replayed into the new ingestion or dropped (a forward-only migration), and remove the README section.

- **Kind**: It owes a `health-connect-intake` removal delta and the operator's decision on the stored deliveries.
- **Design with**: `move-to-durable-data-storage`, which copies the stored deliveries into production's own database.
- **Recorded by**: `validate-health-connect-data`, which is temporary by design.
- **Re-checked**: 2026-10-25 (by `choose-durable-data-storage`).
