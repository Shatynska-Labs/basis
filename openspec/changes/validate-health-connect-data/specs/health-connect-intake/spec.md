## ADDED Requirements

### Requirement: A signed-in caller's Health Connect delivery is stored as received

The API SHALL accept `POST /health-connect/deliveries` from a caller with a valid session, with a body that is a JSON object holding a string `timestamp` and a string `app_version`. It SHALL store the whole body unchanged, every key included, with the caller's user identifier and the time it arrived, and SHALL answer `204` with no body. A delivery repeating records of an earlier one SHALL be stored again, not merged.

#### Scenario: A delivery is stored with its caller

- **WHEN** a signed-in user posts `{ "timestamp": "2026-10-22T08:00:00Z", "app_version": "1.9.25", "timezone": "UTC", "steps": [{ "count": 120, "start_time": "2026-10-22T07:00:00Z", "end_time": "2026-10-22T07:15:00Z" }] }`
- **THEN** the response has status `204` and no body, and one delivery is stored for that user whose payload equals the posted object and whose arrival time is the time of the request

#### Scenario: Unknown keys are kept

- **WHEN** a signed-in user posts a delivery holding a key `future_type` with an array value
- **THEN** the stored payload holds `future_type` with that array

#### Scenario: A repeated delivery is stored twice

- **WHEN** a signed-in user posts the same delivery twice
- **THEN** two deliveries are stored for that user

### Requirement: The intake refuses what is not a signed-in delivery

A body at `POST /health-connect/deliveries` that is not a JSON object holding a string `timestamp` and a string `app_version` SHALL be answered `400`. Without a valid session the route SHALL be answered `401`, as every non-public route is. In neither case SHALL anything be stored.

#### Scenario: A body that is not a delivery is refused

- **WHEN** a signed-in user posts `{ "app_version": "1.9.25" }`, or a JSON array
- **THEN** the response has status `400` and no delivery is stored

#### Scenario: A delivery without a session is refused

- **WHEN** a delivery is posted with no `Authorization` header
- **THEN** the response has status `401` and no delivery is stored

### Requirement: The intake route accepts deliveries up to 10 MB

The API SHALL accept a JSON body of up to 10 MB at `POST /health-connect/deliveries`, and SHALL answer a larger one `413`. Every other route SHALL keep refusing a JSON body over 100 kB with `413`.

#### Scenario: A large delivery reaches the intake route

- **WHEN** a signed-in user posts a valid delivery of 2 MB
- **THEN** the response has status `204`

#### Scenario: A delivery over 10 MB is refused

- **WHEN** a body of 11 MB is posted to the intake route
- **THEN** the response has status `413`

#### Scenario: Other routes keep their limit

- **WHEN** a JSON body of 2 MB is posted to `POST /auth/google`
- **THEN** the response has status `413`

### Requirement: The summary covers the caller's deliveries

The API SHALL answer `GET /health-connect/deliveries/summary` from a caller with a valid session with a summary of that caller's stored deliveries only. Its `deliveries` SHALL hold their `count`, `firstReceivedAt` and `lastReceivedAt` (`null` when there are none), and the distinct `appVersions` and `timezones` they carried. Without a valid session the route SHALL be answered `401`.

#### Scenario: No deliveries yet

- **WHEN** a signed-in user with no deliveries requests the summary
- **THEN** the response has status `200`, `deliveries.count` `0`, `firstReceivedAt` and `lastReceivedAt` `null`, and empty `types`, `delays` and `deleted`, with no `sleep` and no `exercise`

#### Scenario: Another user's deliveries are not summarised

- **WHEN** user A has two deliveries and user B has one, and user B requests the summary
- **THEN** `deliveries.count` is `1`

#### Scenario: The summary without a session is refused

- **WHEN** the summary is requested with no `Authorization` header
- **THEN** the response has status `401`

### Requirement: The summary describes each data type

The summary's `types` SHALL hold an entry for each top-level key other than `timestamp`, `app_version`, `timezone` and `deleted` whose value was an array in some delivery, with the number of `records` across deliveries and counts by `origins` (`metadata.data_origin`), `recordingMethods` (`metadata.recording_method`) and `devices` (`metadata.device` as `<manufacturer> <model> (<type>)`, absent parts omitted), counting a record without such a value as `unknown`.

#### Scenario: Types are counted by origin, method and device

- **WHEN** a user's deliveries hold three `heart_rate` records written by `com.sec.android.app.shealth`, two `automatically_recorded` and one `actively_recorded`, from device `Samsung` `SM-R960` of type `WATCH`, and one `steps` record with no `metadata`
- **THEN** `types.heart_rate.records` is `3`, its `origins` count `com.sec.android.app.shealth` `3`, its `recordingMethods` count `automatically_recorded` `2` and `actively_recorded` `1`, its `devices` count `Samsung SM-R960 (WATCH)` `3`; and `types.steps` counts `unknown` `1` in each of the three

### Requirement: The summary spans each type's records in time

Each type's entry SHALL hold `firstRecordAt`, the earliest of its records' `start_time`, or record time where a record has no `start_time`, and `lastRecordAt`, the latest record time, both as ISO 8601 instants, or `null` when no record of the type has a time.

