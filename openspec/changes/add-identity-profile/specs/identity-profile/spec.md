## ADDED Requirements

### Requirement: The caller's profile can be read

`GET /me/profile` SHALL answer `200` with the caller's profile: `timeZone` (an IANA zone name), `birthYear` and `enteredMaxHeartRate` (beats per minute), each `null` until set; `maxHeartRate`, the maximum heart rate in effect, as `{ bpm, source }` or `null`; and `heartRateZones`, the five zones derived from it, or `null` when there is no maximum heart rate. It SHALL require a session like every non-public route.

#### Scenario: A new user's profile is empty

- **WHEN** a user who has never changed their profile requests `GET /me/profile`
- **THEN** the response is `200` with `{ "timeZone": null, "birthYear": null, "enteredMaxHeartRate": null, "maxHeartRate": null, "heartRateZones": null }`

#### Scenario: The profile needs a session

- **WHEN** `GET /me/profile` or `PATCH /me/profile` is requested without a valid session
- **THEN** the response is `401` with `code` `identity.invalid-session`

#### Scenario: Each user has their own profile

- **WHEN** user A sets their time zone to `Europe/Kyiv` and user B then requests `GET /me/profile`
- **THEN** B's `timeZone` is `null`

### Requirement: The profile is changed field by field

`PATCH /me/profile` SHALL take any of `timeZone`, `birthYear` and `enteredMaxHeartRate`, change only the fields present, and answer `200` with the profile as it now stands, in the shape `GET /me/profile` answers. `birthYear` and `enteredMaxHeartRate` SHALL be cleared by `null`. `timeZone` SHALL NOT be cleared: once set it is only replaced. A body failing these rules SHALL be refused with `400`, changing nothing.

#### Scenario: Only the fields present change

- **WHEN** a user whose profile holds time zone `Europe/Kyiv` and birth year `1990` patches `{ "enteredMaxHeartRate": 185 }`
- **THEN** the response is `200` with `timeZone` `Europe/Kyiv`, `birthYear` `1990` and `enteredMaxHeartRate` `185`

#### Scenario: A field is cleared by null

- **WHEN** a user with entered maximum heart rate `185` patches `{ "enteredMaxHeartRate": null }`
- **THEN** the response has `enteredMaxHeartRate` `null`

#### Scenario: The time zone cannot be cleared

- **WHEN** a user patches `{ "timeZone": null }`
- **THEN** the response is `400` and the profile is unchanged

#### Scenario: An empty patch changes nothing

- **WHEN** a user patches `{}`
- **THEN** the response is `200` with the profile unchanged

### Requirement: The time zone is an IANA zone

`timeZone` SHALL be accepted only when it is a time zone name the runtime recognises, not an offset such as `+02:00`, and SHALL be stored and answered exactly as submitted. Basis SHALL NOT infer or default a user's time zone.

#### Scenario: A valid zone is accepted as submitted

- **WHEN** a user patches `{ "timeZone": "Europe/Kyiv" }`
- **THEN** the response is `200` with `timeZone` `Europe/Kyiv`, not a legacy alias such as `Europe/Kiev`

#### Scenario: An unknown zone or an offset is refused

- **WHEN** a user patches `{ "timeZone": "Mars/Olympus" }` or `{ "timeZone": "+02:00" }`
- **THEN** the response is `400` and the profile is unchanged

### Requirement: The birth year is plausible

`birthYear` SHALL be an integer from 120 years before the current year to 10 years before it, inclusive, the current year being the year of the current date in the user's time zone as the patch leaves it, or in UTC while none is set. An integer outside that range SHALL be refused with `422`, `code` `identity.implausible-birth-year`; a value that is not an integer SHALL be refused with `400`.

#### Scenario: A plausible year is accepted

- **WHEN** on 2026-11-08 a user patches `{ "birthYear": 1990 }`
- **THEN** the response is `200` with `birthYear` `1990`

#### Scenario: A year too recent is refused

- **WHEN** on 2026-11-08 a user patches `{ "birthYear": 2017 }`
- **THEN** the response is `422` with `code` `identity.implausible-birth-year`, and the profile is unchanged

