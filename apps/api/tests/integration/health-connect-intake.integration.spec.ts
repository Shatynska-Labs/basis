// Derived from openspec/changes/validate-health-connect-data/specs/health-connect-intake/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md.
//
// The API is exercised over HTTP against a migrated database of the spec's
// own, migrated by running the migration process (`node dist/migrate.js`;
// the `integration` target depends on `build`). The application is the API's
// own `AppModule`, configured from the environment, with the body parsers
// `useBodyParsers(app)` applies (design decision 3) as `main.ts` applies
// them; it listens on a free local port and is requested with `fetch`.
//
// A caller signs in through `POST /auth/google`, as the bridge's operator
// does (design decision 1). Only `identity`'s `GoogleIdTokenVerifier` is
// replaced, through `@nestjs/testing`'s `overrideProvider`, so no test
// reaches Google; every metrics adapter is the real one.
//
// The table is read through the column names design decision 7 gives:
// `metrics.health_connect_deliveries` (`id`, `user_id`, `received_at`,
// `payload`). A second database, migrated and then stripped of that table,
// serves the scenario in which storing a delivery fails (design decision 9).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { GoogleIdTokenVerifier } from '@basis/identity-application';
import { failure, success } from '@basis/shared-core';
import { DomainError } from '@basis/shared-domain';
import { freshDatabase, withClient } from '@basis/shared-testing';
import { type INestApplication, type LoggerService } from '@nestjs/common';
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
import { useBodyParsers } from '../../src/http/body-parsers.js';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));

const CLIENT_ID = '1-web.apps.googleusercontent.com';
const MIB = 1024 * 1024;
const MARKER = 'com.example.marker';

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

/** Rows of `text` with `values`, on a client of the spec's own. Found in identity-authentication.integration.spec.ts. */
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

/** A LoggerService that records every entry, with its level. Found in identity-authentication.integration.spec.ts. */
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

/** An entry's arguments as text, with any `Error` spelled out, its cause included. Found in identity-authentication.integration.spec.ts. */
const serialize = (entry: LogEntry): string =>
  JSON.stringify(entry.args, (_key, value: unknown) =>
    value instanceof Error
      ? {
          name: value.name,
          message: value.message,
          stack: value.stack,
          cause: value.cause,
        }
      : value,
  );

/** Everything written to standard output and standard error while installed. Found in identity-authentication.integration.spec.ts. */
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

/** The Google account a verified ID token yields (add-identity-authentication design decision 1). */
interface GoogleAccount {
  subject: string;
  email: string;
  displayName: string | null;
}

/** The failure the fake verifier returns for an unknown token. Found in identity-authentication.integration.spec.ts. */
class RefusedIdToken extends DomainError {
  readonly kind = 'unauthenticated' as const;
  readonly code = 'identity.invalid-id-token';
}

/** A fake `GoogleIdTokenVerifier`: tokens it was told about verify; any other is refused. Found in identity-authentication.integration.spec.ts. */
const fakeVerifier = () => {
  const accounts = new Map<string, GoogleAccount>();
  return {
    accounts,
    verify: async (idToken: string) => {
      const account = accounts.get(idToken);
      return account
        ? success(account)
        : failure(new RefusedIdToken('The ID token is invalid.'));
    },
  };
};

/** A valid HC Webhook delivery whose JSON is at least `bytes` long: heart-rate samples with metadata. */
const deliveryOfSize = (bytes: number) => {
  const record = {
    bpm: 61,
    time: '2026-10-22T08:00:00Z',
    metadata: {
      id: '00000000-0000-0000-0000-000000000000',
      data_origin: 'com.sec.android.app.shealth',
      recording_method: 'automatically_recorded',
      device: { manufacturer: 'Samsung', model: 'SM-R960', type: 'WATCH' },
      last_modified_time: '2026-10-22T08:05:00Z',
    },
  };
  const perRecord = JSON.stringify(record).length + 1;
  return {
    timestamp: '2026-10-22T08:10:00Z',
    app_version: '1.9.25',
    timezone: 'UTC',
    heart_rate: Array.from(
      { length: Math.ceil(bytes / perRecord) },
      () => record,
    ),
  };
};

