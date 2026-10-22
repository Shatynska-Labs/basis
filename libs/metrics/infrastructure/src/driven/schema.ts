import { index, jsonb, pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';

// metrics' tables, in its own schema (ADR-0011; validate-health-connect-data
// design decision 7). The API's migration history collects them through
// apps/api/src/database/schema.ts. `user_id` references identity's user by
// identifier only, without reaching into identity's schema.

export const metrics = pgSchema('metrics');

/** Temporary: Phase 1's ingestion replaces it (retire-the-health-connect-intake). */
export const healthConnectDeliveries = metrics.table(
  'health_connect_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    payload: jsonb('payload').notNull(),
  },
  (table) => [index().on(table.userId, table.receivedAt)],
);
