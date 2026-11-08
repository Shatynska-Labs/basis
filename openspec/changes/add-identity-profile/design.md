## Context

See proposal.md, Why. `identity` is built as `add-identity-authentication` left it: `libs/identity/{contracts,application,infrastructure}`, no `domain` (the context map places `identity` as a generic context), `@nestjs/cqrs` buses, read and write ports kept apart, a `Clock` port, Drizzle tables in the `identity` schema, the caller from `CurrentUser`, and a global Standard Schema pipe that refuses a body failing its Zod schema with `400` (`api-http-errors`). `identity.users` holds only what Google gives. Nothing reads a time zone or a heart rate yet: Phase 1's ingestion and Phase 2's habits will. Each host's database holds only data whose loss is tolerable until `move-to-durable-data-storage`, and production runs the release before this one, so the schema change must leave that release working (AGENTS.md, Deployment). This change is step 1 of `reach-the-calibration-period`.

Checked while drafting on Node 24.15 (ICU 78.2, tzdata 2026a): `Intl.DateTimeFormat` accepts `europe/kyiv`, resolves `Europe/Kyiv` and `europe/kyiv` to the legacy `Europe/Kiev`, accepts the offset `+02:00` as a zone, and refuses `Mars/Olympus`; `Intl.supportedValuesOf('timeZone')` lists `Europe/Kiev` but not `Europe/Kyiv`. `185 * 0.7` is `129.5` in floating point, but other products are not exact.

## Goals / Non-Goals

**Goals:**

- A user can state their time zone, birth year and, optionally, a measured maximum heart rate, and read them back with the maximum heart rate in effect and its five zones.
- The rules that derive the maximum and the zones are deterministic code, unit-tested without a database or a clock.

**Non-Goals:**

