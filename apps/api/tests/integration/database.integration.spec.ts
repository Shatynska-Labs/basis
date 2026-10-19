// Derived from openspec/changes/add-persistence-skeleton/specs/api-persistence/spec.md
// ("The API's connection reaches the database it is given") before
// implementation. The run's PostgreSQL URL is taken with `inject('postgresUrl')`
// (design decision 8 provides it from the global setup; the key name is an
// unresolved project question in the change's test-plan.md), and each test
// takes its own database through `freshDatabase` from @basis/shared-testing.
// The Drizzle database is taken from the token assumed to be exported as
// `DATABASE` from `src/database/database.module.ts`.
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { DATABASE } from '@basis/shared-infrastructure';
import { freshDatabase, withClient } from '@basis/shared-testing';
import { sql } from 'drizzle-orm';
import type { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';

interface Executes {
  execute(
    query: ReturnType<typeof sql>,
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

const databaseNameOf = (url: string) =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));

// A connection of the test's own, under an application_name other than the
// API's, used to observe the server; its client from the shared arrangement
// (test-plan.md, Missing shared arrangement, entry 1: promoted).
const withObserver = <T>(url: string, use: (client: Client) => Promise<T>) =>
  withClient(url, use, { applicationName: 'test-observer' });

const apiConnections = (client: Client, database: string) =>
  client
    .query<{ count: string }>(
      `select count(*) as count from pg_stat_activity
        where application_name = 'basis-api' and datname = $1`,
      [database],
    )
    .then((result) => Number(result.rows[0]?.count ?? 0));

describe("api-persistence: the API's connection reaches the database it is given", () => {
  let saved: string | undefined;
  let url: string;
  let app: INestApplicationContext | undefined;

  const opened = () => {
    if (!app) throw new Error('the application context is not open');
    return app;
  };

  beforeEach(async () => {
    saved = process.env.DATABASE_URL;
    url = await freshDatabase(inject('postgresUrl'));
    process.env.DATABASE_URL = url;
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it('a query reaches the database: current_database() is the database DATABASE_URL names', async () => {
    const db = opened().get<Executes>(DATABASE);

    const result = await db.execute(sql`select current_database() as name`);

    expect(result.rows[0]?.name).toBe(databaseNameOf(url));
  });

  it('closing the API releases its connections', async () => {
    const db = opened().get<Executes>(DATABASE);
    await db.execute(sql`select 1`);
    const database = databaseNameOf(url);

    await withObserver(url, async (observer) => {
      // Shows the observation can see the API's connection at all, so the
      // absence below is not an artefact of the query.
      expect(await apiConnections(observer, database)).toBeGreaterThan(0);

      await opened().close();
      app = undefined;

      // A backend may outlive its client's disconnect briefly.
      await expect
        .poll(() => apiConnections(observer, database), {
          timeout: 5_000,
          interval: 100,
        })
        .toBe(0);
    });
  });
});
