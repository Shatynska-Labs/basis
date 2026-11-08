// Derived from openspec/changes/add-identity-profile/specs/identity-profile/spec.md
// ("The caller's profile can be read", "The profile is changed field by
// field", "The birth year is plausible", "The maximum heart rate in effect",
// "Heart-rate zones are fixed shares of the maximum") and design decisions 3,
// 6, 7 and 8, before implementation. Provenance of each assertion is recorded
// in that change's test-plan.md.
//
// Unit specs of the profile's handlers with in-memory fakes of the ports
// (AGENTS.md, Testing Strategy), following handlers.spec.ts. Shape validation
// (a null time zone, a non-integer, an unknown zone) is the contract's and is
// covered in libs/identity/contracts/src/profile.spec.ts; the handlers are
// given patches the contract already accepted. The same behaviour is observed
// over HTTP against PostgreSQL in
// apps/api/tests/integration/identity-profile.integration.spec.ts.
//
// Assumed, and listed as unresolved project questions in test-plan.md:
//   - the query and command live in `queries/get-profile/` and
//     `commands/update-profile/`, named as identity's existing ones are;
//   - `new GetProfile(userId)` and `new UpdateProfile(userId, patch)`;
//   - `new GetProfileHandler(profileReader, clock)` and
//     `new UpdateProfileHandler(profileRepository, profileReader, clock)`;
//   - each handler's `execute` resolves to a `Result` whose success value is
//     the profile in the `ProfileResponse` shape (design decision 8), and
//     whose failure carries `kind` and `code`, as identity's handlers do;
//   - `ProfileReader.profileOf(userId)` resolves to
//     `{ timeZone, birthYear, enteredMaxHeartRate }`, each `null` until set,
//     and `ProfileRepository.update(userId, patch, at)` resolves to nothing,
//     `patch` holding only the fields present (design decisions 3 and 8).
import { describe, expect, it } from 'vitest';

import { UpdateProfile } from './commands/update-profile/update-profile.command.js';
import { UpdateProfileHandler } from './commands/update-profile/update-profile.handler.js';
import type { Clock, ProfileReader, ProfileRepository } from './ports.js';
import { GetProfile } from './queries/get-profile/get-profile.query.js';
import { GetProfileHandler } from './queries/get-profile/get-profile.handler.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

interface StoredProfile {
  timeZone: string | null;
  birthYear: number | null;
  enteredMaxHeartRate: number | null;
}

interface Patch {
  timeZone?: string;
  birthYear?: number | null;
  enteredMaxHeartRate?: number | null;
}

const EMPTY: StoredProfile = {
  timeZone: null,
  birthYear: null,
  enteredMaxHeartRate: null,
};

/** Profiles in memory behind `ProfileReader` and `ProfileRepository`, recording every write. */
const memoryProfiles = () => {
  const profiles = new Map<string, StoredProfile>();
  const writes: { userId: string; patch: Patch; at: Date }[] = [];
  const reader: ProfileReader = {
    profileOf: async (userId: string) => ({
      ...(profiles.get(userId) ?? EMPTY),
    }),
  };
  const repository: ProfileRepository = {
    update: async (userId: string, patch: Patch, at: Date) => {
      writes.push({ userId, patch: { ...patch }, at });
      const current = { ...(profiles.get(userId) ?? EMPTY) };
      if ('timeZone' in patch && patch.timeZone !== undefined)
        current.timeZone = patch.timeZone;
      if ('birthYear' in patch && patch.birthYear !== undefined)
        current.birthYear = patch.birthYear;
      if (
        'enteredMaxHeartRate' in patch &&
        patch.enteredMaxHeartRate !== undefined
      )
        current.enteredMaxHeartRate = patch.enteredMaxHeartRate;
      profiles.set(userId, current);
    },
  };
  return { profiles, writes, reader, repository };
};

/** A `Clock` whose time the test sets. Found in handlers.spec.ts. */
const fixedClock = (iso: string) => {
  const clock = { current: new Date(iso), now: () => new Date(clock.current) };
  return clock satisfies Clock;
};

// ---------------------------------------------------------------------------

