// Derived from openspec/changes/validate-health-connect-data/specs/api-persistence/spec.md
// (the MODIFIED "The migration history starts with a baseline") and design
// decision 7, before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md.
//
// The migration process is run as migrate.integration.spec.ts runs it,
// `node dist/migrate.js` from the API's package (the `integration` target
// depends on `build`), against a fresh database of the spec's own. The
// migration record's schema is `drizzle` (add-persistence-skeleton design
// decision 4). The revised scenario "The baseline creates nothing" is
// unchanged in text and stays covered by migration-schemas.integration.spec.ts.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { freshDatabase, withClient } from '@basis/shared-testing';
import { beforeAll, describe, expect, inject, it } from 'vitest';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** Runs the migration process with exactly the environment given beyond PATH. Found in migrate.integration.spec.ts. */
const migrate = (env: Record<string, string>) => {
  const result = spawnSync(process.execPath, ['dist/migrate.js'], {
    cwd: apiRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
};

/** The tables outside the system schemas and the migration record's, as `schema.table`, sorted. Found in migration-schemas.integration.spec.ts. */
const tablesOutsideRecord = (url: string) =>
  withClient(url, async (client) =>
    (
      await client.query<{ name: string }>(
        `select table_schema || '.' || table_name as name
           from information_schema.tables
          where table_schema not in ('drizzle', 'pg_catalog', 'information_schema')
          order by 1`,
      )
    ).rows.map((row) => row.name),
  );

// ---------------------------------------------------------------------------

describe('api-persistence: the migration history starts with a baseline (as revised by validate-health-connect-data)', () => {
  let url: string;

  beforeAll(async () => {
    url = await freshDatabase(inject('postgresUrl'));
    const run = migrate({ DATABASE_URL: url });
    expect(run.status, run.output).toBe(0);
  }, 120_000);

  it("identity's tables are in its schema: the tables outside the migration record are exactly identity.users, identity.sessions and metrics.health_connect_deliveries", async () => {
    expect(await tablesOutsideRecord(url)).toEqual([
      'identity.sessions',
      'identity.users',
      'metrics.health_connect_deliveries',
    ]);
  });

  describe('metrics.health_connect_deliveries (derived from design decision 7)', () => {
    it('has the columns id uuid, user_id uuid, received_at timestamptz and payload jsonb, each not null', async () => {
      const columns = await withClient(
        url,
        async (client) =>
          (
            await client.query<{
              column_name: string;
              data_type: string;
              is_nullable: string;
            }>(
              `select column_name, data_type, is_nullable
               from information_schema.columns
              where table_schema = 'metrics' and table_name = 'health_connect_deliveries'
              order by column_name`,
            )
          ).rows,
      );

      expect(columns).toEqual([
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'payload', data_type: 'jsonb', is_nullable: 'NO' },
        {
          column_name: 'received_at',
          data_type: 'timestamp with time zone',
          is_nullable: 'NO',
        },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
      ]);
    });

    it('carries no foreign key, to identity.users or elsewhere', async () => {
      // Shows the table exists, so an empty finding is not vacuous.
      expect(await tablesOutsideRecord(url)).toContain(
        'metrics.health_connect_deliveries',
      );
      const foreignKeys = await withClient(
        url,
        async (client) =>
          (
            await client.query(
              `select constraint_name
               from information_schema.table_constraints
              where table_schema = 'metrics'
                and table_name = 'health_connect_deliveries'
                and constraint_type = 'FOREIGN KEY'`,
            )
          ).rows,
      );

      expect(foreignKeys).toEqual([]);
    });

    it('has an index on (user_id, received_at)', async () => {
      const definitions = await withClient(url, async (client) =>
        (
          await client.query<{ indexdef: string }>(
            `select indexdef from pg_indexes
              where schemaname = 'metrics' and tablename = 'health_connect_deliveries'`,
          )
        ).rows.map((row) => row.indexdef),
      );

      expect(
        definitions.some((definition) =>
          /\(\s*user_id\s*,\s*received_at\s*\)/.test(definition),
        ),
        definitions.join('\n'),
      ).toBe(true);
    });

    it('generates its id and its arrival time in the database', async () => {
      const [row] = await withClient(
        url,
        async (client) =>
          (
            await client.query<{ id: string; received_at: Date }>(
              `insert into metrics.health_connect_deliveries (user_id, payload)
             values (gen_random_uuid(), '{}'::jsonb)
             returning id::text as id, received_at`,
            )
          ).rows,
      );

      expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(row?.received_at).toBeInstanceOf(Date);
    });
  });
});
