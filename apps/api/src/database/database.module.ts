import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { APPLICATION_NAME, readDatabaseUrl } from './database-url.js';
import * as schema from './schema.js';

/** The `pg` pool behind {@link DATABASE}. */
export const DATABASE_POOL = Symbol('DATABASE_POOL');
/** The Drizzle database over every context's schema. */
export const DATABASE = Symbol('DATABASE');

export type Database = NodePgDatabase<typeof schema>;

// A pool opens no connection until its first query, so starting the API does
// not depend on the database (add-persistence-skeleton design decision 1).
const createPool = (): pg.Pool => {
  const pool = new pg.Pool({
    connectionString: readDatabaseUrl(process.env),
    application_name: APPLICATION_NAME,
  });
  // An idle client's failure is logged, by class and code only, instead of
  // ending the process; the next query takes a new connection.
  const logger = new Logger('Database');
  pool.on('error', (error: Error & { code?: string }) => {
    logger.error(
      `An idle database connection failed: ${error.name}${error.code ? ` (${error.code})` : ''}.`,
    );
  });
  return pool;
};

@Global()
@Module({
  providers: [
    { provide: DATABASE_POOL, useFactory: createPool },
    {
      provide: DATABASE,
      inject: [DATABASE_POOL],
      useFactory: (pool: pg.Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
