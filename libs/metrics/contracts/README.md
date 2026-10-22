# metrics-contracts

`metrics`' public surface (`scope:metrics`, `type:contracts`; ADR-0012 §1): the Zod schemas of the temporary Health Connect intake (`validate-health-connect-data`).

- `HealthConnectDeliveryRequest`: an HC Webhook delivery, a JSON object with a string `timestamp` and `app_version`, every other key kept.
- `HealthConnectSummaryResponse`: what `GET /health-connect/deliveries/summary` answers.

Both are temporary: Phase 1's ingestion replaces them (`retire-the-health-connect-intake` in `docs/backlog.md`). It is built to `dist/`, because the API imports it at runtime.
