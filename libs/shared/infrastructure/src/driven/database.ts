import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** The Drizzle database, provided by the API's database module. */
export const DATABASE = Symbol('DATABASE');

// No schema type: a shared library cannot see the contexts' tables, and a
// repository uses the query builder over its own context's tables, not the
// relational query API (share-the-database-connection design decision 4).
export type Database = NodePgDatabase;
