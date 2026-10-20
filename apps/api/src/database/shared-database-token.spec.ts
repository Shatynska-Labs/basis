// Derived from openspec/changes/share-the-database-connection/specs/shared-infrastructure/spec.md
// ("The API's database is provided under a shared token", scenario "The API's
// database is resolved through the shared token") before implementation.
// Provenance of each assertion is recorded in that change's test-plan.md. The
// application context is created from `AppModule` and the database is taken
// from the token imported from `@basis/shared-infrastructure`. No database is
// reachable here: the pool opens no connection until a query, so creating and
// closing the context needs none.
import { DATABASE } from '@basis/shared-infrastructure';
import { NestFactory } from '@nestjs/core';
import { is } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';

// The Drizzle node-postgres database exposes its pg.Pool as `$client`, and a
// pg.Pool keeps the options it was created with as `options`.
interface DrizzleWithPool {
  $client: { options: { connectionString?: string } };
}

describe("shared-infrastructure: the API's database is resolved through the shared token", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it('the provider for DATABASE is a Drizzle database whose connection is configured with exactly DATABASE_URL', async () => {
    const url = 'postgres://basis:secret@db.internal:5432/basis';
    process.env.DATABASE_URL = url;

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    try {
      const db = app.get<DrizzleWithPool>(DATABASE);

      expect(is(db, NodePgDatabase)).toBe(true);
      expect(db.$client.options.connectionString).toBe(url);
    } finally {
      await app.close();
    }
  });
});
