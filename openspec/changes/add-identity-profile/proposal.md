## Why

Every day and week Basis computes is the user's own, in their local time zone (Conventions, Time; `docs/product/04-domain-model.md` §4), and the `hr_zone_minutes` metric counts minutes in heart-rate zones derived from a maximum heart rate held in the profile (`docs/product/04-domain-model.md` §1). Neither exists: `identity` knows a user's Google account and nothing else. Phase 1's ingestion and Phase 2's habits both need them, so the profile comes first in `reach-the-calibration-period`, whose first step this is. It also answers open question 3 of `docs/product/06-risks-and-open-questions.md`, how the maximum heart rate is set: the operator chose an age formula by default, which a measured value the user enters replaces.

## What Changes

- **A profile per user**, read with `GET /me/profile` and changed with `PATCH /me/profile`: the user's time zone, birth year and an entered maximum heart rate, each absent until set.
- **The time zone is set explicitly** (operator's decision), as an IANA zone name such as `Europe/Kyiv`, which the mobile client fills from the device. It is never inferred or defaulted; until it is set the profile reports it absent.
- **Maximum heart rate**: the entered value where there is one, otherwise the Tanaka formula, `208 − 0.7 × age`, from the birth year (operator's decision). With neither, there is none.
- **Five heart-rate zones at fixed shares of the maximum** (operator's decision), with lower bounds at 50, 60, 70, 80 and 90 % and zone 5 open above, answered in beats per minute with the profile, computed by code rather than stored.
- **A new table**, `identity.profiles`, in the API's migration history; additive, so the release production runs keeps working against it.
- `docs/product/06-risks-and-open-questions.md` records the answer to open question 3, and `docs/product/04-domain-model.md` §1 names the formula and the zones.
- `reach-the-calibration-period` records the answer as a decision, drops the open question, and gives step 6 setting the user's time zone from the device, without which a user has no local days.

## Capabilities

### New Capabilities

- `identity-profile`: the user's profile (time zone, birth year, entered maximum heart rate), the maximum heart rate in effect and the heart-rate zones derived from it.

### Modified Capabilities

- `api-persistence`: the tables the migration history creates now include `identity.profiles`.

## Impact

- Advances the workstream `reach-the-calibration-period` (step 1, `add-identity-profile`).
- `libs/identity/contracts`: `ProfileResponse`, `UpdateProfileRequest`.
- `libs/identity/application`: query `GetProfile`, command `UpdateProfile`, ports `ProfileReader` and `ProfileRepository`, the maximum-heart-rate and zone computation, failure `ImplausibleBirthYear`.
- `libs/identity/infrastructure`: the `profiles` table and its adapters; `ProfileController`; `IdentityModule` bindings.
- `apps/api`: a new migration; `README.md` gains the profile routes.
- No new dependency, configuration or delivery change.
- Out of scope: reading the profile from another context in process (left to the first context that needs it, Phase 1's ingestion or Phase 2's habits), zones from resting heart rate (Karvonen), user-defined zone bounds, and any client.
