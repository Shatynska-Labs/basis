import { defineConfig } from 'drizzle-kit';

// The API's one migration history (ADR-0011): every context's schema, through
// src/database/schema.ts, into migrations/. Generating needs no database;
// applying is dist/migrate.js (add-persistence-skeleton design decisions 4
// and 5).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './migrations',
  migrations: { schema: 'drizzle' },
});
