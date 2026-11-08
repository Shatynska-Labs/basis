// Derived from openspec/changes/add-identity-profile/specs/identity-profile/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md.
//
// The API is exercised over HTTP against a migrated database of the spec's
// own, as identity-authentication.integration.spec.ts exercises it: the
// database is migrated by running the migration process (`node
// dist/migrate.js`; the `integration` target depends on `build`), and the
// application is the API's own `AppModule`, configured from the environment,
// listening on a free local port and requested with `fetch`.
//
// Two of the application's ports are replaced through `@nestjs/testing`'s
// `overrideProvider`, as identity-authentication.integration.spec.ts replaces
// them: `GoogleIdTokenVerifier`, so a test signs in without Google, and
// `Clock`, so the current date the birth year and the age are read against
// can be fixed. Both are exported from @basis/identity-application as
// abstract classes serving as their own injection tokens. The profile's
// handlers are assumed to read the time from that same `Clock` (design
// decision 6; an unresolved project question in test-plan.md). Every other
// adapter is the real one: the Drizzle repositories and readers, the guard,
// the pipe and the controllers. Sessions take their creation and expiry from
// the same clock, so each test sets the clock before it signs in.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Clock, GoogleIdTokenVerifier } from '@basis/identity-application';
import { failure, success } from '@basis/shared-core';
import { DomainError } from '@basis/shared-domain';
import { freshDatabase } from '@basis/shared-testing';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest';

import { AppModule } from '../../src/app.module.js';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));

const CLIENT_ID = '1-web.apps.googleusercontent.com';

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

/** The Google account a verified ID token yields. Found in identity-authentication.integration.spec.ts. */
interface GoogleAccount {
  subject: string;
  email: string;
  displayName: string | null;
}

/** The failure the fake verifier returns: the shape of `InvalidIdToken`. Found in identity-authentication.integration.spec.ts. */
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

/** A fake `Clock` whose time the test sets. Found in identity-authentication.integration.spec.ts. */
const fakeClock = () => {
  const clock = { current: new Date(), now: () => new Date(clock.current) };
  return clock;
};

// ---------------------------------------------------------------------------

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

const ON_2026_11_08 = '2026-11-08T12:00:00Z';
const NEW_YEARS_EVE_UTC = '2026-12-31T23:30:00Z';

const EMPTY_PROFILE = {
  timeZone: null,
  birthYear: null,
  enteredMaxHeartRate: null,
  maxHeartRate: null,
  heartRateZones: null,
};

const ENV_NAMES = [
  'DATABASE_URL',
  'PORT',
  'APP_VERSION',
  'GOOGLE_CLIENT_IDS',
  'SIGNUP_ALLOWED_EMAILS',
];

