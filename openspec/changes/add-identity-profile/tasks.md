## 1. Contracts

- [x] 1.1 Add `isTimeZoneName` to `libs/identity/contracts` (design decision 5)
- [x] 1.2 Add `UpdateProfileRequest` and `ProfileResponse` (design decisions 4, 8)

## 2. Heart rate

- [x] 2.1 Add `currentYear`, `maxHeartRate` and `heartRateZones` in `libs/identity/application/src/profile/heart-rate.ts`, in integer arithmetic (design decision 7)

## 3. Application

- [x] 3.1 Add the ports `ProfileReader` and `ProfileRepository`, the patch type, and the failure `ImplausibleBirthYear` (`rule-violated`, `identity.implausible-birth-year`)
- [x] 3.2 Add the query `GetProfile` and its handler, assembling the profile from `ProfileReader`, `Clock` and `heart-rate.ts`
- [x] 3.3 Add the command `UpdateProfile` and its handler: the birth year's range against the clock in the patch's, stored or UTC zone, the upsert, an empty patch writing nothing (design decisions 3, 6)
- [x] 3.4 Export both and add their handlers to `IDENTITY_HANDLERS`

## 4. Infrastructure and migration

- [x] 4.1 Add `profiles` to `libs/identity/infrastructure/src/driven/schema.ts` (design decision 2)
- [x] 4.2 Add `DrizzleProfileRepository` (one upsert of the present columns) and `DrizzleProfileReader`
- [x] 4.3 Add `ProfileController` (`GET` and `PATCH /me/profile`) and bind the ports and the controller in `IdentityModule`
- [x] 4.4 Generate the migration with `pnpm nx run api:db-generate` and check it creates only `identity.profiles`

## 5. Documentation

- [x] 5.1 `docs/product/06-risks-and-open-questions.md`: answer open question 3 (Tanaka by default, an entered value replaces it; `add-identity-profile`)
- [x] 5.2 `docs/product/04-domain-model.md` §1: the maximum heart rate is the entered value, else Tanaka `208 − 0.7 × age`; `hr_zone_minutes`' zones are five fixed shares of it
- [x] 5.3 `apps/api/README.md`: the profile routes

## 6. Verification

- [x] 6.1 `pnpm nx affected -t lint typecheck test build`, `pnpm nx affected -t integration`, `pnpm nx e2e api-e2e`, `pnpm format:check`, `openspec validate --all --strict`
