---
kind: change
waits_on: [ingest-health-connect-metrics]
design_with: [move-to-durable-data-storage, ingest-health-connect-metrics]
workstream: reach-the-calibration-period
recorded_by: validate-health-connect-data
re_checked: 2026-11-08
---

`validate-health-connect-data` added a temporary intake for HC Webhook: `POST /health-connect/deliveries` and `GET /health-connect/deliveries/summary` in `libs/metrics`, the table `metrics.health_connect_deliveries`, and a 10 MB body limit for that route (`apps/api/src/http/body-parsers.ts`), described in `apps/api/README.md` and `libs/metrics/contracts/README.md`. Phase 1's idempotent ingestion replaces it, and no third-party bridge stays a source after Phase 1 (`reach-the-calibration-period` decision 3). Remove the routes, the summary and the body limit, decide whether the stored deliveries are kept, replayed into the new ingestion or dropped (a forward-only migration), and remove the README sections. `move-to-durable-data-storage` copies the stored deliveries into production's own database, so the decision covers that copy too.

- **Kind**: It owes a `health-connect-intake` removal delta and the operator's decision on the stored deliveries.
- **Recorded by**: `validate-health-connect-data`, which is temporary by design.
