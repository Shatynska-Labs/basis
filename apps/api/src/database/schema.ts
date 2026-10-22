// Every context's Drizzle schema, re-exported for drizzle-kit (ADR-0011: one
// migration history, owned by apps/api). The connection is created without it
// (share-the-database-connection design decision 4).
export { identity, sessions, users } from '@basis/identity-infrastructure';
export {
  healthConnectDeliveries,
  metrics,
} from '@basis/metrics-infrastructure';
