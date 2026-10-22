## 1. The metrics context

- [x] 1.1 Create `libs/metrics/contracts`, `libs/metrics/application` and `libs/metrics/infrastructure` (tags `scope:metrics` and their `type:`), built like `identity`'s, as `dependencies` of `apps/api`. Run `pnpm install` and `pnpm nx sync` (design decision 6)
- [x] 1.2 Contracts: `HealthConnectDeliveryRequest` and `HealthConnectSummaryResponse` (decisions 2 and 4)
- [x] 1.3 Application: the ports, `summarizeHealthConnectDeliveries`, and the `RecordHealthConnectDelivery` and `SummarizeHealthConnectDeliveries` handlers (decisions 2, 4, 5 and 6)
- [x] 1.4 Infrastructure, driven: the `metrics` schema's `health_connect_deliveries` table and the repository and reader adapters, the repository throwing `HealthConnectDeliveryNotStored` for a failed insert (decisions 7 and 8)
- [x] 1.5 Infrastructure, driving: `HealthConnectDeliveriesController`; the composition root `src/metrics.module.ts` (decisions 2, 4 and 6)

## 2. The API

- [x] 2.1 Import `MetricsModule` in `AppModule`; re-export the table from `apps/api/src/database/schema.ts`; generate migration `0002` with `pnpm nx run api:db-generate` (decision 7), as the `api-persistence` delta requires
- [x] 2.2 Add `apps/api/src/http/body-parsers.ts` with `useBodyParsers`, called from `main.ts`; add `express` to `apps/api`'s dependencies (decision 3)

## 3. Record and verify

- [x] 3.1 Update `apps/api/README.md` (the intake, its temporariness, and setting up HC Webhook: the URL, the `Authorization` header, the types to enable, reading the summary, setting heart rate to raw samples, and what to do on `413`), and a README for each new library. Record `record-phase-0-findings`, `retire-the-health-connect-intake`, `issue-ingestion-keys` and `keep-query-parameters-out-of-defect-logs` in `docs/backlog.md`
- [x] 3.2 Dispose of `test-plan.md`'s _Missing shared arrangement_ entries
- [x] 3.3 Verify with `pnpm nx run-many -t lint typecheck test build`, `pnpm nx run-many -t integration`, `pnpm nx e2e api-e2e`, `pnpm format:check`, `pnpm nx sync:check` and `openspec validate --all --strict`

## 4. Ship

- [x] 4.1 Merge the implementation pull request and wait for the operator's word that staging's deploy is healthy
- [ ] 4.2 Confirm on staging: with HC Webhook pointed at staging with a staging session token, a manual sync answers `2xx` in the bridge's log, and the summary shows records written by Samsung Health from the watch
- [ ] 4.3 Promote, on the operator's act, and wait for the smoke wait to pass; the operator points the bridge at production
- [ ] 4.4 Archive, updating `docs/backlog.md` entries this change touches
