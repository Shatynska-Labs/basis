// A failed query's parameters are kept out of its defect log entry
// (keep-query-parameters-out-of-defect-logs): `DrizzleQueryError`'s message,
// and so its stack, lists them, and `identity`'s queries carry a session
// token's digest and an email (identity-authentication, api-http-errors).
import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemFilter } from './problem.filter.js';

/** An HTTP host whose response accepts whatever the filter sends. */
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

/** Every `error` entry the filter logs, as text. */
const loggedErrors = (thrown: unknown): string => {
  const error = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  new ProblemFilter().catch(thrown, host());
  return JSON.stringify(error.mock.calls);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProblemFilter: a failed query', () => {
  const query =
    'insert into "identity"."sessions" ("token_hash", "user_id") values ($1, $2)';
  const failed = () =>
    new DrizzleQueryError(
      query,
      ['d1gest-n0t-for-logs', 'email-n0t-for-logs@example.com'],
      Object.assign(new Error('duplicate key: d1gest-n0t-for-logs'), {
        code: '23505',
      }),
    );

  it('is logged with its SQL, its cause code and its stack frames', () => {
    const logged = loggedErrors(failed());

    expect(logged).toContain(query.replaceAll('"', '\\"'));
    expect(logged).toContain('23505');
    expect(logged).toMatch(/\\n\s+at /);
  });

  it('is logged without its parameters or its cause message', () => {
    const logged = loggedErrors(failed());

    expect(logged).not.toContain('n0t-for-logs');
    expect(logged).not.toContain('params:');
  });
});