const ON_2026_11_08 = '2026-11-08T12:00:00Z';
const NEW_YEARS_EVE_UTC = '2026-12-31T23:30:00Z';

const ZONES_OF_180 = [
  { zone: 1, minBpm: 90, maxBpm: 107 },
  { zone: 2, minBpm: 108, maxBpm: 125 },
  { zone: 3, minBpm: 126, maxBpm: 143 },
  { zone: 4, minBpm: 144, maxBpm: 161 },
  { zone: 5, minBpm: 162, maxBpm: null },
];

const setUp = (at = ON_2026_11_08) => {
  const store = memoryProfiles();
  const clock = fixedClock(at);
  const get = new GetProfileHandler(store.reader, clock);
  const update = new UpdateProfileHandler(
    store.repository,
    store.reader,
    clock,
  );
  const read = async (userId = 'user-a') => {
    const result = await get.execute(new GetProfile(userId));
    if (!result.isSuccess()) throw new Error('GetProfile failed');
    return result.value as Record<string, unknown>;
  };
  const patch = (body: Patch, userId = 'user-a') =>
    update.execute(new UpdateProfile(userId, body));
  return { store, clock, read, patch };
};

describe("GetProfile: the caller's profile can be read", () => {
  it("a new user's profile is empty (specified)", async () => {
    const { read } = setUp();

    expect(await read()).toEqual({
      timeZone: null,
      birthYear: null,
      enteredMaxHeartRate: null,
      maxHeartRate: null,
      heartRateZones: null,
    });
  });

  it('each user has their own profile: A sets Europe/Kyiv, B reads null (specified)', async () => {
    const { read, patch } = setUp();

    expect(
      (await patch({ timeZone: 'Europe/Kyiv' }, 'user-a')).isSuccess(),
    ).toBe(true);

    expect((await read('user-b'))['timeZone']).toBeNull();
    expect((await read('user-a'))['timeZone']).toBe('Europe/Kyiv');
  });
});

describe('GetProfile: the maximum heart rate in effect, and its zones', () => {
  it('the entered value wins: birth year 1990 and entered 190 (specified)', async () => {
    const { store, read } = setUp();
    store.profiles.set('user-a', {
      ...EMPTY,
      birthYear: 1990,
      enteredMaxHeartRate: 190,
    });

    expect((await read())['maxHeartRate']).toEqual({
      bpm: 190,
      source: 'entered',
    });
  });

  it('the formula applies without an entered value: on 2026-11-08, birth year 1990 gives 183 from the age formula (specified)', async () => {
    const { store, read } = setUp();
    store.profiles.set('user-a', { ...EMPTY, birthYear: 1990 });

    expect((await read())['maxHeartRate']).toEqual({
      bpm: 183,
      source: 'age-formula',
    });
  });

  it('neither gives none: maxHeartRate and heartRateZones are null (specified)', async () => {
    const { store, read } = setUp();
    store.profiles.set('user-a', { ...EMPTY, timeZone: 'Europe/Kyiv' });

    const profile = await read();

    expect(profile['maxHeartRate']).toBeNull();
    expect(profile['heartRateZones']).toBeNull();
  });

  it("the age follows the user's year: at 2026-12-31T23:30:00Z in Europe/Kyiv, birth year 1990 gives 182 (specified)", async () => {
    const { store, read } = setUp(NEW_YEARS_EVE_UTC);
    store.profiles.set('user-a', {
      ...EMPTY,
      timeZone: 'Europe/Kyiv',
      birthYear: 1990,
    });

    expect((await read())['maxHeartRate']).toEqual({
      bpm: 182,
      source: 'age-formula',
    });
  });

  it('with no time zone the age is taken in UTC: at 2026-12-31T23:30:00Z, birth year 1990 gives 183 (specified by the requirement text "or in UTC while none is set")', async () => {
    const { store, read } = setUp(NEW_YEARS_EVE_UTC);
    store.profiles.set('user-a', { ...EMPTY, birthYear: 1990 });

    expect((await read())['maxHeartRate']).toEqual({
      bpm: 183,
      source: 'age-formula',
    });
  });

  it('zones of a maximum of 180 (specified)', async () => {
    const { store, read } = setUp();
    store.profiles.set('user-a', { ...EMPTY, enteredMaxHeartRate: 180 });

    expect((await read())['heartRateZones']).toEqual(ZONES_OF_180);
  });

  it('bounds are rounded halves up: a maximum of 183 gives lower bounds 92, 110, 128, 146 and 165 (specified)', async () => {
    const { store, read } = setUp();
    store.profiles.set('user-a', { ...EMPTY, birthYear: 1990 });

    const zones = (await read())['heartRateZones'] as { minBpm: number }[];

    expect(zones.map((zone) => zone.minBpm)).toEqual([92, 110, 128, 146, 165]);
  });
});

