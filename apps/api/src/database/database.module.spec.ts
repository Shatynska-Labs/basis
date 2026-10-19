// Derived from openspec/changes/add-persistence-skeleton/specs/api-persistence/spec.md
// ("The API is given its database by DATABASE_URL alone") before
// implementation. The application context is created from `AppModule`
// (design decision 1: the database module is global and imported there); the
// Drizzle database is taken from the injection token this file assumes is
// exported as `DATABASE` from `./database.module.ts` (the design names no
// token: an unresolved project question in the change's test-plan.md). No
// database is reachable here: the pool opens no connection until a query
// (design decision 1), so creating and closing the context needs none.
import { NestFactory } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { DATABASE } from './database.module.js';

// The Drizzle node-postgres database exposes its pg.Pool as `$client`, and a
// pg.Pool keeps the options it was created with as `options`.
interface DrizzleWithPool {
  $client: { options: { connectionString?: string } };
}

describe('api-persistence: the API is given its database by DATABASE_URL alone', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
  ] as const)(
    'the application refuses to start, naming DATABASE_URL, when it is %s',
    async (_case, value) => {
      if (value === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = value;

      await expect(
        NestFactory.createApplicationContext(AppModule, {
          logger: false,
          abortOnError: false,
        }),
      ).rejects.toThrow(/DATABASE_URL/);
    },
  );

  it('the URL the connection is configured with is exactly DATABASE_URL', async () => {
    const url = 'postgres://basis:secret@db.internal:5432/basis';
    process.env.DATABASE_URL = url;

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    try {
      const db = app.get<DrizzleWithPool>(DATABASE);

      expect(db.$client.options.connectionString).toBe(url);
    } finally {
      await app.close();
    }
  });
});
