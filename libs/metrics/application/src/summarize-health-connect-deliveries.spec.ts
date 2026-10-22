// Derived from openspec/changes/validate-health-connect-data/specs/health-connect-intake/spec.md
// (the summary's requirements: "The summary covers the caller's deliveries"
// through "Malformed values do not fail the summary") and design decisions 4
// and 5, before implementation. Provenance of each assertion is recorded in
// that change's test-plan.md.
//
// `summarizeHealthConnectDeliveries` is the pure function design decision 6
// places in `@basis/metrics-application`, assumed exported from this
// library's `src/index.ts`. Its input is assumed to be the read port's
// answer, "the caller's deliveries, each as its arrival time and payload",
// as `{ receivedAt: Date; payload: unknown }[]`; its output is the
// `HealthConnectSummary` of decision 4, with every "counts by" a record from
// value to count, and the exercise types under `exercise.types` (unresolved
// project questions in test-plan.md). Instants in the output are compared as
// instants, so a `Date` or an ISO 8601 string both satisfy them.
//
// Fixtures are shaped like HC Webhook's documented payload (design, Context).
import { describe, expect, it } from 'vitest';

import { summarizeHealthConnectDeliveries } from './index.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

type Payload = Record<string, unknown>;

interface Delays {
  count: number;
  medianSeconds: number;
  p90Seconds: number;
  maxSeconds: number;
}

/** The parts of `HealthConnectSummary` (design decision 4) these tests read. */
interface Summary {
  deliveries: {
    count: number;
    firstReceivedAt: unknown;
    lastReceivedAt: unknown;
    appVersions: string[];
    timezones: string[];
  };
  types: Record<
    string,
    {
      records: number;
      firstRecordAt: unknown;
      lastRecordAt: unknown;
      origins: Record<string, number>;
      recordingMethods: Record<string, number>;
      devices: Record<string, number>;
      shapes?: Record<string, number>;
    }
  >;
  sleep?: { sessions: number; stages: Record<string, number> };
  exercise?: {
    sessions: number;
    types: Record<
      string,
      { count: number; recordingMethods: Record<string, number> }
    >;
  };
  delays: Record<string, { toHealthConnect?: Delays; toApi?: Delays }>;
  deleted: Record<string, number>;
}

/** A stored delivery as the read port answers it. */
const delivery = (payload: Payload, receivedAt = '2026-10-22T09:00:00Z') => ({
  receivedAt: new Date(receivedAt),
  payload: {
    timestamp: '2026-10-22T08:59:00Z',
    app_version: '1.9.25',
    timezone: 'UTC',
    ...payload,
  },
});

const summarize = (deliveries: ReturnType<typeof delivery>[]) =>
  summarizeHealthConnectDeliveries(deliveries) as unknown as Summary;

/** An instant as an ISO string, whether given as a `Date` or a string; `null` and `undefined` pass through. */
const instant = (value: unknown) =>
  value === null || value === undefined
    ? value
    : new Date(value as string | Date).toISOString();

const SHEALTH = 'com.sec.android.app.shealth';
const WATCH = { manufacturer: 'Samsung', model: 'SM-R960', type: 'WATCH' };

const metadata = (extra: Payload = {}) => ({
  id: `id-${Math.random().toString(36).slice(2)}`,
  data_origin: SHEALTH,
  recording_method: 'automatically_recorded',
  device: WATCH,
  last_modified_time: '2026-10-22T08:10:00Z',
  ...extra,
});

// ---------------------------------------------------------------------------

