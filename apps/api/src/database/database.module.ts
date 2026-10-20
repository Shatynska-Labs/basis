import { DATABASE, type Database } from '@basis/shared-infrastructure';
import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { APP_CONFIG, type AppConfig } from '../config/index.js';
import { APPLICATION_NAME } from './database-url.js';

/** The `pg` pool behind {@link DATABASE}. */
export const DATABASE_POOL = Symbol('DATABASE_POOL');

// A pool opens no connection until its first query, so starting the API does
// not depend on the database (add-persistence-skeleton design decision 1).
const createPool = (config: AppConfig): pg.Pool => {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
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

// The database is provided under the shared token, so a context's
// infrastructure takes it from @basis/shared-infrastructure
// (share-the-database-connection design decision 3).
@Global()
@Module({
  providers: [
    { provide: DATABASE_POOL, inject: [APP_CONFIG], useFactory: createPool },
    {
      provide: DATABASE,
      inject: [DATABASE_POOL],
      useFactory: (pool: pg.Pool): Database => drizzle(pool),
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
