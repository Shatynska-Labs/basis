import { pgSchema, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

// The user's own profile, apart from what Google gives (add-identity-profile
// design decision 2). A user without a row has an empty profile.
export const profiles = identity.table('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  timeZone: text('time_zone'),
  birthYear: smallint('birth_year'),
  enteredMaxHeartRate: smallint('entered_max_heart_rate'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