describe('health-connect-intake: the summary covers the caller’s deliveries', () => {
  it('no deliveries yet: count 0, no arrival times, empty types, delays and deleted, no sleep and no exercise', () => {
    const summary = summarize([]);

    expect(summary.deliveries.count).toBe(0);
    expect(summary.deliveries.firstReceivedAt).toBeNull();
    expect(summary.deliveries.lastReceivedAt).toBeNull();
    expect(summary.types).toEqual({});
    expect(summary.delays).toEqual({});
    expect(summary.deleted).toEqual({});
    expect(summary.sleep).toBeUndefined();
    expect(summary.exercise).toBeUndefined();
    // Derived: with no delivery, no app version or timezone was seen.
    expect(summary.deliveries.appVersions).toEqual([]);
    expect(summary.deliveries.timezones).toEqual([]);
  });

  it('count, first and last arrival, and the distinct app versions and timezones (specified by the requirement text)', () => {
    const summary = summarize([
      delivery(
        { app_version: '1.9.25', timezone: 'Europe/Kyiv' },
        '2026-10-22T09:00:00Z',
      ),
      delivery(
        { app_version: '1.9.24', timezone: 'UTC' },
        '2026-10-21T09:00:00Z',
      ),
      delivery(
        { app_version: '1.9.25', timezone: 'UTC' },
        '2026-10-23T09:00:00Z',
      ),
    ]);

    expect(summary.deliveries.count).toBe(3);
    expect(instant(summary.deliveries.firstReceivedAt)).toBe(
      '2026-10-21T09:00:00.000Z',
    );
    expect(instant(summary.deliveries.lastReceivedAt)).toBe(
      '2026-10-23T09:00:00.000Z',
    );
    expect([...summary.deliveries.appVersions].sort()).toEqual([
      '1.9.24',
      '1.9.25',
    ]);
    expect([...summary.deliveries.timezones].sort()).toEqual([
      'Europe/Kyiv',
      'UTC',
    ]);
  });
});

describe('health-connect-intake: the summary describes each data type', () => {
  it('types are counted by origin, method and device', () => {
    const summary = summarize([
      delivery({
        heart_rate: [
          {
            bpm: 61,
            time: '2026-10-22T08:00:00Z',
            metadata: metadata({ recording_method: 'automatically_recorded' }),
          },
          {
            bpm: 62,
            time: '2026-10-22T08:01:00Z',
            metadata: metadata({ recording_method: 'automatically_recorded' }),
          },
          {
            bpm: 90,
            time: '2026-10-22T08:02:00Z',
            metadata: metadata({ recording_method: 'actively_recorded' }),
          },
        ],
        steps: [
          {
            count: 120,
            start_time: '2026-10-22T07:00:00Z',
            end_time: '2026-10-22T07:15:00Z',
          },
        ],
      }),
    ]);

    const heartRate = summary.types['heart_rate'];
    expect(heartRate?.records).toBe(3);
    expect(heartRate?.origins).toEqual({ [SHEALTH]: 3 });
    expect(heartRate?.recordingMethods).toEqual({
      automatically_recorded: 2,
      actively_recorded: 1,
    });
    expect(heartRate?.devices).toEqual({ 'Samsung SM-R960 (WATCH)': 3 });
    const steps = summary.types['steps'];
    expect(steps?.origins).toEqual({ unknown: 1 });
    expect(steps?.recordingMethods).toEqual({ unknown: 1 });
    expect(steps?.devices).toEqual({ unknown: 1 });
  });

  it('every top-level key holding an array is a type, except timestamp, app_version, timezone and deleted; a key never holding an array is none (specified by the requirement text)', () => {
    const summary = summarize([
      delivery({
        steps: [{ count: 1, end_time: '2026-10-22T07:15:00Z' }],
        future_type: [{ value: 1 }],
        deleted: [{ type: 'steps', id: 'a' }],
        note: 'not an array',
      }),
    ]);

    expect(Object.keys(summary.types).sort()).toEqual(['future_type', 'steps']);
  });

  it('records are counted across deliveries (specified by the requirement text)', () => {
    const twoSteps = {
      steps: [
        { count: 1, end_time: '2026-10-22T07:15:00Z' },
        { count: 2, end_time: '2026-10-22T07:30:00Z' },
      ],
    };

    const summary = summarize([delivery(twoSteps), delivery(twoSteps)]);

    expect(summary.types['steps']?.records).toBe(4);
  });

  it.each([
    [{ manufacturer: 'Samsung', type: 'WATCH' }, 'Samsung (WATCH)'],
    [{ manufacturer: 'Samsung', model: 'SM-R960' }, 'Samsung SM-R960'],
  ] as const)(
    'a device %j is named %s, absent parts omitted (specified by the requirement text)',
    (device, name) => {
      const summary = summarize([
        delivery({
          steps: [
            {
              count: 1,
              end_time: '2026-10-22T07:15:00Z',
              metadata: { device },
            },
          ],
        }),
      ]);

      expect(summary.types['steps']?.devices).toEqual({ [name]: 1 });
    },
  );

  it('a record with metadata but no device counts as unknown among devices (specified by the requirement text)', () => {
    const summary = summarize([
      delivery({
        steps: [
          {
            count: 1,
            end_time: '2026-10-22T07:15:00Z',
            metadata: {
              data_origin: SHEALTH,
              recording_method: 'manual_entry',
            },
          },
        ],
      }),
    ]);

    expect(summary.types['steps']?.devices).toEqual({ unknown: 1 });
    expect(summary.types['steps']?.origins).toEqual({ [SHEALTH]: 1 });
    expect(summary.types['steps']?.recordingMethods).toEqual({
      manual_entry: 1,
    });
  });
});

