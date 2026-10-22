import type { HealthConnectSummaryResponse } from '@basis/metrics-contracts';

import type { StoredHealthConnectDelivery } from './ports.js';

// What arrived from HC Webhook, read from the stored deliveries
// (validate-health-connect-data design decisions 4 and 5). Values are taken
// only when they have the expected JSON type; anything else counts as
// `unknown` or is skipped, so a malformed record never fails the summary.

type Summary = HealthConnectSummaryResponse;
type Counts = Record<string, number>;
type Json = Record<string, unknown>;

const ENVELOPE = new Set(['timestamp', 'app_version', 'timezone', 'deleted']);
const SERIES = new Set([
  'heart_rate',
  'heart_rate_variability',
  'oxygen_saturation',
  'respiratory_rate',
  'skin_temperature',
]);
const UNKNOWN = 'unknown';

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Milliseconds since the epoch of an ISO 8601 instant with an offset, if it
 * is one; a time without an offset would depend on the server's time zone.
 */
const instantOf = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
};

const count = (counts: Counts, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const deviceLabel = (device: unknown): string => {
  if (!isObject(device)) return UNKNOWN;
  const type = stringOf(device['type']);
  const label = [
    stringOf(device['manufacturer']),
    stringOf(device['model']),
    type === undefined ? undefined : `(${type})`,
  ]
    .filter((part) => part !== undefined)
    .join(' ');
  return label === '' ? UNKNOWN : label;
};

/** A record's time: its end, else its session's end, else its instant. */
const recordTime = (record: Json): number | undefined =>
  instantOf(record['end_time']) ??
  instantOf(record['session_end_time']) ??
  instantOf(record['time']);

/** By nearest rank, over values sorted ascending. */
const percentile = (sorted: number[], p: number): number =>
  sorted[Math.max(Math.ceil(p * sorted.length), 1) - 1] as number;

const statistics = (seconds: number[]) => {
  const sorted = [...seconds].sort((a, b) => a - b);
  return {
    count: sorted.length,
    medianSeconds: percentile(sorted, 0.5),
    p90Seconds: percentile(sorted, 0.9),
    maxSeconds: sorted[sorted.length - 1] as number,
  };
};

const iso = (ms: number | undefined): string | null =>
  ms === undefined ? null : new Date(ms).toISOString();

interface TypeTally {
  records: number;
  first: number | undefined;
  last: number | undefined;
  origins: Counts;
  recordingMethods: Counts;
  devices: Counts;
  shapes: Counts | undefined;
  toHealthConnect: number[];
  toApi: number[];
}

const tallyFor = (type: string): TypeTally => ({
  records: 0,
  first: undefined,
  last: undefined,
  origins: {},
  recordingMethods: {},
  devices: {},
  shapes: SERIES.has(type) ? {} : undefined,
  toHealthConnect: [],
  toApi: [],
});

const tallyRecord = (
  tally: TypeTally,
  element: unknown,
  receivedAt: number,
): void => {
  tally.records += 1;
  const record = isObject(element) ? element : {};
  const metadata = isObject(record['metadata']) ? record['metadata'] : {};
  count(tally.origins, stringOf(metadata['data_origin']) ?? UNKNOWN);
  count(
    tally.recordingMethods,
    stringOf(metadata['recording_method']) ?? UNKNOWN,
  );
  count(tally.devices, deviceLabel(metadata['device']));
  if (tally.shapes) {
    const aggregate = 'avg' in record || 'avg_delta_celsius' in record;
    count(tally.shapes, aggregate ? 'aggregate' : 'sample');
  }

  const time = recordTime(record);
  const start = instantOf(record['start_time']) ?? time;
  if (
    start !== undefined &&
    (tally.first === undefined || start < tally.first)
  ) {
    tally.first = start;
  }
  if (time !== undefined && (tally.last === undefined || time > tally.last)) {
    tally.last = time;
  }

  const modified = instantOf(metadata['last_modified_time']);
  if (time !== undefined && modified !== undefined) {
    tally.toHealthConnect.push(Math.round((modified - time) / 1000));
    tally.toApi.push(Math.round((receivedAt - modified) / 1000));
  }
};

export const summarizeHealthConnectDeliveries = (
  deliveries: readonly StoredHealthConnectDelivery[],
): Summary => {
  const appVersions = new Set<string>();
  const timezones = new Set<string>();
  const tallies = new Map<string, TypeTally>();
  const deleted: Counts = {};
  let firstReceived: number | undefined;
  let lastReceived: number | undefined;
  let sleep: Summary['sleep'];
  let exercise: Summary['exercise'];

  for (const { receivedAt, payload } of deliveries) {
    const received = receivedAt.getTime();
    if (firstReceived === undefined || received < firstReceived)
      firstReceived = received;
    if (lastReceived === undefined || received > lastReceived)
      lastReceived = received;
    if (!isObject(payload)) continue;

    const appVersion = stringOf(payload['app_version']);
    if (appVersion !== undefined) appVersions.add(appVersion);
    const timezone = stringOf(payload['timezone']);
    if (timezone !== undefined) timezones.add(timezone);

    for (const [type, value] of Object.entries(payload)) {
      if (ENVELOPE.has(type) || !Array.isArray(value)) continue;
      let tally = tallies.get(type);
      if (!tally) {
        tally = tallyFor(type);
        tallies.set(type, tally);
      }
      for (const element of value) tallyRecord(tally, element, received);

      if (type === 'sleep') {
        sleep ??= { sessions: 0, stages: {} };
        for (const session of value) {
          sleep.sessions += 1;
          const stages = isObject(session) ? session['stages'] : undefined;
          if (!Array.isArray(stages)) continue;
          for (const stage of stages) {
            count(
              sleep.stages,
              (isObject(stage) ? stringOf(stage['stage']) : undefined) ??
                UNKNOWN,
            );
          }
        }
      }

      if (type === 'exercise') {
        exercise ??= { sessions: 0, types: {} };
        for (const session of value) {
          exercise.sessions += 1;
          const record = isObject(session) ? session : {};
          const metadata = isObject(record['metadata'])
            ? record['metadata']
            : {};
          const name = stringOf(record['type']) ?? UNKNOWN;
          const entry = (exercise.types[name] ??= {
            count: 0,
            recordingMethods: {},
          });
          entry.count += 1;
          count(
            entry.recordingMethods,
            stringOf(metadata['recording_method']) ?? UNKNOWN,
          );
        }
      }
    }

    const deletions = payload['deleted'];
    if (Array.isArray(deletions)) {
      for (const entry of deletions) {
        count(
          deleted,
          (isObject(entry) ? stringOf(entry['type']) : undefined) ?? UNKNOWN,
        );
      }
    }
  }

  const types: Summary['types'] = {};
  const delays: Summary['delays'] = {};
  for (const [type, tally] of tallies) {
    types[type] = {
      records: tally.records,
      firstRecordAt: iso(tally.first),
      lastRecordAt: iso(tally.last),
      origins: tally.origins,
      recordingMethods: tally.recordingMethods,
      devices: tally.devices,
      ...(tally.shapes ? { shapes: tally.shapes } : {}),
    };
    if (tally.toHealthConnect.length > 0) {
      delays[type] = {
        toHealthConnect: statistics(tally.toHealthConnect),
        toApi: statistics(tally.toApi),
      };
    }
  }

  return {
    deliveries: {
      count: deliveries.length,
      firstReceivedAt: iso(firstReceived),
      lastReceivedAt: iso(lastReceived),
      appVersions: [...appVersions],
      timezones: [...timezones],
    },
    types,
    ...(sleep ? { sleep } : {}),
    ...(exercise ? { exercise } : {}),
    delays,
    deleted,
  };
};
