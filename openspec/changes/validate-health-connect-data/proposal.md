## Why

Roadmap Phase 0 validates the data source before the main development builds on it: ADR-0001 chose Health Connect on the assumption that the reference device (a Galaxy Watch, through Samsung Health) writes what the habits need, and risk R1 (`docs/product/06-risks-and-open-questions.md`) rates the opposite as medium likelihood, high impact. Open questions 1 (what the watch actually writes) and 2 (whether strength workouts are detected automatically) are unanswered, and so is how late the data arrives. ADR-0001 names the means: an existing open-source bridge, HC Webhook, sending Health Connect records to a temporary endpoint. Signing in now exists (`add-identity-authentication`), so the endpoint can belong to a user like every later metric.

## What Changes

- **A temporary Health Connect intake.** `POST /health-connect/deliveries` accepts a delivery in HC Webhook's JSON format from a signed-in caller and stores it as received, with the caller and the time it arrived. The bridge authenticates with a session token in a custom `Authorization` header (operator's decision). The route accepts bodies up to 10 MB; every other route keeps the 100 kB limit.
- **A summary of what arrived.** `GET /health-connect/deliveries/summary` answers, for the caller's deliveries: how many and when; per data type, the number of records, their time span, the apps that wrote them, how they were recorded and on which devices; the sleep stage names; the exercise types and how each was recorded; and how long records took to reach Health Connect and then the API. This is what the Phase 0 findings are read from (operator's decision: a table and a summary route).
- **The `metrics` context, first slice.** `libs/metrics/{application,infrastructure,contracts}` (`scope:metrics`), the context map's owner of the Health Connect anti-corruption layer, with a `metrics` schema holding one table, `health_connect_deliveries`. The intake is explicitly temporary: Phase 1's idempotent ingestion replaces it (operator's decision: in `metrics`, not a throwaway module).
- **No contents in the logs.** A delivery holds health data; neither its body nor its values are logged.

## Capabilities

### New Capabilities

- `health-connect-intake`: receiving HC Webhook deliveries from a signed-in caller, storing them unchanged, and summarising what they contain.

### Modified Capabilities

- `api-persistence`: the scenario listing every table outside the migration record gains `metrics.health_connect_deliveries`.

## Impact

- New projects `libs/metrics/{application,infrastructure,contracts}` (`scope:metrics`), built, depended on by `apps/api`.
- `apps/api`: `AppModule` imports `MetricsModule`; the bootstrap raises the JSON body limit for the intake route; `src/database/schema.ts` re-exports `metrics`' table; migration `0002`; `README.md` (setting up the bridge).
- `docs/backlog.md`: `record-phase-0-findings` (the follow-up that writes the findings, adjusts or confirms ADR-0001 and answers open questions 1 and 2; operator's decision to keep it out of this change), `retire-the-health-connect-intake`, `issue-ingestion-keys` (a per-user, revocable ingestion key, needed only if third-party bridges stay a source after Phase 1), and `keep-query-parameters-out-of-defect-logs` (found while planning: a failed query's error message holds its parameters, so `identity`'s session insert could log a digest).
- **Operator steps after merging**: install HC Webhook on the phone, grant it Health Connect access, and point it at staging, then production, with a session token for each host.
- Out of scope: normalising records into `MetricRecord`, idempotency and deduplication, `MetricRecorded` events, our own Expo client, the findings themselves, deleting stored deliveries.
