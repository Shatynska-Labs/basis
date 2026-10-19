// Derived from openspec/changes/add-persistence-skeleton/specs/integration-testing/spec.md
// ("Each integration run gets a throwaway PostgreSQL", "Each spec can take a
// fresh database") before implementation. The run's URL is taken with
// `inject('postgresUrl')` (the key name is an unresolved project question in
// the change's test-plan.md); `freshDatabase(url)` is the helper design
// decision 8 names in @basis/shared-testing.
import { freshDatabase, withClient } from '@basis/shared-testing';
import { describe, expect, inject, it } from 'vitest';

// Its client from the shared arrangement (test-plan.md, Missing shared
// arrangement, entry 3: promoted).
const queryOne = <R extends Record<string, unknown>>(
  url: string,
  text: string,
) =>
  withClient(url, async (client) => (await client.query<R>(text)).rows[0] as R);

describe('integration-testing: each integration run gets a throwaway PostgreSQL', () => {
  it("the run's server answers, and its major version is 18", async () => {
    const row = await queryOne<{ server_version_num: string }>(
      inject('postgresUrl'),
      'show server_version_num',
    );

    expect(Math.floor(Number(row.server_version_num) / 10_000)).toBe(18);
  });
});

describe('integration-testing: each spec can take a fresh database', () => {
  it('two fresh databases are two different databases, each with no table in public', async () => {
    const server = inject('postgresUrl');
    const first = await freshDatabase(server);
    const second = await freshDatabase(server);

    const names = await Promise.all(
      [first, second].map((url) =>
        queryOne<{ name: string }>(
          url,
          'select current_database() as name',
        ).then((r) => r.name),
      ),
    );
    expect(names[0]).not.toBe(names[1]);

    for (const url of [first, second]) {
      const row = await queryOne<{ count: string }>(
        url,
        "select count(*) as count from information_schema.tables where table_schema = 'public'",
      );
      expect(Number(row.count)).toBe(0);
    }
  });
});
