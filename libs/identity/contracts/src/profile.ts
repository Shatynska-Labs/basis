import { z } from 'zod';

// The profile's request and response shapes (add-identity-profile design
// decisions 4, 5 and 8).

// An ECMAScript offset zone's sign: `+`, `-` or U+2212 MINUS SIGN.
const OFFSET_SIGN = /^[+\-\u2212]/;

/**
 * A time zone name the runtime recognises, not an ECMAScript offset zone such
 * as `+02:00` or `−02:00`, by its spelling or by what the runtime resolves it
 * to (add-identity-profile design decision 5).
 */
export const isTimeZoneName = (name: string): boolean => {
  if (name === '' || OFFSET_SIGN.test(name)) return false;
  try {
    const resolved = new Intl.DateTimeFormat('en', {
      timeZone: name,
    }).resolvedOptions().timeZone;
    return !OFFSET_SIGN.test(resolved);
  } catch {
    return false;
  }
};

/** Absent leaves a field unchanged; `null` clears it, except the time zone. */
export const UpdateProfileRequest = z.object({
  timeZone: z
    .string()
    .refine(isTimeZoneName, { message: 'Not a time zone name.' })
    .optional(),
  birthYear: z.number().int().nullable().optional(),
  enteredMaxHeartRate: z.number().int().min(100).max(230).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const ProfileResponse = z.object({
  timeZone: z.string().nullable(),
  birthYear: z.number().int().nullable(),
  enteredMaxHeartRate: z.number().int().nullable(),
  maxHeartRate: z
    .object({
      bpm: z.number().int(),
      source: z.enum(['entered', 'age-formula']),
    })
    .nullable(),
  heartRateZones: z
    .array(
      z.object({
        zone: z.number().int(),
        minBpm: z.number().int(),
        maxBpm: z.number().int().nullable(),
      }),
    )
    .nullable(),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;