#### Scenario: A type's time span

- **WHEN** a user's deliveries hold `steps` records from `2026-10-22T07:00:00Z` to `2026-10-22T07:15:00Z` and from `2026-10-22T07:45:00Z` to `2026-10-22T08:00:00Z`
- **THEN** `types.steps.firstRecordAt` is the instant `2026-10-22T07:00:00Z` and `types.steps.lastRecordAt` the instant `2026-10-22T08:00:00Z`

### Requirement: The summary tells samples from aggregates

For `heart_rate`, `heart_rate_variability`, `oxygen_saturation`, `respiratory_rate` and `skin_temperature`, the type's entry SHALL also hold `shapes`, counting `sample` records and `aggregate` records, a record with `avg` or `avg_delta_celsius` being an aggregate.

#### Scenario: Samples and aggregates are told apart

- **WHEN** a user's deliveries hold a `heart_rate` record `{ "bpm": 61, "time": "2026-10-22T08:00:00Z" }` and one `{ "time": "2026-10-22T08:01:00Z", "avg": 70, "min": 60, "max": 80, "bpm": 70 }`
- **THEN** `types.heart_rate.shapes` counts `sample` `1` and `aggregate` `1`

### Requirement: The summary lists sleep stages and exercise types

When a `sleep` array arrived, the summary's `sleep` SHALL hold the number of `sessions` and counts of `stages` by stage name. When an `exercise` array arrived, its `exercise` SHALL hold the number of `sessions` and, per exercise type, its `count` and counts by recording method. Otherwise each SHALL be absent.

#### Scenario: Sleep stages and exercise types are listed

- **WHEN** a user's deliveries hold one `sleep` session with stages `LIGHT`, `DEEP`, `LIGHT`, `REM`, and two `exercise` sessions of type `STRENGTH_TRAINING`, one `automatically_recorded` and one `actively_recorded`
- **THEN** `sleep.sessions` is `1` with `stages` counting `LIGHT` `2`, `DEEP` `1` and `REM` `1`, and `exercise.sessions` is `2` with type `STRENGTH_TRAINING` of `count` `2` counting each recording method `1`

### Requirement: The summary measures delays

For each type with records carrying both a record time and `metadata.last_modified_time`, the summary's `delays` SHALL hold `toHealthConnect` (last modification minus record time) and `toApi` (arrival minus last modification), each as `count`, `medianSeconds`, `p90Seconds` and `maxSeconds`: each delay rounded to whole seconds, negative ones kept, the percentiles by nearest rank. A record's time SHALL be its `end_time`, else `session_end_time`, else `time`.

#### Scenario: Delays are measured

- **WHEN** a user's only delivery arrived at `2026-10-22T09:00:00Z` holding one `steps` record ending at `2026-10-22T08:00:00Z` with `metadata.last_modified_time` `2026-10-22T08:10:00Z`
- **THEN** `delays.steps.toHealthConnect` is `{ count: 1, medianSeconds: 600, p90Seconds: 600, maxSeconds: 600 }` and `delays.steps.toApi` is `{ count: 1, medianSeconds: 3000, p90Seconds: 3000, maxSeconds: 3000 }`

### Requirement: The summary counts deletions

The summary's `deleted` SHALL count the deliveries' `deleted` entries by their `type`.

#### Scenario: Deletions are counted

- **WHEN** a user's deliveries hold `deleted` entries `{ "type": "steps", "id": "a" }` and `{ "type": "steps", "id": "b" }`
- **THEN** `deleted.steps` is `2`

### Requirement: Malformed values do not fail the summary

A value the summary reads that has an unexpected JSON type SHALL be counted as `unknown` or skipped, and SHALL NOT fail the summary.

#### Scenario: Malformed values are counted as unknown or skipped

- **WHEN** a user's delivery holds a `heart_rate` record whose `metadata` is a string and whose `time` is a number, and a `sleep` value that is an object rather than an array
- **THEN** the response has status `200`, the record counts as `unknown` in origins, methods and devices, it contributes no record time and no delay, and `sleep` is absent

### Requirement: A delivery's contents are not logged

The API SHALL NOT write a delivery's body, or any value from it, to its logs, whether the delivery is stored, refused, or fails to be stored.

#### Scenario: A stored delivery leaves no trace of its values in the logs

- **WHEN** a signed-in user posts a delivery holding a `heart_rate` record with `bpm` `61` and `metadata.data_origin` `com.example.marker`
- **THEN** no log entry contains `com.example.marker`

#### Scenario: A refused delivery leaves no trace of its values in the logs

- **WHEN** a signed-in user posts `{ "app_version": "1.9.25", "marker": "com.example.marker" }`
- **THEN** the response has status `400`, and no log entry contains `com.example.marker`

#### Scenario: A delivery that fails to be stored leaves no trace of its values in the logs

- **WHEN** a signed-in user posts a delivery holding `metadata.data_origin` `com.example.marker` and storing it fails in the database
- **THEN** the response has status `500`, an `error` entry is logged, and no log entry contains `com.example.marker`
