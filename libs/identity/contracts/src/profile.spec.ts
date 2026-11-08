// Derived from openspec/changes/add-identity-profile/specs/identity-profile/spec.md
// ("The profile is changed field by field", "The time zone is an IANA zone",
// "The birth year is plausible" for its 400 half, "An entered maximum heart
// rate is within human range") and design decisions 4 and 5, before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md.
//
// `UpdateProfileRequest` (a Zod schema) and `isTimeZoneName` (a pure
// function) are the names design decisions 4, 5 and 8 give in
// `@basis/identity-contracts`; both are assumed exported from this library's
// `src/index.ts` (an unresolved project question in test-plan.md). A body the
// schema refuses is answered `400` by the global pipe before any handler runs
// (design decision 4); the same behaviour is observed over HTTP in
// apps/api/tests/integration/identity-profile.integration.spec.ts.
import { describe, expect, it } from 'vitest';

import { isTimeZoneName, UpdateProfileRequest } from './index.js';

describe('identity-profile: isTimeZoneName', () => {
  it('Europe/Kyiv is a time zone name (specified)', () => {
    expect(isTimeZoneName('Europe/Kyiv')).toBe(true);
  });

  it.each([['Mars/Olympus'], ['+02:00']])(
    '%s is not a time zone name (specified)',
    (name) => {
      expect(isTimeZoneName(name)).toBe(false);
    },
  );

  it.each([['-05:00'], ['+0200']])(
    'an offset with either sign, %s, is not a time zone name (derived from design decision 5: a leading + or - is refused)',
    (name) => {
      expect(isTimeZoneName(name)).toBe(false);
    },
  );

  it.each([['europe/kyiv'], ['UTC'], ['America/New_York']])(
    '%s, a name the runtime recognises, is a time zone name (derived from design decision 5: case is not normalised, and Intl accepts it)',
    (name) => {
      expect(isTimeZoneName(name)).toBe(true);
    },
  );

  it('the empty string is not a time zone name (derived: Intl refuses it)', () => {
    expect(isTimeZoneName('')).toBe(false);
  });
});

describe('identity-profile: UpdateProfileRequest', () => {
  const accepts = (body: unknown) => UpdateProfileRequest.safeParse(body);

  describe('the profile is changed field by field', () => {
    it('an empty patch is accepted (specified: "An empty patch changes nothing" answers 200)', () => {
      const result = accepts({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('each field alone is accepted and kept as given (specified)', () => {
      expect(accepts({ enteredMaxHeartRate: 185 }).data).toEqual({
        enteredMaxHeartRate: 185,
      });
      expect(accepts({ birthYear: 1990 }).data).toEqual({ birthYear: 1990 });
      expect(accepts({ timeZone: 'Europe/Kyiv' }).data).toEqual({
        timeZone: 'Europe/Kyiv',
      });
    });

    it('a field absent stays absent rather than becoming null (derived from design decision 3: absent means unchanged, null means cleared)', () => {
      const result = accepts({ enteredMaxHeartRate: 185 });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('birthYear');
      expect(result.data).not.toHaveProperty('timeZone');
    });

    it.each([
      ['birthYear', { birthYear: null }],
      ['enteredMaxHeartRate', { enteredMaxHeartRate: null }],
    ] as const)('%s is cleared by null (specified)', (_field, body) => {
      const result = accepts(body);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(body);
    });

    it('the time zone cannot be cleared: { "timeZone": null } is refused (specified)', () => {
      expect(accepts({ timeZone: null }).success).toBe(false);
    });

    it('unknown members are stripped (derived from design decision 4)', () => {
      const result = accepts({ timeZone: 'Europe/Kyiv', nickname: 'Ann' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ timeZone: 'Europe/Kyiv' });
    });
  });

  describe('the time zone is an IANA zone', () => {
    it('Europe/Kyiv is accepted exactly as submitted, not as the legacy Europe/Kiev (specified)', () => {
      const result = accepts({ timeZone: 'Europe/Kyiv' });

      expect(result.success).toBe(true);
      expect(result.data?.timeZone).toBe('Europe/Kyiv');
    });

    it('a lower-case name is kept as submitted (derived from design decision 5: stored as submitted, case not normalised)', () => {
      expect(accepts({ timeZone: 'europe/kyiv' }).data?.timeZone).toBe(
        'europe/kyiv',
      );
    });

    it.each([['Mars/Olympus'], ['+02:00']])(
      'an unknown zone or an offset, %s, is refused (specified)',
      (timeZone) => {
        expect(accepts({ timeZone }).success).toBe(false);
      },
    );

    it('a time zone that is not a string is refused (derived)', () => {
      expect(accepts({ timeZone: 2 }).success).toBe(false);
    });
  });

  describe('the birth year: a value that is not an integer is refused', () => {
    it.each([
      ['1990.5', 1990.5],
      ['"1990"', '1990'],
    ] as const)(
      '{ "birthYear": %s } is refused (specified)',
      (_case, value) => {
        expect(accepts({ birthYear: value }).success).toBe(false);
      },
    );

    it.each([[2017], [1905]])(
      'an integer outside the plausible range, %s, passes the contract, because its range needs the clock (derived from design decision 4; the handler answers it 422)',
      (birthYear) => {
        expect(accepts({ birthYear }).success).toBe(true);
      },
    );
  });

  describe('an entered maximum heart rate is within human range', () => {
    it.each([[100], [230]])(
      'the inclusive bound %s is accepted (specified: "from 100 to 230 ..., inclusive")',
      (enteredMaxHeartRate) => {
        const result = accepts({ enteredMaxHeartRate });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ enteredMaxHeartRate });
      },
    );

    it.each([[99], [231], [180.5]])(
      '%s is refused (specified)',
      (enteredMaxHeartRate) => {
        expect(accepts({ enteredMaxHeartRate }).success).toBe(false);
      },
    );

    it('a numeric string is refused (derived: the value must be an integer, not text)', () => {
      expect(accepts({ enteredMaxHeartRate: '185' }).success).toBe(false);
    });
  });
});