// ---------------------------------------------------------------------------

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

const ENV_NAMES = [
  'DATABASE_URL',
  'PORT',
  'APP_VERSION',
  'GOOGLE_CLIENT_IDS',
  'SIGNUP_ALLOWED_EMAILS',
];

const EMAIL_DOMAIN = 'example.org';
const SUBJECTS = Array.from({ length: 30 }, (_, i) => `hc-${i + 1}`);
const ALLOWLIST = SUBJECTS.map((s) => `${s}@${EMAIL_DOMAIN}`).join(',');

/** The delivery the first scenario posts. */
const SCENARIO_DELIVERY = {
  timestamp: '2026-10-22T08:00:00Z',
  app_version: '1.9.25',
  timezone: 'UTC',
  steps: [
    {
      count: 120,
      start_time: '2026-10-22T07:00:00Z',
      end_time: '2026-10-22T07:15:00Z',
    },
  ],
};

interface Running {
  app: INestApplication;
  baseUrl: string;
}

interface Caller {
  token: string;
  userId: string;
}

interface StoredDelivery {
  user_id: string;
  received_at: Date;
  payload: unknown;
}

describe('health-connect-intake (against a migrated database)', () => {
  let url: string;
  let failingUrl: string;
  const verifier = fakeVerifier();
  const captured = capturingLogger();
  const saved: Record<string, string | undefined> = {};
  let api: Running;
  /** The API over a database whose `metrics.health_connect_deliveries` was dropped. */
  let failing: Running;

  const start = async (databaseUrl: string): Promise<Running> => {
    process.env['DATABASE_URL'] = databaseUrl;
    delete process.env['PORT'];
    process.env['APP_VERSION'] = '3f2c9e1';
    process.env['GOOGLE_CLIENT_IDS'] = CLIENT_ID;
    process.env['SIGNUP_ALLOWED_EMAILS'] = ALLOWLIST;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(verifier)
      .compile();
    const app = moduleRef.createNestApplication({ logger: captured.logger });
    useBodyParsers(app);
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

    failingUrl = await freshDatabase(inject('postgresUrl'));
    const failingRun = migrate({ DATABASE_URL: failingUrl });
    expect(failingRun.status, failingRun.output).toBe(0);
    await query(failingUrl, 'drop table metrics.health_connect_deliveries');

    api = await start(url);
    failing = await start(failingUrl);
  }, 120_000);

  afterAll(async () => {
    await api?.app.close();
    await failing?.app.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    captured.entries.length = 0;
  });

  // --- Helpers over HTTP and the table -------------------------------------

  let subjectIndex = 0;
  /** Signs a new user in through `on`, failing unless it answers 200, and returns the session token and user id. */
  const newCaller = async (on: Running = api): Promise<Caller> => {
    const subject = SUBJECTS[subjectIndex];
    subjectIndex += 1;
    if (!subject) throw new Error('add subjects to SUBJECTS');
    const idToken = `id-token-${subject}`;
    verifier.accounts.set(idToken, {
      subject,
      email: `${subject}@${EMAIL_DOMAIN}`,
      displayName: null,
    });
    const response = await fetch(`${on.baseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const body = (await response.json()) as { token?: unknown };
    expect(response.status, JSON.stringify(body)).toBe(200);
    const databaseUrl = on === failing ? failingUrl : url;
    const [user] = await query<{ id: string }>(
      databaseUrl,
      'select id::text as id from identity.users where google_subject = $1',
      [subject],
    );
    expect(user?.id).toBeTypeOf('string');
    return { token: body.token as string, userId: user?.id as string };
  };

  const postDelivery = (
    caller: Caller | undefined,
    body: unknown,
    options: { on?: Running; path?: string } = {},
  ) =>
    fetch(
      `${(options.on ?? api).baseUrl}${options.path ?? '/health-connect/deliveries'}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(caller ? { authorization: `Bearer ${caller.token}` } : {}),
        },
        body: JSON.stringify(body),
      },
    );

  const summaryOf = (caller: Caller) =>
    fetch(`${api.baseUrl}/health-connect/deliveries/summary`, {
      headers: { authorization: `Bearer ${caller.token}` },
    });

  const deliveriesOf = (userId: string) =>
    query<StoredDelivery & Record<string, unknown>>(
      url,
      `select user_id::text as user_id, received_at, payload
         from metrics.health_connect_deliveries
        where user_id::text = $1
        order by received_at`,
      [userId],
    );

  const deliveryCount = async () =>
    Number(
      (
        await query<{ count: string }>(
          url,
          'select count(*)::text as count from metrics.health_connect_deliveries',
        )
      )[0]?.count ?? 0,
    );

  // --- Storing ---------------------------------------------------------------

  describe("a signed-in caller's Health Connect delivery is stored as received", () => {
    it('a delivery is stored with its caller', async () => {
      const caller = await newCaller();
      const before = Date.now();

      const response = await postDelivery(caller, SCENARIO_DELIVERY);
      const text = await response.text();
      const after = Date.now();

      expect(response.status).toBe(204);
      expect(text).toBe('');
      const stored = await deliveriesOf(caller.userId);
      expect(stored).toHaveLength(1);
      expect(stored[0]?.user_id).toBe(caller.userId);
      expect(stored[0]?.payload).toEqual(SCENARIO_DELIVERY);
      // The arrival time is the request's: the database's clock, read within
      // 5 seconds of this process's (derived tolerance).
      const receivedAt = stored[0]?.received_at.getTime() ?? 0;
      expect(receivedAt).toBeGreaterThanOrEqual(before - 5_000);
      expect(receivedAt).toBeLessThanOrEqual(after + 5_000);
    });

    it('unknown keys are kept', async () => {
      const caller = await newCaller();
      const futureType = [{ value: 3, nested: { kept: true } }, 'and a string'];

      const response = await postDelivery(caller, {
        ...SCENARIO_DELIVERY,
        future_type: futureType,
      });
      await response.text();

      expect(response.status).toBe(204);
      const [stored] = await deliveriesOf(caller.userId);
      expect(
        (stored?.payload as Record<string, unknown>)['future_type'],
      ).toEqual(futureType);
    });

    it('a repeated delivery is stored twice', async () => {
      const caller = await newCaller();

      const first = await postDelivery(caller, SCENARIO_DELIVERY);
      await first.text();
      const second = await postDelivery(caller, SCENARIO_DELIVERY);
      await second.text();

      expect([first.status, second.status]).toEqual([204, 204]);
      const stored = await deliveriesOf(caller.userId);
      expect(stored).toHaveLength(2);
      expect(stored.map((row) => row.payload)).toEqual([
        SCENARIO_DELIVERY,
        SCENARIO_DELIVERY,
      ]);
    });
  });

  // --- Refusing ------------------------------------------------------------

  describe('the intake refuses what is not a signed-in delivery', () => {
    it.each([
      ['{ "app_version": "1.9.25" }', { app_version: '1.9.25' }],
      ['a JSON array', [SCENARIO_DELIVERY]],
    ] as const)(
      'a body that is not a delivery is refused: %s is 400 and nothing is stored',
      async (_case, body) => {
        const caller = await newCaller();

        const response = await postDelivery(caller, body);
        await response.text();

        expect(response.status).toBe(400);
        // Derived: answered as a problem document (api-http-errors).
        expect(response.headers.get('content-type')).toMatch(
          problemContentType,
        );
        expect(await deliveriesOf(caller.userId)).toEqual([]);
      },
    );

    it('a delivery without a session is refused: 401 and nothing is stored', async () => {
      const before = await deliveryCount();

      const response = await postDelivery(undefined, SCENARIO_DELIVERY);
      await response.text();

      expect(response.status).toBe(401);
      expect(await deliveryCount()).toBe(before);
    });
  });

  // --- Size ----------------------------------------------------------------

  describe('the intake route accepts deliveries up to 10 MB', () => {
    it('a large delivery reaches the intake route: a valid 2 MB delivery is 204', async () => {
      const caller = await newCaller();
      const large = deliveryOfSize(2 * MIB);
      expect(JSON.stringify(large).length).toBeGreaterThanOrEqual(2 * MIB);

      const response = await postDelivery(caller, large);
      await response.text();

      expect(response.status).toBe(204);
      expect(await deliveriesOf(caller.userId)).toHaveLength(1);
    });

    it('with a trailing slash, a valid 2 MB delivery is 204 too (derived from design decision 3)', async () => {
      const caller = await newCaller();

      const response = await postDelivery(caller, deliveryOfSize(2 * MIB), {
        path: '/health-connect/deliveries/',
      });
      await response.text();

      expect(response.status).toBe(204);
    });
  });

  // --- The summary ---------------------------------------------------------

  describe("the summary covers the caller's deliveries", () => {
    it('no deliveries yet: 200, count 0, no arrival times, empty types, delays and deleted, no sleep and no exercise', async () => {
      const caller = await newCaller();

      const response = await summaryOf(caller);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body['deliveries']).toMatchObject({
        count: 0,
        firstReceivedAt: null,
        lastReceivedAt: null,
      });
      expect(body['types']).toEqual({});
      expect(body['delays']).toEqual({});
      expect(body['deleted']).toEqual({});
      expect(body).not.toHaveProperty('sleep');
      expect(body).not.toHaveProperty('exercise');
    });

    it("another user's deliveries are not summarised", async () => {
      const a = await newCaller();
      const b = await newCaller();
      for (const caller of [a, a, b]) {
        const response = await postDelivery(caller, SCENARIO_DELIVERY);
        await response.text();
        expect(response.status).toBe(204);
      }

      const response = await summaryOf(b);
      const body = (await response.json()) as {
        deliveries: { count: number };
      };

      expect(response.status).toBe(200);
      expect(body.deliveries.count).toBe(1);
    });

    it('the arrival times are ISO 8601 instants, and the app versions and timezones are reported (specified by the requirement text)', async () => {
      const caller = await newCaller();
      await (await postDelivery(caller, SCENARIO_DELIVERY)).text();

      const body = (await (await summaryOf(caller)).json()) as {
        deliveries: {
          firstReceivedAt: string;
          lastReceivedAt: string;
          appVersions: string[];
          timezones: string[];
        };
      };

      const [stored] = await deliveriesOf(caller.userId);
      expect(new Date(body.deliveries.firstReceivedAt).getTime()).toBe(
        stored?.received_at.getTime(),
      );
      expect(new Date(body.deliveries.lastReceivedAt).getTime()).toBe(
        stored?.received_at.getTime(),
      );
      expect(body.deliveries.appVersions).toEqual(['1.9.25']);
      expect(body.deliveries.timezones).toEqual(['UTC']);
    });

    it('types are counted by origin, method and device, over HTTP (specified; the same scenario as the unit spec, through the stored payload)', async () => {
      const caller = await newCaller();
      const heartRate = (method: string, time: string) => ({
        bpm: 61,
        time,
        metadata: {
          id: time,
          data_origin: 'com.sec.android.app.shealth',
          recording_method: method,
          device: { manufacturer: 'Samsung', model: 'SM-R960', type: 'WATCH' },
          last_modified_time: '2026-10-22T08:10:00Z',
        },
      });
      await (
        await postDelivery(caller, {
          timestamp: '2026-10-22T08:15:00Z',
          app_version: '1.9.25',
          timezone: 'UTC',
          heart_rate: [
            heartRate('automatically_recorded', '2026-10-22T08:00:00Z'),
            heartRate('automatically_recorded', '2026-10-22T08:01:00Z'),
            heartRate('actively_recorded', '2026-10-22T08:02:00Z'),
          ],
          steps: [
            {
              count: 120,
              start_time: '2026-10-22T07:00:00Z',
              end_time: '2026-10-22T07:15:00Z',
            },
          ],
        })
      ).text();

      const response = await summaryOf(caller);
      const body = (await response.json()) as {
        types: Record<string, Record<string, unknown>>;
      };

      expect(response.status).toBe(200);
      expect(body.types['heart_rate']).toMatchObject({
        records: 3,
        origins: { 'com.sec.android.app.shealth': 3 },
        recordingMethods: { automatically_recorded: 2, actively_recorded: 1 },
        devices: { 'Samsung SM-R960 (WATCH)': 3 },
      });
      expect(body.types['steps']).toMatchObject({
        origins: { unknown: 1 },
        recordingMethods: { unknown: 1 },
        devices: { unknown: 1 },
      });
    });

    it('malformed values are counted as unknown or skipped: the summary is 200', async () => {
      const caller = await newCaller();
      const stored = await postDelivery(caller, {
        timestamp: '2026-10-22T08:15:00Z',
        app_version: '1.9.25',
        heart_rate: [{ bpm: 61, metadata: 'not an object', time: 1729584000 }],
        sleep: { stages: [{ stage: 'LIGHT' }] },
      });
      await stored.text();
      expect(stored.status).toBe(204);

      const response = await summaryOf(caller);
      const body = (await response.json()) as {
        types: Record<string, Record<string, unknown>>;
        delays: Record<string, unknown>;
      } & Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.types['heart_rate']).toMatchObject({
        origins: { unknown: 1 },
        recordingMethods: { unknown: 1 },
        devices: { unknown: 1 },
        firstRecordAt: null,
        lastRecordAt: null,
      });
      expect(body.delays).not.toHaveProperty('heart_rate');
      expect(body).not.toHaveProperty('sleep');
    });
  });

  // --- Logs ----------------------------------------------------------------

  describe("a delivery's contents are not logged", () => {
    let output: ReturnType<typeof captureOutput> | undefined;

    afterEach(() => {
      output?.restore();
      output = undefined;
    });

    const everythingLogged = () =>
      `${captured.entries.map(serialize).join('\n')}\n${output?.written() ?? ''}`;

    const markedDelivery = {
      timestamp: '2026-10-22T08:15:00Z',
      app_version: '1.9.25',
      timezone: 'UTC',
      heart_rate: [
        {
          bpm: 61,
          time: '2026-10-22T08:00:00Z',
          metadata: { data_origin: MARKER },
        },
      ],
    };

    it('a stored delivery leaves no trace of its values in the logs', async () => {
      const caller = await newCaller();
      output = captureOutput();

      const response = await postDelivery(caller, markedDelivery);
      await response.text();
      // Derived: reading the summary logs none of its values either.
      await (await summaryOf(caller)).text();
      output.restore();

      expect(response.status).toBe(204);
      expect(everythingLogged()).not.toContain(MARKER);
    });

    it('a refused delivery leaves no trace of its values in the logs', async () => {
      const caller = await newCaller();
      output = captureOutput();

      const response = await postDelivery(caller, {
        app_version: '1.9.25',
        marker: MARKER,
      });
      const text = await response.text();
      output.restore();

      expect(response.status).toBe(400);
      expect(everythingLogged()).not.toContain(MARKER);
      // Derived from design decision 8: a 400 problem carries paths and messages, not values.
      expect(text).not.toContain(MARKER);
    });

    it('a delivery that fails to be stored leaves no trace of its values in the logs', async () => {
      const caller = await newCaller(failing);
      output = captureOutput();

      const response = await postDelivery(caller, markedDelivery, {
        on: failing,
      });
      const text = await response.text();
      output.restore();

      expect(response.status).toBe(500);
      const errors = captured.entries.filter((e) => e.level === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(everythingLogged()).not.toContain(MARKER);
      expect(text).not.toContain(MARKER);
      // Derived from design decision 8: the defect logged is
      // HealthConnectDeliveryNotStored, with its fixed message.
      expect(errors.map(serialize).join('\n')).toContain(
        'The Health Connect delivery could not be stored.',
      );
    });
  });
});
