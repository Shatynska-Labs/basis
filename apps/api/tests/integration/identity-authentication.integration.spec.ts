// Derived from openspec/changes/add-identity-authentication/specs/identity-authentication/spec.md
// and specs/shared-infrastructure/spec.md ("A route reads its caller") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md.
//
// The API is exercised over HTTP against a migrated database of the spec's
// own (design decision 15: `apps/api` owns the migration history). The
// database is migrated by running the migration process as
// migrate.integration.spec.ts does (`node dist/migrate.js`; the
// `integration` target depends on `build`). The application is the API's own
// `AppModule`, configured from the environment, imported by a spec-local
// module that adds a controller outside `identity`; it listens on a free
// local port and is requested with `fetch`.
//
// Two of the application's ports are replaced, through `@nestjs/testing`'s
// `overrideProvider` (an unresolved project question in test-plan.md):
//   - `GoogleIdTokenVerifier`, so no test reaches Google: a fake whose
//     `verify(idToken)` resolves to a `Result` (success
//     `{ subject, email, displayName }`, or a failure of kind
//     `unauthenticated`, code `identity.invalid-id-token`) or, for one token,
//     throws, as the real verifier does when Google's key set cannot be
//     obtained (design decision 1);
//   - `Clock`, so creation and expiry can be fixed: a fake whose `now()`
//     returns a `Date`.
// Both are assumed exported from @basis/identity-application as abstract
// classes serving as their own injection tokens. Every other adapter is the
// real one: the Drizzle repositories, the guard and the controllers.
//
// The tables are read through the column names design decisions 2, 4 and 14
// give: `identity.users` (`id`, `google_subject`, `email`, `display_name`)
// and `identity.sessions` (`token_hash`, `user_id`, `created_at`,
// `expires_at`, `revoked_at`).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Clock, GoogleIdTokenVerifier } from '@basis/identity-application';
import { failure, success } from '@basis/shared-core';
import { DomainError } from '@basis/shared-domain';
import {
  type AuthenticatedUser,
  CurrentUser,
  Public,
} from '@basis/shared-infrastructure';
import { freshDatabase, withClient } from '@basis/shared-testing';
import {
  Controller,
  Get,
  type INestApplication,
  type LoggerService,
  Module,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../../src/app.module.js';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));

const CLIENT_ID = '1-web.apps.googleusercontent.com';
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Rows of `text` with `values`, on a client of the spec's own. */
const query = <R extends Record<string, unknown>>(
  url: string,
  text: string,
  values: unknown[] = [],
) =>
  withClient(url, async (client) => (await client.query<R>(text, values)).rows);

interface LogEntry {
  level: string;
  args: unknown[];
}

/** A LoggerService that records every entry, with its level. Found in http-errors.spec.ts. */
const capturingLogger = () => {
  const entries: LogEntry[] = [];
  const at =
    (level: string) =>
    (...args: unknown[]) => {
      entries.push({ level, args });
    };
  const logger: LoggerService = {
    log: at('log'),
    error: at('error'),
    warn: at('warn'),
    debug: at('debug'),
    verbose: at('verbose'),
    fatal: at('fatal'),
  };
  return { logger, entries };
};

/** An entry's arguments as text, with any `Error` spelled out. Found in http-errors.spec.ts. */
const serialize = (entry: LogEntry): string =>
  JSON.stringify(entry.args, (_key, value: unknown) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value,
  );

/** The Google account a verified ID token yields (design decision 1). */
interface GoogleAccount {
  subject: string;
  email: string;
  displayName: string | null;
}

/** The failure the fake verifier returns: the shape of `InvalidIdToken` (design decision 5). */
class RefusedIdToken extends DomainError {
  readonly kind = 'unauthenticated' as const;
  readonly code = 'identity.invalid-id-token';
}

/** The ID token for which the fake verifier throws, as when Google's key set cannot be fetched. */
const KEY_SET_UNAVAILABLE = 'id-token-while-google-is-unreachable';

/** A fake `GoogleIdTokenVerifier`: tokens it was told about verify; any other is refused. */
const fakeVerifier = () => {
  const accounts = new Map<string, GoogleAccount>();
  const calls: string[] = [];
  return {
    accounts,
    calls,
    verify: async (idToken: string) => {
      calls.push(idToken);
      if (idToken === KEY_SET_UNAVAILABLE)
        throw new Error('Expected 200 OK from the JSON Web Key Set response');
      const account = accounts.get(idToken);
      return account
        ? success(account)
        : failure(new RefusedIdToken('The ID token is invalid.'));
    },
  };
};

/** A fake `Clock` whose time the test sets. */
const fakeClock = () => {
  const clock = { current: new Date(), now: () => new Date(clock.current) };
  return clock;
};

/** Everything written to standard output and standard error while installed. Found in logger.spec.ts. */
const captureOutput = () => {
  let written = '';
  const record = (chunk: unknown) => {
    written += typeof chunk === 'string' ? chunk : String(chunk);
    return true;
  };
  const stdout = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(record as typeof process.stdout.write);
  const stderr = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(record as typeof process.stderr.write);
  return {
    written: () => written,
    restore: () => {
      stdout.mockRestore();
      stderr.mockRestore();
    },
  };
};

/** A controller outside `identity` that reads its caller from the shared infrastructure. */
@Controller('probe-caller')
class CallerController {
  @Get()
  caller(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Public()
  @Get('public')
  open() {
    return { reached: true };
  }
}

@Module({ imports: [AppModule], controllers: [CallerController] })
class ProbeModule {}

// ---------------------------------------------------------------------------

const sha256Hex = (text: string) =>
  createHash('sha256').update(text).digest('hex');

const problemContentType = /^application\/problem\+json\s*(;|$)/i;
const isoWithOffset =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const ENV_NAMES = [
  'DATABASE_URL',
  'PORT',
  'APP_VERSION',
  'GOOGLE_CLIENT_IDS',
  'SIGNUP_ALLOWED_EMAILS',
];

/** Every email any test signs up with, so the allowlisted application admits them. */
const ALLOWLIST = [
  'ann@example.org',
  'old@example.org',
  'erin@example.org',
  'frank@example.org',
  'gina@example.org',
  'hank@example.org',
  'ivy@example.org',
  'jack@example.org',
  'kate@example.org',
  'liam@example.org',
  'mia@example.org',
  'noah@example.org',
  'olga@example.org',
];

interface Running {
  app: INestApplication;
  baseUrl: string;
}

describe('identity-authentication (against a migrated database)', () => {
  let url: string;
  const verifier = fakeVerifier();
  const clock = fakeClock();
  const captured = capturingLogger();
  const saved: Record<string, string | undefined> = {};
  /** The API with every test's email on the sign-up allowlist. */
  let allowing: Running;
  /** The API with no sign-up allowlist. */
  let closed: Running;

  const start = async (allowlist: string | undefined): Promise<Running> => {
    process.env['DATABASE_URL'] = url;
    delete process.env['PORT'];
    process.env['APP_VERSION'] = '3f2c9e1';
    process.env['GOOGLE_CLIENT_IDS'] = CLIENT_ID;
    if (allowlist === undefined) delete process.env['SIGNUP_ALLOWED_EMAILS'];
    else process.env['SIGNUP_ALLOWED_EMAILS'] = allowlist;

    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(verifier)
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    const app = moduleRef.createNestApplication({ logger: captured.logger });
    await app.listen(0, '127.0.0.1');
    return {
      app,
      baseUrl: (await app.getUrl()).replace('[::1]', '127.0.0.1'),
    };
  };

  beforeAll(async () => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    url = await freshDatabase(inject('postgresUrl'));
    const run = migrate({ DATABASE_URL: url });
    expect(run.status, run.output).toBe(0);

    allowing = await start(ALLOWLIST.join(','));
    closed = await start(undefined);
  }, 120_000);

  afterAll(async () => {
    await allowing?.app.close();
    await closed?.app.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    captured.entries.length = 0;
    verifier.calls.length = 0;
    clock.current = new Date();
  });

  // --- Helpers over HTTP and the tables ------------------------------------

  /** Registers an ID token the fake verifier accepts for `account`, and returns it. */
  let tokenCount = 0;
  const idTokenFor = (account: GoogleAccount) => {
    tokenCount += 1;
    const idToken = `id-token-${tokenCount}-${account.subject}`;
    verifier.accounts.set(idToken, account);
    return idToken;
  };

  const signIn = (api: Running, idToken: string) =>
    fetch(`${api.baseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

  /** Signs `account` in through `api` and returns the session token, failing unless it answers 200. */
  const sessionFor = async (account: GoogleAccount, api = allowing) => {
    const response = await signIn(api, idTokenFor(account));
    const body = (await response.json()) as { token?: unknown };
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(typeof body.token).toBe('string');
    return body.token as string;
  };

  const getMe = (token: string, scheme = 'Bearer', api = allowing) =>
    fetch(`${api.baseUrl}/me`, {
      headers: { authorization: `${scheme} ${token}` },
    });

  const signOut = (token: string, api = allowing) =>
    fetch(`${api.baseUrl}/auth/sign-out`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

  const userBySubject = async (subject: string) =>
    (
      await query<{ id: string; email: string; display_name: string | null }>(
        url,
        'select id::text as id, email, display_name from identity.users where google_subject = $1',
        [subject],
      )
    )[0];

  const usersWithSubject = async (subject: string) =>
    Number(
      (
        await query<{ count: string }>(
          url,
          'select count(*)::text as count from identity.users where google_subject = $1',
          [subject],
        )
      )[0]?.count ?? 0,
    );

  const sessionCount = async () =>
    Number(
      (
        await query<{ count: string }>(
          url,
          'select count(*)::text as count from identity.sessions',
        )
      )[0]?.count ?? 0,
    );

  const sessionsOf = (userId: string) =>
    query<{
      token_hash: string;
      user_id: string;
      created_at: Date;
      expires_at: Date;
      revoked_at: Date | null;
      row: string;
    }>(
      url,
      `select token_hash, user_id::text as user_id, created_at, expires_at, revoked_at,
              row_to_json(s)::text as row
         from identity.sessions s where user_id::text = $1`,
      [userId],
    );

  // --- Signing in ----------------------------------------------------------

  describe('signing in with Google opens a session', () => {
    it('a known Google account signs in', async () => {
      await sessionFor({
        subject: '1098',
        email: 'old@example.org',
        displayName: 'Old Name',
      });
      expect((await userBySubject('1098'))?.email).toBe('old@example.org');

      const response = await signIn(
        allowing,
        idTokenFor({
          subject: '1098',
          email: 'ann@example.org',
          displayName: 'Ann',
        }),
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(typeof body['token']).toBe('string');
      expect(typeof body['expiresAt']).toBe('string');
      const user = await userBySubject('1098');
      expect(user?.email).toBe('ann@example.org');
      // Specified by the requirement text: email and display name are updated.
      expect(user?.display_name).toBe('Ann');
      // Derived from design decision 4: still one user for the subject.
      expect(await usersWithSubject('1098')).toBe(1);
    });

    it('the response body is exactly { token, expiresAt } (specified by the requirement text)', async () => {
      const response = await signIn(
        allowing,
        idTokenFor({
          subject: '1100',
          email: 'olga@example.org',
          displayName: null,
        }),
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(['expiresAt', 'token']);
    });

    it('an invalid token is refused', async () => {
      const before = await sessionCount();

      const response = await signIn(allowing, 'an-id-token-that-fails');
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(body['code']).toBe('identity.invalid-id-token');
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(await sessionCount()).toBe(before);
    });

    it.each([
      ['{}', {}],
      ['{ "idToken": "" }', { idToken: '' }],
    ] as const)(
      'a body without a token is refused: %s is a 400 problem, and the verifier is not called (derived: the schema refuses it before any handler)',
      async (_case, body) => {
        const response = await fetch(`${allowing.baseUrl}/auth/google`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        await response.text();

        expect(response.status).toBe(400);
        expect(response.headers.get('content-type')).toMatch(
          problemContentType,
        );
        expect(verifier.calls).toEqual([]);
      },
    );
  });

  describe("google's key set cannot be obtained", () => {
    it('POST /auth/google answers 500 with a problem holding only type, title and status, and the failure is logged', async () => {
      const response = await signIn(allowing, KEY_SET_UNAVAILABLE);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(Object.keys(JSON.parse(text) as object).sort()).toEqual([
        'status',
        'title',
        'type',
      ]);
      expect(text).not.toContain('identity.invalid-id-token');
      expect(captured.entries.filter((e) => e.level === 'error')).toHaveLength(
        1,
      );
    });
  });

  // --- The allowlist -------------------------------------------------------

  describe('only an allowed email can create an account', () => {
    it('an allowed email creates an account', async () => {
      expect(await usersWithSubject('2001')).toBe(0);

      const response = await signIn(
        allowing,
        idTokenFor({
          subject: '2001',
          email: 'Ann@Example.org',
          displayName: 'Ann',
        }),
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(typeof body['token']).toBe('string');
      expect(await usersWithSubject('2001')).toBe(1);
      expect((await userBySubject('2001'))?.email).toBe('Ann@Example.org');
    });

    it('an email not on the list is refused', async () => {
      const sessionsBefore = await sessionCount();

      const response = await signIn(
        allowing,
        idTokenFor({
          subject: '2002',
          email: 'bob@example.org',
          displayName: 'Bob',
        }),
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(403);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(body['code']).toBe('identity.sign-up-not-allowed');
      expect(await usersWithSubject('2002')).toBe(0);
      expect(await sessionCount()).toBe(sessionsBefore);
    });

    it('an empty allowlist admits nobody new', async () => {
      const response = await signIn(
        closed,
        idTokenFor({
          subject: '2003',
          email: 'ann@example.org',
          displayName: 'Ann',
        }),
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(403);
      expect(body['code']).toBe('identity.sign-up-not-allowed');
      // Specified by the requirement text: creating nothing.
      expect(await usersWithSubject('2003')).toBe(0);
    });

    it('a known account outside the list still signs in', async () => {
      await sessionFor({
        subject: '1099',
        email: 'erin@example.org',
        displayName: 'Erin',
      });

      const response = await signIn(
        closed,
        idTokenFor({
          subject: '1099',
          email: 'erin@example.org',
          displayName: 'Erin',
        }),
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(typeof body['token']).toBe('string');
    });
  });

  // --- Session tokens ------------------------------------------------------

  describe('a session token is random, returned once and stored as a hash', () => {
    it('the stored session does not hold the token', async () => {
      clock.current = new Date('2026-10-20T10:00:00Z');

      const response = await signIn(
        allowing,
        idTokenFor({
          subject: '3001',
          email: 'frank@example.org',
          displayName: 'Frank',
        }),
      );
      const body = (await response.json()) as {
        token: string;
        expiresAt: string;
      };

      expect(response.status).toBe(200);
      expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const user = await userBySubject('3001');
      const sessions = await sessionsOf(user?.id ?? '(no user)');
      expect(sessions).toHaveLength(1);
      const [session] = sessions;
      expect(session?.token_hash).toBe(sha256Hex(body.token));
      expect(session?.row).not.toContain(body.token);
      expect(session?.user_id).toBe(user?.id);
      expect(session?.expires_at.toISOString()).toBe(
        '2026-11-19T10:00:00.000Z',
      );
      expect(body.expiresAt).toMatch(isoWithOffset);
      expect(new Date(body.expiresAt).toISOString()).toBe(
        '2026-11-19T10:00:00.000Z',
      );
      // Derived: the expiry is 30 days after the creation time, so the
      // creation time stored is the sign-in's.
      expect(session?.created_at.toISOString()).toBe(
        '2026-10-20T10:00:00.000Z',
      );
      expect(session?.revoked_at).toBeNull();
    });

    it('concurrent first sign-ins of one account', async () => {
      const account = {
        subject: '3002',
        email: 'gina@example.org',
        displayName: 'Gina',
      };

      const responses = await Promise.all([
        signIn(allowing, idTokenFor(account)),
        signIn(allowing, idTokenFor(account)),
      ]);
      await Promise.all(responses.map((response) => response.text()));

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(await usersWithSubject('3002')).toBe(1);
    });

    it('two sign-ins get different tokens', async () => {
      const account = {
        subject: '3003',
        email: 'hank@example.org',
        displayName: 'Hank',
      };

      const first = await sessionFor(account);
      const second = await sessionFor(account);

      expect(first).not.toBe(second);
      const user = await userBySubject('3003');
      expect(await sessionsOf(user?.id ?? '(no user)')).toHaveLength(2);
    });
  });

  // --- The session requirement ---------------------------------------------

  describe('every route requires a session unless declared public', () => {
    const expectInvalidSession = async (response: Response) => {
      const body = (await response.json()) as Record<string, unknown>;
      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(body['code']).toBe('identity.invalid-session');
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    };

    it('no credentials: GET /me without an Authorization header', async () => {
      await expectInvalidSession(await fetch(`${allowing.baseUrl}/me`));
    });

    it('an unknown session: a token with no stored session', async () => {
      await expectInvalidSession(
        await getMe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
      );
    });

    it('an expired session: one whose expiry has passed', async () => {
      clock.current = new Date(Date.now() - 31 * DAY_MS);
      const token = await sessionFor({
        subject: '4001',
        email: 'ivy@example.org',
        displayName: 'Ivy',
      });
      clock.current = new Date();

      await expectInvalidSession(await getMe(token));
    });

    it('a session 29 days old still authenticates (specified by the requirement text "an expiry 30 days after creation"; control for the expiry above)', async () => {
      clock.current = new Date(Date.now() - 29 * DAY_MS);
      const token = await sessionFor({
        subject: '4003',
        email: 'ivy@example.org',
        displayName: 'Ivy',
      });
      clock.current = new Date();

      const response = await getMe(token);
      await response.text();

      expect(response.status).toBe(200);
    });

    it('a revoked session: one that was revoked', async () => {
      const token = await sessionFor({
        subject: '4002',
        email: 'jack@example.org',
        displayName: 'Jack',
      });
      const out = await signOut(token);
      await out.text();
      expect(out.status).toBe(204);

      await expectInvalidSession(await getMe(token));
    });

    it("a valid session passes: the request reaches the route as that session's user", async () => {
      const token = await sessionFor({
        subject: '4004',
        email: 'kate@example.org',
        displayName: 'Kate',
      });

      const response = await getMe(token);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body['id']).toBe((await userBySubject('4004'))?.id);
    });

    it('the scheme is case-insensitive: authorization: bearer <valid token>', async () => {
      const token = await sessionFor({
        subject: '4005',
        email: 'liam@example.org',
        displayName: 'Liam',
      });

      const response = await getMe(token, 'bearer');
      await response.text();

      expect(response.status).toBe(200);
    });

    it('public routes need no session: GET /health without an Authorization header', async () => {
      const response = await fetch(`${allowing.baseUrl}/health`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'ok',
        version: '3f2c9e1',
      });
    });
  });

  // --- The caller ----------------------------------------------------------

  describe('the current user can be read', () => {
    it('the caller reads themselves', async () => {
      const token = await sessionFor({
        subject: '5001',
        email: 'ann@example.org',
        displayName: 'Ann',
      });
      const id = (await userBySubject('5001'))?.id;

      const response = await getMe(token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id,
        email: 'ann@example.org',
        displayName: 'Ann',
      });
    });

    it('displayName is null when Google gave no name (specified by the requirement text)', async () => {
      const token = await sessionFor({
        subject: '5002',
        email: 'mia@example.org',
        displayName: null,
      });

      const response = await getMe(token);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body['displayName']).toBeNull();
    });
  });

  describe('shared-infrastructure: other contexts read the caller from the shared infrastructure', () => {
    it("a route reads its caller: @CurrentUser() outside identity is { userId } of the session's user", async () => {
      const token = await sessionFor({
        subject: '5003',
        email: 'noah@example.org',
        displayName: 'Noah',
      });
      const id = (await userBySubject('5003'))?.id;

      const response = await fetch(`${allowing.baseUrl}/probe-caller`, {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ user: { userId: id } });
    });

    it('a declared public route outside identity is not refused without credentials', async () => {
      const response = await fetch(`${allowing.baseUrl}/probe-caller/public`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ reached: true });
    });
  });

  // --- Signing out ---------------------------------------------------------

  describe('signing out revokes the presented session', () => {
    it('a revoked session no longer authenticates, and the other stays valid', async () => {
      const account = {
        subject: '6001',
        email: 'olga@example.org',
        displayName: 'Olga',
      };
      const a = await sessionFor(account);
      const b = await sessionFor(account);

      const out = await signOut(a);
      await out.text();
      const withA = await getMe(a);
      await withA.text();
      const withB = await getMe(b);
      await withB.text();

      expect(out.status).toBe(204);
      expect(withA.status).toBe(401);
      expect(withB.status).toBe(200);
    });

    it('signing out marks the session revoked rather than leaving it valid (derived from design decision 2: revoked_at)', async () => {
      const token = await sessionFor({
        subject: '6002',
        email: 'olga@example.org',
        displayName: 'Olga',
      });
      const id = (await userBySubject('6002'))?.id ?? '(no user)';

      await (await signOut(token)).text();

      const [session] = await sessionsOf(id);
      expect(session?.revoked_at).not.toBeNull();
    });
  });

  // --- Logs ----------------------------------------------------------------

  describe('session tokens and ID tokens are not logged', () => {
    let output: ReturnType<typeof captureOutput> | undefined;

    afterEach(() => {
      output?.restore();
      output = undefined;
    });

    const everythingLogged = () =>
      `${captured.entries.map(serialize).join('\n')}\n${output?.written() ?? ''}`;

    it('a refused sign-in is not logged with its token', async () => {
      const idToken = 'eyJhbGciOiJSUzI1NiJ9.e30.c2ln';
      output = captureOutput();

      const response = await signIn(allowing, idToken);
      await response.text();
      output.restore();

      expect(response.status).toBe(401);
      expect(everythingLogged()).not.toContain(idToken);
    });

    it('a successful sign-in is not logged with its token', async () => {
      const account = {
        subject: '7001',
        email: 'ann@example.org',
        displayName: 'Ann',
      };
      const idToken = idTokenFor(account);
      output = captureOutput();

      const response = await signIn(allowing, idToken);
      const body = (await response.json()) as { token: string };
      // Derived: the token is not logged when it is used and revoked either.
      await (await getMe(body.token)).text();
      await (await signOut(body.token)).text();
      output.restore();

      expect(response.status).toBe(200);
      const logged = everythingLogged();
      expect(logged).not.toContain(body.token);
      expect(logged).not.toContain(sha256Hex(body.token));
      // Specified by the requirement text: nor the Google ID token.
      expect(logged).not.toContain(idToken);
    });
  });
});