describe('health-connect-intake: the summary spans each type’s records in time', () => {
  it("a type's time span", () => {
    const summary = summarize([
      delivery({
        steps: [
          {
            count: 120,
            start_time: '2026-10-22T07:00:00Z',
            end_time: '2026-10-22T07:15:00Z',
          },
          {
            count: 80,
            start_time: '2026-10-22T07:45:00Z',
            end_time: '2026-10-22T08:00:00Z',
          },
        ],
      }),
    ]);

    expect(instant(summary.types['steps']?.firstRecordAt)).toBe(
      '2026-10-22T07:00:00.000Z',
    );
    expect(instant(summary.types['steps']?.lastRecordAt)).toBe(
      '2026-10-22T08:00:00.000Z',
    );
  });

  it('a record without start_time contributes its record time to firstRecordAt (specified by the requirement text)', () => {
    const summary = summarize([
      delivery({
        heart_rate: [
          { bpm: 61, time: '2026-10-22T06:30:00Z' },
          { bpm: 62, time: '2026-10-22T08:30:00Z' },
        ],
      }),
    ]);

    expect(instant(summary.types['heart_rate']?.firstRecordAt)).toBe(
      '2026-10-22T06:30:00.000Z',
    );
    expect(instant(summary.types['heart_rate']?.lastRecordAt)).toBe(
      '2026-10-22T08:30:00.000Z',
    );
  });

  it('both are null when no record of the type has a time (specified by the requirement text)', () => {
    const summary = summarize([delivery({ future_type: [{ value: 1 }] })]);

    expect(summary.types['future_type']?.firstRecordAt).toBeNull();
    expect(summary.types['future_type']?.lastRecordAt).toBeNull();
  });

  it('a local time with an offset and its UTC form are the same instant (derived from design decision 5)', () => {
    const summary = summarize([
      delivery({
        steps: [
          {
            count: 1,
            start_time: '2026-10-22T09:00:00+02:00',
            end_time: '2026-10-22T09:15:00+02:00',
          },
        ],
      }),
    ]);

    expect(instant(summary.types['steps']?.firstRecordAt)).toBe(
      '2026-10-22T07:00:00.000Z',
    );
    expect(instant(summary.types['steps']?.lastRecordAt)).toBe(
      '2026-10-22T07:15:00.000Z',
    );
  });
});

describe('health-connect-intake: the summary tells samples from aggregates', () => {
  it('samples and aggregates are told apart', () => {
    const summary = summarize([
      delivery({
        heart_rate: [
          { bpm: 61, time: '2026-10-22T08:00:00Z' },
          {
            time: '2026-10-22T08:01:00Z',
            avg: 70,
            min: 60,
            max: 80,
            bpm: 70,
          },
        ],
      }),
    ]);

    expect(summary.types['heart_rate']?.shapes).toEqual({
      sample: 1,
      aggregate: 1,
    });
  });

  it('a record with avg_delta_celsius is an aggregate (specified by the requirement text)', () => {
    const summary = summarize([
      delivery({
        skin_temperature: [
          {
            start_time: '2026-10-22T00:00:00Z',
            end_time: '2026-10-22T06:00:00Z',
            avg_delta_celsius: 0.4,
          },
        ],
      }),
    ]);

    expect(summary.types['skin_temperature']?.shapes?.['aggregate']).toBe(1);
  });

  it.each([
    'heart_rate',
    'heart_rate_variability',
    'oxygen_saturation',
    'respiratory_rate',
    'skin_temperature',
  ])('%s holds shapes (specified by the requirement text)', (type) => {
    const summary = summarize([
      delivery({ [type]: [{ time: '2026-10-22T08:00:00Z' }] }),
    ]);

    expect(summary.types[type]?.shapes?.['sample']).toBe(1);
  });

  it('a type outside those five holds no shapes (derived from design decision 4)', () => {
    const summary = summarize([
      delivery({
        steps: [{ count: 1, avg: 3, end_time: '2026-10-22T07:15:00Z' }],
      }),
    ]);

    expect(summary.types['steps']?.shapes).toBeUndefined();
  });
});

