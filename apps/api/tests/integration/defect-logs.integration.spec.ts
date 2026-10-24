// A failed query's parameters are kept out of its defect log entry
// (keep-query-parameters-out-of-defect-logs), observed with the error Drizzle
// really throws: its message lists the parameters, and PostgreSQL's own
// message for this failure quotes the one it refused.
import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { freshDatabase } from '@basis/shared-testing';
import { DrizzleQueryError, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';

import { ProblemFilter } from '../../src/http/problem.filter.js';

const host = (): ArgumentsHost => {
  const response = {
    status: () => response,
    set: () => response,
    type: () => response,
    send: () => response,
  };
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProblemFilter: a query failing against PostgreSQL', () => {
  it('is logged without the parameter it carried', async () => {
    const pool = new pg.Pool({
      connectionString: await freshDatabase(inject('postgresUrl')),
    });
    const thrown = await drizzle(pool)
      .execute(sql`select ${'n0t-for-logs'}::integer`)
      .then(
        () => undefined,
        (error: unknown) => error,
      )
      .finally(() => pool.end());
    expect(thrown).toBeInstanceOf(DrizzleQueryError);
    expect(String((thrown as Error).message)).toContain('n0t-for-logs');
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    new ProblemFilter().catch(thrown, host());

    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain('select $1::integer');
    expect(logged).toContain('22P02');
    expect(logged).not.toContain('n0t-for-logs');
  });
});