describe('UpdateProfile: the profile is changed field by field', () => {
  it('only the fields present change, and the answer is the profile as it now stands (specified)', async () => {
    const { store, patch } = setUp();
    store.profiles.set('user-a', {
      ...EMPTY,
      timeZone: 'Europe/Kyiv',
      birthYear: 1990,
    });

    const result = await patch({ enteredMaxHeartRate: 185 });

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value).toEqual({
      timeZone: 'Europe/Kyiv',
      birthYear: 1990,
      enteredMaxHeartRate: 185,
      // Specified by "The maximum heart rate in effect": the entered value.
      maxHeartRate: { bpm: 185, source: 'entered' },
      heartRateZones: [
        { zone: 1, minBpm: 93, maxBpm: 110 },
        { zone: 2, minBpm: 111, maxBpm: 129 },
        { zone: 3, minBpm: 130, maxBpm: 147 },
        { zone: 4, minBpm: 148, maxBpm: 166 },
        { zone: 5, minBpm: 167, maxBpm: null },
      ],
    });
  });

  it('a field is cleared by null (specified)', async () => {
    const { store, patch, read } = setUp();
    store.profiles.set('user-a', { ...EMPTY, enteredMaxHeartRate: 185 });

    const result = await patch({ enteredMaxHeartRate: null });

    expect(result.isSuccess() && result.value).toMatchObject({
      enteredMaxHeartRate: null,
    });
    expect((await read())['enteredMaxHeartRate']).toBeNull();
  });

  it('the birth year is cleared by null (specified by the requirement text)', async () => {
    const { store, patch } = setUp();
    store.profiles.set('user-a', { ...EMPTY, birthYear: 1990 });

    const result = await patch({ birthYear: null });

    expect(result.isSuccess() && result.value).toMatchObject({
      birthYear: null,
      maxHeartRate: null,
      heartRateZones: null,
    });
  });

  it('an empty patch changes nothing: the stored profile is answered (specified)', async () => {
    const { store, patch } = setUp();
    store.profiles.set('user-a', {
      ...EMPTY,
      timeZone: 'Europe/Kyiv',
      birthYear: 1990,
    });

    const result = await patch({});

    expect(result.isSuccess() && result.value).toMatchObject({
      timeZone: 'Europe/Kyiv',
      birthYear: 1990,
      enteredMaxHeartRate: null,
    });
    expect(store.profiles.get('user-a')).toEqual({
      ...EMPTY,
      timeZone: 'Europe/Kyiv',
      birthYear: 1990,
    });
  });

  it('an empty patch writes nothing (derived from design decision 3)', async () => {
    const { store, patch } = setUp();

    await patch({});

    expect(store.writes).toEqual([]);
  });

  it('a patch is written once, for the caller, with the fields present and the time of the clock (derived from design decision 3)', async () => {
    const { store, patch } = setUp();

    await patch({ timeZone: 'Europe/Kyiv' });

    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]?.userId).toBe('user-a');
    expect(store.writes[0]?.patch).toEqual({ timeZone: 'Europe/Kyiv' });
    expect(store.writes[0]?.at.toISOString()).toBe('2026-11-08T12:00:00.000Z');
  });

  it('a valid zone is answered as submitted, not as a legacy alias (specified)', async () => {
    const { patch } = setUp();

    const result = await patch({ timeZone: 'Europe/Kyiv' });

    expect(result.isSuccess() && result.value).toMatchObject({
      timeZone: 'Europe/Kyiv',
    });
  });
});

