# metrics-infrastructure

`metrics`' adapters (`scope:metrics`, `type:infrastructure`; ADR-0012 §1; `validate-health-connect-data`), for now only the temporary Health Connect intake, which Phase 1's ingestion replaces (`retire-the-health-connect-intake` in `docs/backlog.md`):

- `src/driven/`: the table `health_connect_deliveries` of the PostgreSQL schema `metrics`, and its Drizzle repository and reader. A failed insert throws `HealthConnectDeliveryNotStored` in place of the query's error, whose message would carry the delivery into the log.
- `src/driving/`: `HealthConnectDeliveriesController` (`POST /health-connect/deliveries`, `GET /health-connect/deliveries/summary`), behind the global session guard.
- `src/metrics.module.ts`: the composition root, outside both folders, binding the driven adapters to the application's ports.

A driving adapter may not import a driven one (lint; ADR-0012 §1). It is built to `dist/`, because the API imports it at runtime. Its table reaches the API's migration history through `apps/api/src/database/schema.ts`. Tests: the adapters are tested in `apps/api/tests/integration/`, where the migrations are.
