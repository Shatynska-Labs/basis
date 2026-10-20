// Derived from openspec/changes/add-persistence-skeleton/specs/api-persistence/spec.md
// ("The migration process applies the API's migration history", "The
// migration history starts with a baseline", "A failed migration fails the
// migration process without disclosing the URL") before implementation. The
// migration process is run as the requirement states it, `node dist/migrate.js`
// from the API's package; the `integration` target depends on `build`
// (design decision 9). The migration record is read from
// `drizzle.__drizzle_migrations` (design decision 4) and the history from
// drizzle-kit's journal, `migrations/meta/_journal.json` (design decision 5).
// Provenance of each assertion is recorded in the change's test-plan.md.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { freshDatabase, withClient } from '@basis/shared-testing';
import { describe, expect, inject, it } from 'vitest';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
const journal = fileURLToPath(
  new URL('../../migrations/meta/_journal.json', import.meta.url),
);

const PASSWORD = 'n0t-a-real-pa55word';

// Runs the migration process with exactly the environment given beyond PATH.
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

const historyEntries = () =>
  (JSON.parse(readFileSync(journal, 'utf8')) as { entries: { tag: string }[] })
    .entries;

// Its client from the shared arrangement (test-plan.md, Missing shared
// arrangement, entry 2: promoted).
const query = <R extends Record<string, unknown>>(url: string, text: string) =>
  withClient(url, async (client) => (await client.query<R>(text)).rows);

const migrationRecord = (url: string) =>
  query<{ id: number; hash: string; created_at: string }>(
    url,
    'select id, hash, created_at::text as created_at from drizzle.__drizzle_migrations order by id',
  );

describe("api-persistence: the migration process applies the API's migration history", () => {
  it('an empty database is migrated: exit 0, one record entry per migration in the history', async () => {
    const url = await freshDatabase(inject('postgresUrl'));

    const run = migrate({ DATABASE_URL: url });

    expect(run.status, run.output).toBe(0);
    expect(await migrationRecord(url)).toHaveLength(historyEntries().length);
  });

  it('a migrated database is migrated again: exit 0, the same record entries as before', async () => {
    const url = await freshDatabase(inject('postgresUrl'));
    expect(migrate({ DATABASE_URL: url }).status).toBe(0);
    const before = await migrationRecord(url);

    const run = migrate({ DATABASE_URL: url });

    expect(run.status, run.output).toBe(0);
    expect(await migrationRecord(url)).toEqual(before);
  });
});

describe('api-persistence: the migration history starts with a baseline', () => {
  it('the history is not empty and starts with the baseline', () => {
    const entries = historyEntries();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.tag).toMatch(/baseline/);
  });
});

describe('api-persistence: a failed migration fails the migration process without disclosing the URL', () => {
  it.each([
    ['unset', {}],
    ['empty', { DATABASE_URL: '' }],
  ] as const)(
    'no database URL (%s): non-zero exit, output names DATABASE_URL',
    (_case, env) => {
      const run = migrate(env);

      expect(run.status).not.toBe(0);
      expect(run.output).toContain('DATABASE_URL');
    },
  );

  it('an unreachable database: non-zero exit, output holds neither the password nor the URL', () => {
    const url = `postgres://basis:${PASSWORD}@127.0.0.1:9/basis`;

    const run = migrate({ DATABASE_URL: url });

    expect(run.status).not.toBe(0);
    expect(run.output).not.toContain(PASSWORD);
    expect(run.output).not.toContain(url);
    expect(run.output.trim()).not.toBe('');
  });

  it('a refused password: non-zero exit, output holds neither the password nor the URL', async () => {
    const reachable = new URL(await freshDatabase(inject('postgresUrl')));
    reachable.password = PASSWORD;
    const url = reachable.toString();

    const run = migrate({ DATABASE_URL: url });

    expect(run.status).not.toBe(0);
    expect(run.output).not.toContain(PASSWORD);
    expect(run.output).not.toContain(url);
    expect(run.output.trim()).not.toBe('');
  });
});