describe('identity-profile (against a migrated database)', () => {
  let url: string;
  let app: INestApplication;
  let baseUrl: string;
  const verifier = fakeVerifier();
  const clock = fakeClock();
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    url = await freshDatabase(inject('postgresUrl'));
    const run = migrate({ DATABASE_URL: url });
    expect(run.status, run.output).toBe(0);

    process.env['DATABASE_URL'] = url;
    delete process.env['PORT'];
    process.env['APP_VERSION'] = '3f2c9e1';
    process.env['GOOGLE_CLIENT_IDS'] = CLIENT_ID;
    // Every test signs up a user of its own; the allowlist admits them all.
    process.env['SIGNUP_ALLOWED_EMAILS'] = Array.from(
      { length: 60 },
      (_, n) => `user${n}@example.org`,
    ).join(',');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(verifier)
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    clock.current = new Date(ON_2026_11_08);
  });

  // --- Helpers over HTTP ---------------------------------------------------

  let userCount = 0;
  /** Signs a new user in at the clock's current time and returns their session token. */
  const newUser = async () => {
    const n = userCount;
    userCount += 1;
    const idToken = `id-token-${n}`;
    verifier.accounts.set(idToken, {
      subject: `profile-${n}`,
      email: `user${n}@example.org`,
      displayName: `User ${n}`,
    });
    const response = await fetch(`${baseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const body = (await response.json()) as { token?: unknown };
    expect(response.status, JSON.stringify(body)).toBe(200);
    return body.token as string;
  };

  const getProfile = (token: string) =>
    fetch(`${baseUrl}/me/profile`, {
      headers: { authorization: `Bearer ${token}` },
    });

  const patchProfile = (token: string, body: unknown) =>
    fetch(`${baseUrl}/me/profile`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  /** The caller's profile, failing unless GET /me/profile answers 200. */
  const profileOf = async (token: string) => {
    const response = await getProfile(token);
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status, JSON.stringify(body)).toBe(200);
    return body;
  };

  /** Patches the caller's profile, failing unless it answers 200. */
  const set = async (token: string, body: unknown) => {
    const response = await patchProfile(token, body);
    const answer = (await response.json()) as Record<string, unknown>;
    expect(response.status, JSON.stringify(answer)).toBe(200);
    return answer;
  };

  /** A refusal: the status given, as a problem document; answers its body. */
  const expectRefused = async (response: Response, status: number) => {
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status, JSON.stringify(body)).toBe(status);
    expect(response.headers.get('content-type')).toMatch(problemContentType);
    return body;
  };

  // --- The caller's profile can be read ------------------------------------

  describe("the caller's profile can be read", () => {
    it("a new user's profile is empty: GET /me/profile is 200 with every field null (specified)", async () => {
      const token = await newUser();

      const response = await getProfile(token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(EMPTY_PROFILE);
    });

    it.each(['GET', 'PATCH'] as const)(
      'the profile needs a session: %s /me/profile with a token naming no session is 401 with code identity.invalid-session (specified)',
      async (method) => {
        const response = await fetch(`${baseUrl}/me/profile`, {
          method,
          headers: {
            authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            'content-type': 'application/json',
          },
          ...(method === 'PATCH'
            ? { body: JSON.stringify({ timeZone: 'Europe/Kyiv' }) }
            : {}),
        });

        const body = await expectRefused(response, 401);
        expect(body['code']).toBe('identity.invalid-session');
      },
    );

    it("each user has their own profile: A sets Europe/Kyiv, B's timeZone is null (specified)", async () => {
      const a = await newUser();
      const b = await newUser();

      await set(a, { timeZone: 'Europe/Kyiv' });

      expect((await profileOf(b))['timeZone']).toBeNull();
      // Control: A's own change was stored.
      expect((await profileOf(a))['timeZone']).toBe('Europe/Kyiv');
    });
  });

  // --- The profile is changed field by field -------------------------------

  describe('the profile is changed field by field', () => {
    it('only the fields present change: Europe/Kyiv and 1990 stay when enteredMaxHeartRate 185 is patched (specified)', async () => {
      const token = await newUser();
      await set(token, { timeZone: 'Europe/Kyiv', birthYear: 1990 });

      const response = await patchProfile(token, { enteredMaxHeartRate: 185 });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        timeZone: 'Europe/Kyiv',
        birthYear: 1990,
        enteredMaxHeartRate: 185,
      });
    });

    it('the answer is in the shape GET /me/profile answers, and equals it (specified)', async () => {
      const token = await newUser();

      const patched = await set(token, {
        timeZone: 'Europe/Kyiv',
        birthYear: 1990,
      });

      expect(Object.keys(patched).sort()).toEqual(
        Object.keys(EMPTY_PROFILE).sort(),
      );
      expect(patched).toEqual(await profileOf(token));
    });

    it('a field is cleared by null: enteredMaxHeartRate 185, then null (specified)', async () => {
      const token = await newUser();
      await set(token, { enteredMaxHeartRate: 185 });

      const answer = await set(token, { enteredMaxHeartRate: null });

      expect(answer['enteredMaxHeartRate']).toBeNull();
      // Derived: the clearing was stored, not only answered.
      expect((await profileOf(token))['enteredMaxHeartRate']).toBeNull();
    });

    it('the birth year is cleared by null (specified by the requirement text)', async () => {
      const token = await newUser();
      await set(token, { birthYear: 1990 });

      expect((await set(token, { birthYear: null }))['birthYear']).toBeNull();
    });

    it('the time zone cannot be cleared: { "timeZone": null } is 400 and the profile is unchanged (specified)', async () => {
      const token = await newUser();
      await set(token, { timeZone: 'Europe/Kyiv' });
      const before = await profileOf(token);

      await expectRefused(await patchProfile(token, { timeZone: null }), 400);

      expect(await profileOf(token)).toEqual(before);
    });

    it('an empty patch changes nothing: {} is 200 with the profile unchanged (specified)', async () => {
      const token = await newUser();
      const before = await set(token, {
        timeZone: 'Europe/Kyiv',
        birthYear: 1990,
        enteredMaxHeartRate: 190,
      });

      const response = await patchProfile(token, {});

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(before);
      expect(await profileOf(token)).toEqual(before);
    });

    it("an empty patch of a new user's profile answers the empty profile (derived from design decision 2: a user with no row has an empty profile)", async () => {
      const token = await newUser();

      expect(await set(token, {})).toEqual(EMPTY_PROFILE);
    });

    it('a time zone is replaced by another (specified: "once set it is only replaced")', async () => {
      const token = await newUser();
      await set(token, { timeZone: 'Europe/Kyiv' });

      expect(
        (await set(token, { timeZone: 'Europe/Warsaw' }))['timeZone'],
      ).toBe('Europe/Warsaw');
    });
  });

  // --- The time zone is an IANA zone ---------------------------------------

  describe('the time zone is an IANA zone', () => {
    it('a valid zone is accepted as submitted: Europe/Kyiv, not Europe/Kiev (specified)', async () => {
      const token = await newUser();

      const response = await patchProfile(token, { timeZone: 'Europe/Kyiv' });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body['timeZone']).toBe('Europe/Kyiv');
      // Specified: "stored and answered exactly as submitted".
      expect((await profileOf(token))['timeZone']).toBe('Europe/Kyiv');
    });

    it('a lower-case zone is stored as submitted (derived from design decision 5)', async () => {
      const token = await newUser();

      expect((await set(token, { timeZone: 'europe/kyiv' }))['timeZone']).toBe(
        'europe/kyiv',
      );
    });

    it.each([['Mars/Olympus'], ['+02:00']])(
      'an unknown zone or an offset, %s, is 400 and the profile is unchanged (specified)',
      async (timeZone) => {
        const token = await newUser();
        await set(token, { timeZone: 'Europe/Kyiv' });
        const before = await profileOf(token);

        await expectRefused(await patchProfile(token, { timeZone }), 400);

        expect(await profileOf(token)).toEqual(before);
      },
    );

    it('a refused body changes nothing, even its valid fields (specified: "A body failing these rules ... changing nothing")', async () => {
      const token = await newUser();

      await expectRefused(
        await patchProfile(token, {
          timeZone: 'Mars/Olympus',
          enteredMaxHeartRate: 185,
        }),
        400,
      );

      expect(await profileOf(token)).toEqual(EMPTY_PROFILE);
    });
  });

  // --- The birth year is plausible -----------------------------------------

  describe('the birth year is plausible', () => {
    it('a plausible year is accepted: on 2026-11-08, 1990 is 200 (specified)', async () => {
      const token = await newUser();

      const response = await patchProfile(token, { birthYear: 1990 });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body['birthYear']).toBe(1990);
    });

    it('a year too recent is refused: on 2026-11-08, 2017 is 422 with code identity.implausible-birth-year, and the profile is unchanged (specified)', async () => {
      const token = await newUser();
      await set(token, { birthYear: 1990 });
      const before = await profileOf(token);

      const body = await expectRefused(
        await patchProfile(token, { birthYear: 2017 }),
        422,
      );

      expect(body['code']).toBe('identity.implausible-birth-year');
      expect(await profileOf(token)).toEqual(before);
    });

    it('a year too distant is refused: on 2026-11-08, 1905 is 422 with code identity.implausible-birth-year (specified)', async () => {
      const token = await newUser();

      const body = await expectRefused(
        await patchProfile(token, { birthYear: 1905 }),
        422,
      );

      expect(body['code']).toBe('identity.implausible-birth-year');
    });

    it.each([
      ['1990.5', 1990.5],
      ['"1990"', '1990'],
    ] as const)(
      'a non-integer is refused: { "birthYear": %s } is 400 (specified)',
      async (_case, birthYear) => {
        const token = await newUser();

        await expectRefused(await patchProfile(token, { birthYear }), 400);

        // Specified by the requirement text: a refused body changes nothing.
        expect(await profileOf(token)).toEqual(EMPTY_PROFILE);
      },
    );

    it('the year is read in the time zone the patch leaves: at 2026-12-31T23:30:00Z, 2017 is refused in UTC and accepted with Europe/Kyiv (specified)', async () => {
      clock.current = new Date(NEW_YEARS_EVE_UTC);
      const token = await newUser();

      const inUtc = await expectRefused(
        await patchProfile(token, { birthYear: 2017 }),
        422,
      );
      expect(inUtc['code']).toBe('identity.implausible-birth-year');

      const inKyiv = await set(token, {
        timeZone: 'Europe/Kyiv',
        birthYear: 2017,
      });
      expect(inKyiv['birthYear']).toBe(2017);
    });
  });

  // --- An entered maximum heart rate is within human range -----------------

  describe('an entered maximum heart rate is within human range', () => {
    it('a value in range is accepted: 230 (specified)', async () => {
      const token = await newUser();

      expect(
        (await set(token, { enteredMaxHeartRate: 230 }))['enteredMaxHeartRate'],
      ).toBe(230);
    });

    it.each([[99], [231], [180.5]])(
      'a value out of range is refused: %s is 400 and the profile is unchanged (specified)',
      async (enteredMaxHeartRate) => {
        const token = await newUser();
        await set(token, { enteredMaxHeartRate: 190 });
        const before = await profileOf(token);

        await expectRefused(
          await patchProfile(token, { enteredMaxHeartRate }),
          400,
        );

        expect(await profileOf(token)).toEqual(before);
      },
    );
  });

  // --- The maximum heart rate in effect, and its zones ---------------------

  describe('the maximum heart rate in effect', () => {
    it('the entered value wins: birth year 1990 and entered 190 give { bpm: 190, source: entered } (specified)', async () => {
      const token = await newUser();
      await set(token, { birthYear: 1990, enteredMaxHeartRate: 190 });

      expect((await profileOf(token))['maxHeartRate']).toEqual({
        bpm: 190,
        source: 'entered',
      });
    });

    it('the formula applies without an entered value: on 2026-11-08, birth year 1990 gives { bpm: 183, source: age-formula } (specified)', async () => {
      const token = await newUser();
      await set(token, { birthYear: 1990 });

      expect((await profileOf(token))['maxHeartRate']).toEqual({
        bpm: 183,
        source: 'age-formula',
      });
    });

    it('neither gives none: maxHeartRate and heartRateZones are null (specified)', async () => {
      const token = await newUser();
      await set(token, { timeZone: 'Europe/Kyiv' });

      const profile = await profileOf(token);

      expect(profile['maxHeartRate']).toBeNull();
      expect(profile['heartRateZones']).toBeNull();
    });

    it("the age follows the user's year: at 2026-12-31T23:30:00Z in Europe/Kyiv, birth year 1990 gives { bpm: 182, source: age-formula } (specified)", async () => {
      clock.current = new Date(NEW_YEARS_EVE_UTC);
      const token = await newUser();
      await set(token, { timeZone: 'Europe/Kyiv', birthYear: 1990 });

      expect((await profileOf(token))['maxHeartRate']).toEqual({
        bpm: 182,
        source: 'age-formula',
      });
    });
  });

  describe('heart-rate zones are fixed shares of the maximum', () => {
    it('zones of a maximum of 180 (specified)', async () => {
      const token = await newUser();
      await set(token, { enteredMaxHeartRate: 180 });

      expect((await profileOf(token))['heartRateZones']).toEqual([
        { zone: 1, minBpm: 90, maxBpm: 107 },
        { zone: 2, minBpm: 108, maxBpm: 125 },
        { zone: 3, minBpm: 126, maxBpm: 143 },
        { zone: 4, minBpm: 144, maxBpm: 161 },
        { zone: 5, minBpm: 162, maxBpm: null },
      ]);
    });

    it('bounds are rounded halves up: a maximum of 183 gives lower bounds 92, 110, 128, 146 and 165 (specified)', async () => {
      const token = await newUser();
      await set(token, { enteredMaxHeartRate: 183 });

      const zones = (await profileOf(token))['heartRateZones'] as {
        minBpm: number;
      }[];

      expect(zones.map((zone) => zone.minBpm)).toEqual([
        92, 110, 128, 146, 165,
      ]);
    });
  });
});
