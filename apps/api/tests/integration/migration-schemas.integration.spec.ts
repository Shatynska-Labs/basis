// Derived from openspec/changes/add-identity-authentication/specs/api-persistence/spec.md
// (the MODIFIED "The migration history starts with a baseline", as revised
// at 500a944) before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md.
//
// The migration process is run as migrate.integration.spec.ts runs it,
// `node dist/migrate.js` from the API's package (the `integration` target
// depends on `build`), against a fresh database of the spec's own. The
// migration record's schema is `drizzle` (add-persistence-skeleton design
// decision 4).
//
// "The schema of a context" is read as a schema named after a context
// library directory, `libs/<context>/` other than `libs/shared/` (ADR-0011:
// each context owns its tables in `pgSchema('<context>')`; ADR-0012 §1: a
// context is `libs/<context>/`). That reading is an unresolved project
// question in test-plan.md.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { freshDatabase, withClient } from '@basis/shared-testing';
import { beforeAll, describe, expect, inject, it } from 'vitest';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
const libsRoot = fileURLToPath(new URL('../../../../libs/', import.meta.url));

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

/** The tables outside the system schemas and the migration record's, as `schema.table`, sorted. */
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

/** The context names: directories under libs/ other than shared. */
const contextNames = () =>
  readdirSync(libsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => entry.name);

/** The tables among `tables` that are in `public` or in no context's schema. */
const misplacedTables = (tables: string[], contexts: string[]) =>
  tables.filter((table) => {
    const schema = table.slice(0, table.indexOf('.'));
    return schema === 'public' || !contexts.includes(schema);
  });

// ---------------------------------------------------------------------------

describe('api-persistence: the migration history starts with a baseline (as revised)', () => {
  let tables: string[];

  beforeAll(async () => {
    const url = await freshDatabase(inject('postgresUrl'));
    const run = migrate({ DATABASE_URL: url });
    expect(run.status, run.output).toBe(0);
    tables = await tablesOutsideRecord(url);
  }, 120_000);

  it('the baseline creates nothing: no table in public, and every table outside the migration record is in the schema of a context', () => {
    // Shows there are tables to judge, so an empty finding is not vacuous.
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.filter((table) => table.startsWith('public.'))).toEqual([]);
    expect(misplacedTables(tables, contextNames())).toEqual([]);
  });

  it("identity's tables are in its schema: the tables outside the migration record are exactly identity.users and identity.sessions", () => {
    expect(tables).toEqual(['identity.sessions', 'identity.users']);
  });
});

describe('api-persistence: the placement check discriminates (fixture-driven)', () => {
  it('accepts tables in context schemas', () => {
    expect(
      misplacedTables(
        ['identity.users', 'habits.habits'],
        ['identity', 'habits'],
      ),
    ).toEqual([]);
  });

  it('reports a table in public', () => {
    expect(misplacedTables(['public.users'], ['identity'])).toEqual([
      'public.users',
    ]);
  });

  it('reports a table in a schema no context owns', () => {
    expect(misplacedTables(['auth.users'], ['identity'])).toEqual([
      'auth.users',
    ]);
  });

  it('the context names include identity once its libraries exist, and exclude shared', () => {
    const names = contextNames();

    expect(names).not.toContain('shared');
    expect(names).toContain('identity');
  });
});
