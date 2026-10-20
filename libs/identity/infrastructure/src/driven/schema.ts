import { pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// identity's tables, in its own schema (ADR-0011; add-identity-authentication
// design decisions 2, 4 and 14). The API's migration history collects them
// through apps/api/src/database/schema.ts.

export const identity = pgSchema('identity');

export const users = identity.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleSubject: text('google_subject').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = identity.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