describe('health-connect-intake: the summary lists sleep stages and exercise types', () => {
  it('sleep stages and exercise types are listed', () => {
    const summary = summarize([
      delivery({
        sleep: [
          {
            start_time: '2026-10-21T23:00:00Z',
            session_end_time: '2026-10-22T07:00:00Z',
            stages: [
              { stage: 'LIGHT' },
              { stage: 'DEEP' },
              { stage: 'LIGHT' },
              { stage: 'REM' },
            ],
          },
        ],
        exercise: [
          {
            type: 'STRENGTH_TRAINING',
            start_time: '2026-10-22T17:00:00Z',
            end_time: '2026-10-22T17:45:00Z',
            metadata: metadata({ recording_method: 'automatically_recorded' }),
          },
          {
            type: 'STRENGTH_TRAINING',
            start_time: '2026-10-21T17:00:00Z',
            end_time: '2026-10-21T17:45:00Z',
            metadata: metadata({ recording_method: 'actively_recorded' }),
          },
        ],
      }),
    ]);

    expect(summary.sleep?.sessions).toBe(1);
    expect(summary.sleep?.stages).toEqual({ LIGHT: 2, DEEP: 1, REM: 1 });
    expect(summary.exercise?.sessions).toBe(2);
    expect(summary.exercise?.types['STRENGTH_TRAINING']).toEqual({
      count: 2,
      recordingMethods: { automatically_recorded: 1, actively_recorded: 1 },
    });
  });
});

