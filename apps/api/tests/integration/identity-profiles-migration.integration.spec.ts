// Derived from openspec/changes/add-identity-profile/specs/api-persistence/spec.md
// (the MODIFIED "The migration history starts with a baseline") and design
// decision 2, before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md.
//
// The migration process is run as migrate.integration.spec.ts runs it,
// `node dist/migrate.js` from the API's package (the `integration` target
// depends on `build`), against a fresh database of the spec's own. The
// migration record's schema is `drizzle` (add-persistence-skeleton design
// decision 4). The revised scenario "The baseline creates nothing" is
// unchanged in text and stays covered by migration-schemas.integration.spec.ts.
// The scenario "Identity's tables are in its schema" as it stood before this
// change is asserted by metrics-migration-schemas.integration.spec.ts, listed
// as an obsolete candidate in test-plan.md.
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

describe('api-persistence: the migration history starts with a baseline (as revised by add-identity-profile)', () => {
  let url: string;

  beforeAll(async () => {
    url = await freshDatabase(inject('postgresUrl'));
    const run = migrate({ DATABASE_URL: url });
    expect(run.status, run.output).toBe(0);
  }, 120_000);

  it("identity's tables are in its schema: the tables outside the migration record are exactly identity.profiles, identity.sessions, identity.users and metrics.health_connect_deliveries (specified)", async () => {
    expect(await tablesOutsideRecord(url)).toEqual([
      'identity.profiles',
      'identity.sessions',
      'identity.users',
      'metrics.health_connect_deliveries',
    ]);
  });

  describe('identity.profiles (derived from design decision 2)', () => {
    it('has user_id uuid not null, time_zone text, birth_year and entered_max_heart_rate smallint, each nullable, and updated_at timestamptz not null', async () => {
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
                where table_schema = 'identity' and table_name = 'profiles'
                order by column_name`,
            )
          ).rows,
      );

      expect(columns).toEqual([
        {
          column_name: 'birth_year',
          data_type: 'smallint',
          is_nullable: 'YES',
        },
        {
          column_name: 'entered_max_heart_rate',
          data_type: 'smallint',
          is_nullable: 'YES',
        },
        { column_name: 'time_zone', data_type: 'text', is_nullable: 'YES' },
        {
          column_name: 'updated_at',
          data_type: 'timestamp with time zone',
          is_nullable: 'NO',
        },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
      ]);
    });

    it('is keyed by user_id, one row per user', async () => {
      const keys = await withClient(url, async (client) =>
        (
          await client.query<{ column_name: string }>(
            `select kcu.column_name
               from information_schema.table_constraints tc
               join information_schema.key_column_usage kcu
                 on kcu.constraint_schema = tc.constraint_schema
                and kcu.constraint_name = tc.constraint_name
              where tc.table_schema = 'identity' and tc.table_name = 'profiles'
                and tc.constraint_type = 'PRIMARY KEY'`,
          )
        ).rows.map((row) => row.column_name),
      );

      expect(keys).toEqual(['user_id']);
    });

    it('references identity.users(id), deleted with its user', async () => {
      const references = await withClient(
        url,
        async (client) =>
          (
            await client.query<{
              column_name: string;
              foreign_schema: string;
              foreign_table: string;
              foreign_column: string;
              delete_rule: string;
            }>(
              `select kcu.column_name,
                      ccu.table_schema as foreign_schema,
                      ccu.table_name as foreign_table,
                      ccu.column_name as foreign_column,
                      rc.delete_rule
                 from information_schema.referential_constraints rc
                 join information_schema.key_column_usage kcu
                   on kcu.constraint_schema = rc.constraint_schema
                  and kcu.constraint_name = rc.constraint_name
                 join information_schema.constraint_column_usage ccu
                   on ccu.constraint_schema = rc.unique_constraint_schema
                  and ccu.constraint_name = rc.unique_constraint_name
                where kcu.table_schema = 'identity' and kcu.table_name = 'profiles'`,
            )
          ).rows,
      );

      expect(references).toEqual([
        {
          column_name: 'user_id',
          foreign_schema: 'identity',
          foreign_table: 'users',
          foreign_column: 'id',
          delete_rule: 'CASCADE',
        },
      ]);
    });
  });
});
