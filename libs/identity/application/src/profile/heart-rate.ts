// The maximum heart rate in effect and its zones, as integer arithmetic so a
// bound that is exactly a half rounds up (add-identity-profile design
// decision 7). Pure: the year is passed in.

export type StoredProfile = {
  timeZone: string | null;
  birthYear: number | null;
  enteredMaxHeartRate: number | null;
};

export interface MaxHeartRate {
  bpm: number;
  source: 'entered' | 'age-formula';
}

export interface HeartRateZone {
  zone: number;
  minBpm: number;
  maxBpm: number | null;
}

/** The year of `now` in the time zone, or in UTC without one. */
export const currentYear = (now: Date, timeZone: string | null): number =>
  Number(
    new Intl.DateTimeFormat('en', {
      timeZone: timeZone ?? 'UTC',
      year: 'numeric',
    }).format(now),
  );

/** The entered value, else Tanaka's `208 − 0.7 × age` rounded half up, else none. */
export const maxHeartRate = (
  { birthYear, enteredMaxHeartRate }: StoredProfile,
  year: number,
): MaxHeartRate | null => {
  if (enteredMaxHeartRate !== null) {
    return { bpm: enteredMaxHeartRate, source: 'entered' };
  }
  if (birthYear === null) return null;
  const age = year - birthYear;
  return { bpm: Math.floor((2080 - 7 * age + 5) / 10), source: 'age-formula' };
};

/** Five zones with lower bounds at 50–90 % of the maximum; zone 5 is open above. */
export const heartRateZones = (bpm: number): HeartRateZone[] => {
  const lower = [1, 2, 3, 4, 5].map((zone) =>
    Math.floor((bpm * (40 + 10 * zone) + 50) / 100),
  );
  return lower.map((minBpm, i) => ({
    zone: i + 1,
    minBpm,
    maxBpm: i + 1 < lower.length ? (lower[i + 1] as number) - 1 : null,
  }));
};

export type Profile = {
  timeZone: string | null;
  birthYear: number | null;
  enteredMaxHeartRate: number | null;
  maxHeartRate: MaxHeartRate | null;
  heartRateZones: HeartRateZone[] | null;
};

/** The profile as answered: the stored fields with the maximum and zones in effect at `now`. */
export const profileAt = (stored: StoredProfile, now: Date): Profile => {
  const max = maxHeartRate(stored, currentYear(now, stored.timeZone));
  return {
    timeZone: stored.timeZone,
    birthYear: stored.birthYear,
    enteredMaxHeartRate: stored.enteredMaxHeartRate,
    maxHeartRate: max,
    heartRateZones: max === null ? null : heartRateZones(max.bpm),
  };
};