describe('health-connect-intake: the summary measures delays', () => {
  it('delays are measured', () => {
    const summary = summarize([
      delivery(
        {
          steps: [
            {
              count: 120,
              start_time: '2026-10-22T07:45:00Z',
              end_time: '2026-10-22T08:00:00Z',
              metadata: { last_modified_time: '2026-10-22T08:10:00Z' },
            },
          ],
        },
        '2026-10-22T09:00:00Z',
      ),
    ]);

    expect(summary.delays['steps']?.toHealthConnect).toEqual({
      count: 1,
      medianSeconds: 600,
      p90Seconds: 600,
      maxSeconds: 600,
    });
    expect(summary.delays['steps']?.toApi).toEqual({
      count: 1,
      medianSeconds: 3000,
      p90Seconds: 3000,
      maxSeconds: 3000,
    });
  });

  it.each([
    [
      'end_time before session_end_time and time',
      {
        end_time: '2026-10-22T08:00:00Z',
        session_end_time: '2026-10-22T07:00:00Z',
        time: '2026-10-22T06:00:00Z',
      },
    ],
    [
      'session_end_time before time',
      {
        session_end_time: '2026-10-22T08:00:00Z',
        time: '2026-10-22T06:00:00Z',
      },
    ],
    ['time alone', { time: '2026-10-22T08:00:00Z' }],
  ] as const)(
    "a record's time is %s (specified by the requirement text)",
    (_case, times) => {
      const summary = summarize([
        delivery({
          future_type: [
            {
              ...times,
              metadata: { last_modified_time: '2026-10-22T08:10:00Z' },
            },
          ],
        }),
      ]);

      expect(summary.delays['future_type']?.toHealthConnect?.maxSeconds).toBe(
        600,
      );
    },
  );

  it('each delay is rounded to whole seconds (specified by the requirement text)', () => {
    const summary = summarize([
      delivery(
        {
          steps: [
            {
              end_time: '2026-10-22T08:00:00Z',
              metadata: { last_modified_time: '2026-10-22T08:10:00.600Z' },
            },
          ],
        },
        '2026-10-22T09:00:00Z',
      ),
    ]);

    expect(summary.delays['steps']?.toHealthConnect?.maxSeconds).toBe(601);
    expect(summary.delays['steps']?.toApi?.maxSeconds).toBe(2999);
  });

  it('a negative delay is kept (specified by the requirement text)', () => {
    const summary = summarize([
      delivery({
        steps: [
          {
            end_time: '2026-10-22T08:00:00Z',
            metadata: { last_modified_time: '2026-10-22T07:59:00Z' },
          },
        ],
      }),
    ]);

    expect(summary.delays['steps']?.toHealthConnect).toEqual({
      count: 1,
      medianSeconds: -60,
      p90Seconds: -60,
      maxSeconds: -60,
    });
  });

  it('the median and 90th percentile are by nearest rank (specified by the requirement text)', () => {
    // Ten records ending at 08:00:00, last modified 10, 20, …, 100 seconds later.
    const steps = Array.from({ length: 10 }, (_, index) => ({
      end_time: '2026-10-22T08:00:00Z',
      metadata: {
        last_modified_time: new Date(
          Date.parse('2026-10-22T08:00:00Z') + (index + 1) * 10_000,
        ).toISOString(),
      },
    }));

    const summary = summarize([
      delivery({ steps: steps.reverse() }, '2026-10-22T09:00:00Z'),
    ]);

    expect(summary.delays['steps']?.toHealthConnect).toEqual({
      count: 10,
      medianSeconds: 50,
      p90Seconds: 90,
      maxSeconds: 100,
    });
    // Arrival 09:00:00 minus 08:00:10 … 08:01:40: 3590 … 3500 seconds.
    expect(summary.delays['steps']?.toApi).toEqual({
      count: 10,
      medianSeconds: 3540,
      p90Seconds: 3580,
      maxSeconds: 3590,
    });
  });

  it('only records with both a record time and a last modification are counted, and a type with none has no delays (specified by the requirement text)', () => {
    const summary = summarize([
      delivery({
        steps: [
          {
            end_time: '2026-10-22T08:00:00Z',
            metadata: { last_modified_time: '2026-10-22T08:10:00Z' },
          },
          { end_time: '2026-10-22T08:00:00Z' },
          { metadata: { last_modified_time: '2026-10-22T08:10:00Z' } },
        ],
        heart_rate: [{ bpm: 61, time: '2026-10-22T08:00:00Z' }],
      }),
    ]);

    expect(summary.delays['steps']?.toHealthConnect?.count).toBe(1);
    expect(summary.delays['heart_rate']).toBeUndefined();
  });
});

describe('health-connect-intake: the summary counts deletions', () => {
  it('deletions are counted', () => {
    const summary = summarize([
      delivery({
        deleted: [
          { type: 'steps', id: 'a' },
          { type: 'steps', id: 'b' },
        ],
      }),
    ]);

    expect(summary.deleted['steps']).toBe(2);
  });
});

describe('health-connect-intake: malformed values do not fail the summary', () => {
  it('malformed values are counted as unknown or skipped', () => {
    const summary = summarize([
      delivery({
        heart_rate: [{ bpm: 61, metadata: 'not an object', time: 1729584000 }],
        sleep: { stages: [{ stage: 'LIGHT' }] },
      }),
    ]);

    const heartRate = summary.types['heart_rate'];
    expect(heartRate?.records).toBe(1);
    expect(heartRate?.origins).toEqual({ unknown: 1 });
    expect(heartRate?.recordingMethods).toEqual({ unknown: 1 });
    expect(heartRate?.devices).toEqual({ unknown: 1 });
    expect(heartRate?.firstRecordAt).toBeNull();
    expect(heartRate?.lastRecordAt).toBeNull();
    expect(summary.delays['heart_rate']).toBeUndefined();
    expect(summary.sleep).toBeUndefined();
    // Specified by the requirement text: `sleep` held no array, so it is no type.
    expect(summary.types['sleep']).toBeUndefined();
  });
});