#### Scenario: A year too distant is refused

- **WHEN** on 2026-11-08 a user patches `{ "birthYear": 1905 }`
- **THEN** the response is `422` with `code` `identity.implausible-birth-year`

#### Scenario: A non-integer is refused

- **WHEN** a user patches `{ "birthYear": 1990.5 }` or `{ "birthYear": "1990" }`
- **THEN** the response is `400`

### Requirement: An entered maximum heart rate is within human range

`enteredMaxHeartRate` SHALL be an integer from 100 to 230 beats per minute, inclusive; anything else SHALL be refused with `400`.

#### Scenario: A value in range is accepted

- **WHEN** a user patches `{ "enteredMaxHeartRate": 230 }`
- **THEN** the response has `enteredMaxHeartRate` `230`

#### Scenario: A value out of range is refused

- **WHEN** a user patches `{ "enteredMaxHeartRate": 99 }`, `{ "enteredMaxHeartRate": 231 }` or `{ "enteredMaxHeartRate": 180.5 }`
- **THEN** the response is `400` and the profile is unchanged

### Requirement: The maximum heart rate in effect

`maxHeartRate` SHALL be the entered maximum heart rate with `source` `entered` where one is set; otherwise, where a birth year is set, `208 − 0.7 × age` rounded to the nearest integer (halves up), with `source` `age-formula`, `age` being the current year, as the birth-year requirement defines it, minus the birth year; otherwise `null`.

#### Scenario: The entered value wins

- **WHEN** a user with birth year `1990` and entered maximum heart rate `190` reads their profile
- **THEN** `maxHeartRate` is `{ "bpm": 190, "source": "entered" }`

#### Scenario: The formula applies without an entered value

- **WHEN** on 2026-11-08 a user with birth year `1990` and no entered maximum heart rate reads their profile
- **THEN** `maxHeartRate` is `{ "bpm": 183, "source": "age-formula" }` (age 36: 208 − 25.2 = 182.8)

#### Scenario: Neither gives none

- **WHEN** a user with no birth year and no entered maximum heart rate reads their profile
- **THEN** `maxHeartRate` is `null` and `heartRateZones` is `null`

#### Scenario: The age follows the user's year

- **WHEN** at 2026-12-31T23:30:00Z a user with time zone `Europe/Kyiv`, birth year `1990` and no entered maximum heart rate reads their profile
- **THEN** the age is 37, since it is already 2027 in Kyiv, and `maxHeartRate` is `{ "bpm": 182, "source": "age-formula" }` (208 − 25.9 = 182.1)

### Requirement: Heart-rate zones are fixed shares of the maximum

`heartRateZones` SHALL be five zones, numbered 1 to 5, whose lower bounds are 50, 60, 70, 80 and 90 % of `maxHeartRate.bpm`, each rounded to the nearest integer (halves up). Each zone SHALL be answered as `{ zone, minBpm, maxBpm }`, both bounds inclusive: a zone's `maxBpm` is one less than the next zone's `minBpm`, and zone 5's `maxBpm` is `null`, so a heart rate above the maximum still counts in zone 5. A heart rate below zone 1's `minBpm` is in no zone.

#### Scenario: Zones of a maximum of 180

- **WHEN** a user whose `maxHeartRate.bpm` is `180` reads their profile
- **THEN** `heartRateZones` is `[{ "zone": 1, "minBpm": 90, "maxBpm": 107 }, { "zone": 2, "minBpm": 108, "maxBpm": 125 }, { "zone": 3, "minBpm": 126, "maxBpm": 143 }, { "zone": 4, "minBpm": 144, "maxBpm": 161 }, { "zone": 5, "minBpm": 162, "maxBpm": null }]`

#### Scenario: Bounds are rounded halves up

- **WHEN** a user whose `maxHeartRate.bpm` is `183` reads their profile
- **THEN** the zones' `minBpm` are `92`, `110`, `128`, `146` and `165` (91.5, 109.8, 128.1, 146.4, 164.7 rounded)
