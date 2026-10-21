// Derived from openspec/changes/add-identity-authentication/specs/api-configuration/spec.md
// ("Disabled sign-in is logged at startup") and
// specs/identity-authentication/spec.md ("Every route requires a session
// unless declared public": "No credentials", "Public routes need no
// session") before implementation. Provenance of each assertion is recorded
// in that change's test-plan.md. The built API (apps/api/dist/main.js) is
// started through ./support/api-process, which inherits this process's
// environment, waits for `GET /health`, and captures everything the process
// writes from its start (as json-logs.spec.ts relies on); nothing is
// imported from apps/api. No database is needed: nothing here looks a
// session up (design decision 15).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startApi } from './support/api-process.js';

const UNREACHABLE_URL =
  'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';
const startupTimeout = 20_000;

const DISABLED_MESSAGE =
  'Sign-in with Google is disabled: GOOGLE_CLIENT_IDS names no client.';

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** The JSON log entries in `output`, one per non-empty line; a line that is not JSON is kept as its text. */
const entriesOf = (output: string): Record<string, unknown>[] =>
  output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      try {
        const entry = JSON.parse(line) as unknown;
        return entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : { text: line };
      } catch {
        return { text: line };
      }
    });

/** Entries whose message is the disabled-sign-in warning, by any field holding it. */
const disabledEntries = (output: string) =>
  entriesOf(output).filter((entry) =>
    JSON.stringify(entry).includes(DISABLED_MESSAGE),
  );

// ---------------------------------------------------------------------------

const ENV_NAMES = [
  'DATABASE_URL',
  'GOOGLE_CLIENT_IDS',
  'SIGNUP_ALLOWED_EMAILS',
];

describe('identity-authentication: the built API', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    process.env['DATABASE_URL'] = UNREACHABLE_URL;
    delete process.env['SIGNUP_ALLOWED_EMAILS'];
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /** Starts the API with GOOGLE_CLIENT_IDS as given (`undefined`: unset), checks it listens, and returns its output. */
  const outputOfRunWith = async (clientIds: string | undefined) => {
    if (clientIds === undefined) delete process.env['GOOGLE_CLIENT_IDS'];
    else process.env['GOOGLE_CLIENT_IDS'] = clientIds;
    const api = await startApi({ appVersion: '3f2c9e1' });
    try {
      const response = await fetch(`${api.baseUrl}/health`);
      await response.text();
      // It listens: the health check is answered.
      expect(response.status).toBe(200);
    } finally {
      await api.stop();
    }
    return api.output();
  };

  describe('api-configuration: disabled sign-in is logged at startup', () => {
    it.each([
      ['unset', undefined],
      ['","', ','],
    ] as const)(
      'no client IDs (%s): one warn entry with the message, and it listens',
      async (_case, clientIds) => {
        const output = await outputOfRunWith(clientIds);
        const entries = disabledEntries(output);

        expect(entries, output).toHaveLength(1);
        expect(entries[0]?.['message']).toBe(DISABLED_MESSAGE);
        expect(entries[0]?.['level']).toBe('warn');
      },
      startupTimeout,
    );

    it(
      'client IDs set: no entry with that message is logged',
      async () => {
        const output = await outputOfRunWith(
          '1-web.apps.googleusercontent.com',
        );

        // Shows the output was captured, so the absence below is not vacuous.
        expect(output.trim()).not.toBe('');
        expect(disabledEntries(output)).toEqual([]);
      },
      startupTimeout,
    );
  });

  describe('every route requires a session unless declared public', () => {
    it(
      'no credentials: GET /me without an Authorization header is a 401 problem with code identity.invalid-session and WWW-Authenticate: Bearer',
      async () => {
        process.env['GOOGLE_CLIENT_IDS'] = '1-web.apps.googleusercontent.com';
        const api = await startApi({ appVersion: '3f2c9e1' });
        try {
          const response = await fetch(`${api.baseUrl}/me`);
          const body = (await response.json()) as Record<string, unknown>;

          expect(response.status).toBe(401);
          expect(response.headers.get('content-type')).toMatch(
            problemContentType,
          );
          expect(body['code']).toBe('identity.invalid-session');
          expect(response.headers.get('www-authenticate')).toBe('Bearer');
        } finally {
          await api.stop();
        }
      },
      startupTimeout,
    );

    it(
      'public routes need no session: GET /health without an Authorization header is 200 with the health report',
      async () => {
        process.env['GOOGLE_CLIENT_IDS'] = '1-web.apps.googleusercontent.com';
        const api = await startApi({ appVersion: '3f2c9e1' });
        try {
          const response = await fetch(`${api.baseUrl}/health`);

          expect(response.status).toBe(200);
          expect(await response.json()).toEqual({
            status: 'ok',
            version: '3f2c9e1',
          });
        } finally {
          await api.stop();
        }
      },
      startupTimeout,
    );
  });
});