- Reading the profile from another context in process (a query on `identity`'s public surface): the first context that needs it, `ingest-health-connect-metrics` or Phase 2's habits, decides its shape.
- Zones from resting heart rate (Karvonen) or user-defined bounds; sex- or fitness-specific formulas.
- Any client, and how a client fills the time zone; the mobile client is `sync-health-connect-from-the-mobile-app`.
- Computing a day or a week in the user's time zone: no consumer exists yet. When one does, a user without a time zone has no days computed for them rather than days in a guessed zone.
- History of profile changes; a change applies from then on.

## Decisions

1. **The operator's three decisions.** Open question 3: the maximum heart rate is the Tanaka formula from the birth year by default, and a value the user enters replaces it. Zones are five fixed shares of the maximum (50/60/70/80/90 %). The time zone is set explicitly, never inferred or defaulted. Alternatives the operator declined: formula only or entered only; Karvonen zones (resting heart rate is not ingested before step 5); user-defined bounds; following the device's zone on every sync (a trip would silently move day and week boundaries); defaulting to UTC.

2. **A separate `identity.profiles` table**, one row per user, created on the first change: `user_id` (UUID, primary key, references `identity.users(id)` on delete cascade), `time_zone` (text, nullable), `birth_year` and `entered_max_heart_rate` (smallint, nullable), `updated_at` (timestamptz, not null). A user with no row has an empty profile. The context map names `User` and `Profile` apart, and keeping Google's fields and the user's own apart lets sign-in keep overwriting `users` from the token (`add-identity-authentication` decision 4). A new table is additive: the release production runs never reads it, so rollback by promotion stays safe. Extending `users` with nullable columns would also be compatible, but mixes the two sources.

3. **The patch is one upsert of the present fields.** `UpdateProfile` carries the parsed patch, where a field is absent (unchanged), a value, or `null` (cleared; not allowed for `timeZone`). The handler reads the stored profile, validates the birth year (decision 6), then calls `ProfileRepository.update(userId, patch, at)`, which runs `INSERT … ON CONFLICT (user_id) DO UPDATE SET <present columns>, updated_at`, then answers the profile through `ProfileReader`. An empty patch writes nothing and answers the stored profile. One statement, so no transaction (ADR-0011's `TransactionManager` stays unneeded); concurrent patches of different fields both apply, and of the same field the later wins.

4. **Shape validation is in the contract, in Zod.** `UpdateProfileRequest` is an object of three optional members: `timeZone`, a string passing the time zone check (decision 5), not nullable; `birthYear`, an integer or `null`; `enteredMaxHeartRate`, an integer from 100 to 230 or `null`. Unknown members are stripped, as Zod objects do by default and as `SignInWithGoogleRequest` already behaves. A failure is `400` from the global pipe, before any handler runs. The range 100–230 bpm covers recorded adult maxima with margin and needs no clock, so it belongs here; the birth year's range depends on the current date, so it does not.

5. **A time zone is a name `Intl` accepts, stored as submitted.** The check is that the name neither starts with an offset sign (`+`, `-` or U+2212 MINUS SIGN, all of which ECMAScript accepts for its offset zones, which are not IANA names) nor resolves through `new Intl.DateTimeFormat('en', { timeZone: name }).resolvedOptions().timeZone` to a name that does, and that the constructor does not throw. U+2212 was found by the code review. The value is stored and answered exactly as submitted, because the runtime's canonical form turns `Europe/Kyiv` into the legacy `Europe/Kiev` (Context). Case is not normalised for the same reason; IANA names are matched case-insensitively by both `Intl` and PostgreSQL, so a later computation reads either spelling. The check lives in `libs/identity/contracts`, which already depends only on Zod, as a pure function `isTimeZoneName`.

6. **The birth year's range is checked by the handler, against the clock.** The current year is the year of `Clock.now()` in the time zone the patch sets, else the stored one, else UTC, read with `Intl.DateTimeFormat`'s `year` part. A birth year outside `[current − 120, current − 10]` fails with `ImplausibleBirthYear` (kind `rule-violated`, code `identity.implausible-birth-year`), answered `422` by `toResponse`, and nothing is written. Ten years is a floor for a person tracking their own training, 120 a ceiling for a living one.

7. **The maximum and the zones are pure functions in `libs/identity/application/src/profile/heart-rate.ts`**, since `identity` has no `domain` layer and the context map keeps it that way; they take no clock and import nothing but their types:
   - `currentYear(now: Date, timeZone: string | null): number`.
   - `maxHeartRate(profile, year): { bpm, source } | null`: the entered value with `source` `entered`; else, with a birth year, `age = year − birthYear` and `bpm = Math.floor((2080 − 7 × age + 5) / 10)`, the formula `208 − 0.7 × age` rounded half up in integer arithmetic, with `source` `age-formula`; else `null`.
   - `heartRateZones(bpm): Zone[]`: zone `k` (1–5) has `minBpm = Math.floor((bpm × (40 + 10k) + 50) / 100)`, the share rounded half up in integer arithmetic; `maxBpm` is the next zone's `minBpm − 1`, and zone 5's is `null`.

   Integer arithmetic keeps a bound that is exactly a half (`185 × 70 % = 129.5`) from rounding down through a floating-point error. `GetProfile`'s handler reads the stored profile and the clock and assembles the response from these; `UpdateProfile`'s does the same after writing. The zones are never stored: they follow the maximum, which follows the year.

8. **Layout, following `add-identity-authentication` decision 5.**
   - `libs/identity/contracts`: `UpdateProfileRequest`, `ProfileResponse` (`{ timeZone, birthYear, enteredMaxHeartRate, maxHeartRate: { bpm, source: 'entered' | 'age-formula' } | null, heartRateZones: { zone, minBpm, maxBpm }[] | null }`), `isTimeZoneName`.
   - `libs/identity/application`: query `GetProfile` and command `UpdateProfile`, each in its own folder with its handler and joining `IDENTITY_HANDLERS`; write port `ProfileRepository` (`update(userId, patch, at)`), read port `ProfileReader` (`profileOf(userId)`, the stored fields or all `null`); failure `ImplausibleBirthYear`; `profile/heart-rate.ts`.
   - `libs/identity/infrastructure`: `driven/schema.ts` gains `profiles`; `driven/drizzle-profiles.ts` holds `DrizzleProfileRepository` and `DrizzleProfileReader`; `driving/profile.controller.ts` holds `ProfileController` (`@Controller('me/profile')`, `GET` and `PATCH`, `200`); `IdentityModule` binds the two ports and registers the controller.
   - `apps/api`: a migration generated by `pnpm nx run api:db-generate` (`0003_identity_profiles.sql`); `README.md` names the two routes.

9. **A session whose user was deleted.** `GetProfile` and `UpdateProfile` act on the authenticated user's identifier only. A user row removed under a valid session cannot happen today (no deletion exists, and sessions cascade with their user), so the handlers do not check for it; the foreign key refuses an upsert for a missing user, a defect.

## Risks / Trade-offs

- **Tanaka's formula is a population average**, typically ±10 bpm for an individual, which shifts every zone → the entered value overrides it, and the response says which source is in effect so a client can prompt for a measured value.
- **A time zone stored as submitted may be spelled inconsistently between users** (`Europe/Kyiv`, `europe/kyiv`) → every consumer passes it to `Intl` or PostgreSQL, both case-insensitive; normalising would need a name list the runtime does not provide in current spellings.
- **The runtime's zone database decides validity**: a zone added to IANA after Node's ICU is refused until Node updates → acceptable; Node's tzdata is current (2026a).
- **No time zone means no days.** Until the mobile client sets it, a user's data has no local day → intended (decision 1); `reach-the-calibration-period`'s step 6 now names setting it from the device, edited in this change's plan commit.

## Migration Plan

The migration creates `identity.profiles` only. The release before this one ignores it, so a rollback by promotion runs it unchanged against the newer schema. Nothing is backfilled: every existing user starts with an empty profile. The migration runs with every delivery's `migrate` service, as before.