describe('UpdateProfile: the birth year is plausible', () => {
  const expectImplausible = (result: {
    isFailure(): boolean;
    value: unknown;
  }) => {
    expect(result.isFailure()).toBe(true);
    const failure = result.value as { kind?: unknown; code?: unknown };
    expect(failure.code).toBe('identity.implausible-birth-year');
    // Derived from design decision 6: the failure's kind, which toResponse answers 422.
    expect(failure.kind).toBe('rule-violated');
  };

  it('a plausible year is accepted: on 2026-11-08, 1990 (specified)', async () => {
    const { patch } = setUp();

    const result = await patch({ birthYear: 1990 });

    expect(result.isSuccess() && result.value).toMatchObject({
      birthYear: 1990,
    });
  });

  it('a year too recent is refused: on 2026-11-08, 2017, and the profile is unchanged (specified)', async () => {
    const { store, patch } = setUp();
    store.profiles.set('user-a', { ...EMPTY, birthYear: 1990 });

    expectImplausible(await patch({ birthYear: 2017 }));
    expect(store.profiles.get('user-a')).toEqual({ ...EMPTY, birthYear: 1990 });
    // Derived from design decision 6: nothing is written.
    expect(store.writes).toEqual([]);
  });

  it('a year too distant is refused: on 2026-11-08, 1905 (specified)', async () => {
    const { patch } = setUp();

    expectImplausible(await patch({ birthYear: 1905 }));
  });

  it.each([[2016], [1906]])(
    'the inclusive bound %s is accepted on 2026-11-08 (specified by the requirement text "from 120 years before ... to 10 years before it, inclusive")',
    async (birthYear) => {
      const { patch } = setUp();

      const result = await patch({ birthYear });

      expect(result.isSuccess() && result.value).toMatchObject({ birthYear });
    },
  );

  it('a refused birth year refuses the whole patch: a time zone sent with it is not stored (derived from design decision 6: nothing is written)', async () => {
    const { store, patch } = setUp();

    expectImplausible(
      await patch({ timeZone: 'Europe/Kyiv', birthYear: 2017 }),
    );
    expect(store.profiles.get('user-a') ?? EMPTY).toEqual(EMPTY);
  });

  describe('the current year is taken in the time zone as the patch leaves it, else UTC', () => {
    it('with no time zone, at 2026-12-31T23:30:00Z, 2017 is refused, being 9 years before 2026 in UTC (specified)', async () => {
      const { patch } = setUp(NEW_YEARS_EVE_UTC);

      expectImplausible(await patch({ birthYear: 2017 }));
    });

    it('with a stored Europe/Kyiv, at 2026-12-31T23:30:00Z, 2017 is accepted, being 10 years before 2027 in Kyiv (specified)', async () => {
      const { store, patch } = setUp(NEW_YEARS_EVE_UTC);
      store.profiles.set('user-a', { ...EMPTY, timeZone: 'Europe/Kyiv' });

      const result = await patch({ birthYear: 2017 });

      expect(result.isSuccess() && result.value).toMatchObject({
        birthYear: 2017,
      });
    });

    it('with Europe/Kyiv set by the same patch, at 2026-12-31T23:30:00Z, 2017 is accepted (specified: "the user\'s time zone as the patch leaves it")', async () => {
      const { patch } = setUp(NEW_YEARS_EVE_UTC);

      const result = await patch({ timeZone: 'Europe/Kyiv', birthYear: 2017 });

      expect(result.isSuccess() && result.value).toMatchObject({
        timeZone: 'Europe/Kyiv',
        birthYear: 2017,
      });
    });

    it('a zone the patch sets replaces the stored one: stored Europe/Kyiv, patch America/New_York with 2017, at 2026-12-31T23:30:00Z, is refused (specified: "as the patch leaves it")', async () => {
      const { store, patch } = setUp(NEW_YEARS_EVE_UTC);
      store.profiles.set('user-a', { ...EMPTY, timeZone: 'Europe/Kyiv' });

      expectImplausible(
        await patch({ timeZone: 'America/New_York', birthYear: 2017 }),
      );
      expect(store.profiles.get('user-a')?.timeZone).toBe('Europe/Kyiv');
    });
  });
});
