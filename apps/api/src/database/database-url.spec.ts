// Derived from openspec/changes/add-persistence-skeleton/specs/api-persistence/spec.md
// ("The API is given its database by DATABASE_URL alone") before
// implementation. The design (decisions 2 and 4) states that DATABASE_URL is
// read through one function shared by the module and the migration process
// but does not name it; these tests assume `readDatabaseUrl(env)` exported
// from `./database-url.ts`, an unresolved project question recorded in the
// change's test-plan.md together with the provenance of each assertion.
import { describe, expect, it } from 'vitest';

import { readDatabaseUrl } from './database-url.js';

describe('api-persistence: no database URL', () => {
  it.each([
    ['unset', {}],
    ['set to the empty string', { DATABASE_URL: '' }],
  ] as const)(
    'reading the configuration fails naming DATABASE_URL when it is %s',
    (_case, env) => {
      expect(() => readDatabaseUrl(env)).toThrow(/DATABASE_URL/);
    },
  );
});

describe('api-persistence: a database URL is taken unchanged', () => {
  it('returns exactly the value DATABASE_URL holds', () => {
    const url = 'postgres://basis:secret@db.internal:5432/basis';

    expect(readDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });
});
