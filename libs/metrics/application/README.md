# metrics-application

`metrics`' use cases (`scope:metrics`, `type:application`; ADR-0012 §1, §2), sent on `@nestjs/cqrs`'s buses. For now only the temporary Health Connect intake (`validate-health-connect-data`), which Phase 1's ingestion replaces (`retire-the-health-connect-intake` in `docs/backlog.md`):

- `RecordHealthConnectDelivery` (command): stores an HC Webhook delivery as received, without interpreting, deduplicating or merging it.
- `SummarizeHealthConnectDeliveries` (query): the caller's deliveries summarised by `summarizeHealthConnectDeliveries`, a pure function.

Ports, each an abstract class serving as its own injection token: the write port `HealthConnectDeliveryRepository` and the read port `HealthConnectDeliveryReader`. `METRICS_HANDLERS` lists the handlers for the composition root. Reading HC Webhook's format here, rather than in a driving anti-corruption layer, is acceptable only because the intake is temporary; Phase 1 translates in the driving adapter (`validate-health-connect-data` design decision 6).

It is built to `dist/`, because the API imports it at runtime. Tests: `pnpm nx test metrics-application`.
