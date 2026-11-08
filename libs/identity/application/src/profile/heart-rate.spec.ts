// Derived from openspec/changes/add-identity-profile/specs/identity-profile/spec.md
// ("The maximum heart rate in effect", "Heart-rate zones are fixed shares of
// the maximum", "The birth year is plausible" for its current year) and
// design decision 7, before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md.
//
// The three pure functions design decision 7 names in this file:
//   - `currentYear(now: Date, timeZone: string | null): number`;
//   - `maxHeartRate(profile, year): { bpm, source } | null`, `profile` being
//     the stored profile `{ timeZone, birthYear, enteredMaxHeartRate }`, the
//     shape `ProfileReader.profileOf` answers (an unresolved project question
//     in test-plan.md: the parameter's exact type is not stated);
//   - `heartRateZones(bpm): { zone, minBpm, maxBpm }[]`.
// No clock, database or framework: time is passed in (AGENTS.md, Testing
// Strategy).
import { describe, expect, it } from 'vitest';

import { currentYear, heartRateZones, maxHeartRate } from './heart-rate.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** A stored profile with the fields given and every other field null. */
const profile = (
  fields: Partial<{
    timeZone: string | null;
    birthYear: number | null;
    enteredMaxHeartRate: number | null;
  }> = {},
) => ({
  timeZone: null,
  birthYear: null,
  enteredMaxHeartRate: null,
  ...fields,
});

// ---------------------------------------------------------------------------

describe('identity-profile: currentYear', () => {
  it('at 2026-12-31T23:30:00Z it is already 2027 in Europe/Kyiv (specified: "The age follows the user\'s year")', () => {
    expect(currentYear(new Date('2026-12-31T23:30:00Z'), 'Europe/Kyiv')).toBe(
      2027,
    );
  });

  it('with no time zone the year is the UTC year (specified: "or in UTC while none is set")', () => {
    expect(currentYear(new Date('2026-12-31T23:30:00Z'), null)).toBe(2026);
  });

  it('on 2026-11-08 the year is 2026 (specified by the scenarios dated 2026-11-08)', () => {
    expect(currentYear(new Date('2026-11-08T12:00:00Z'), null)).toBe(2026);
    expect(currentYear(new Date('2026-11-08T12:00:00Z'), 'Europe/Kyiv')).toBe(
      2026,
    );
  });

  it("a zone behind UTC can still be in the previous year (derived from the requirement text: the year of the current date in the user's time zone)", () => {
    expect(
      currentYear(new Date('2027-01-01T03:00:00Z'), 'America/New_York'),
    ).toBe(2026);
  });
});

describe('identity-profile: maxHeartRate', () => {
  it('the entered value wins: birth year 1990 and entered 190 give { bpm: 190, source: entered } (specified)', () => {
    expect(
      maxHeartRate(
        profile({ birthYear: 1990, enteredMaxHeartRate: 190 }),
        2026,
      ),
    ).toEqual({ bpm: 190, source: 'entered' });
  });

  it('the formula applies without an entered value: birth year 1990 in 2026 gives { bpm: 183, source: age-formula } (specified: age 36, 208 - 25.2 = 182.8)', () => {
    expect(maxHeartRate(profile({ birthYear: 1990 }), 2026)).toEqual({
      bpm: 183,
      source: 'age-formula',
    });
  });

  it('the age follows the year given: birth year 1990 in 2027 gives { bpm: 182, source: age-formula } (specified: age 37, 208 - 25.9 = 182.1)', () => {
    expect(maxHeartRate(profile({ birthYear: 1990 }), 2027)).toEqual({
      bpm: 182,
      source: 'age-formula',
    });
  });

  it('neither gives none (specified)', () => {
    expect(maxHeartRate(profile(), 2026)).toBeNull();
  });

  it('an entered value without a birth year is still in effect (specified: "the entered maximum heart rate ... where one is set")', () => {
    expect(maxHeartRate(profile({ enteredMaxHeartRate: 175 }), 2026)).toEqual({
      bpm: 175,
      source: 'entered',
    });
  });

  it.each([
    // age 35: 208 - 24.5 = 183.5
    [1991, 2026, 184],
    // age 25: 208 - 17.5 = 190.5
    [2001, 2026, 191],
    // age 15: 208 - 10.5 = 197.5
    [2011, 2026, 198],
  ])(
    'a half rounds up: birth year %s in %s gives %s (specified by the requirement text "halves up"; the ages are derived)',
    (birthYear, year, bpm) => {
      expect(maxHeartRate(profile({ birthYear }), year)).toEqual({
        bpm,
        source: 'age-formula',
      });
    },
  );

  it('the time zone in the profile does not change the result for a given year (derived from design decision 7: the year is passed in)', () => {
    expect(
      maxHeartRate(profile({ birthYear: 1990, timeZone: 'Europe/Kyiv' }), 2026),
    ).toEqual({ bpm: 183, source: 'age-formula' });
  });
});

describe('identity-profile: heartRateZones', () => {
  it('zones of a maximum of 180 (specified)', () => {
    expect(heartRateZones(180)).toEqual([
      { zone: 1, minBpm: 90, maxBpm: 107 },
      { zone: 2, minBpm: 108, maxBpm: 125 },
      { zone: 3, minBpm: 126, maxBpm: 143 },
      { zone: 4, minBpm: 144, maxBpm: 161 },
      { zone: 5, minBpm: 162, maxBpm: null },
    ]);
  });

  it('bounds are rounded halves up: a maximum of 183 gives lower bounds 92, 110, 128, 146 and 165 (specified)', () => {
    expect(heartRateZones(183).map((zone) => zone.minBpm)).toEqual([
      92, 110, 128, 146, 165,
    ]);
  });

  it('a bound exactly a half rounds up: a maximum of 185 gives lower bounds 93, 111, 130, 148 and 167 (specified by the requirement text "halves up"; 185 and 129.5 are derived from design decision 7)', () => {
    expect(heartRateZones(185).map((zone) => zone.minBpm)).toEqual([
      93, 111, 130, 148, 167,
    ]);
  });

  it.each([[150], [183], [185], [199], [230]])(
    'for a maximum of %s, zones 1 to 5 are contiguous: each maxBpm is the next minBpm - 1, and zone 5 is open (specified)',
    (bpm) => {
      const zones = heartRateZones(bpm);

      expect(zones.map((zone) => zone.zone)).toEqual([1, 2, 3, 4, 5]);
      for (let k = 0; k < 4; k += 1)
        expect(zones[k]?.maxBpm).toBe((zones[k + 1]?.minBpm ?? NaN) - 1);
      expect(zones[4]?.maxBpm).toBeNull();
    },
  );
});
