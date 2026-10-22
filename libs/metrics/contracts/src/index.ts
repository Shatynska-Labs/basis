import { z } from 'zod';

// metrics' public surface (ADR-0012 §1): the temporary Health Connect
// intake's request and its summary (validate-health-connect-data design
// decisions 2 and 4). Phase 1's ingestion replaces both.

/** An HC Webhook delivery: its envelope is checked, every other key kept. */
export const HealthConnectDeliveryRequest = z.looseObject({
  timestamp: z.string(),
  app_version: z.string(),
});
export type HealthConnectDeliveryRequest = z.infer<
  typeof HealthConnectDeliveryRequest
>;

const Counts = z.record(z.string(), z.number().int());

const DelayStatistics = z.object({
  count: z.number().int(),
  medianSeconds: z.number().int(),
  p90Seconds: z.number().int(),
  maxSeconds: z.number().int(),
});

const Instant = z.iso.datetime({ offset: true });

export const HealthConnectSummaryResponse = z.object({
  deliveries: z.object({
    count: z.number().int(),
    firstReceivedAt: Instant.nullable(),
    lastReceivedAt: Instant.nullable(),
    appVersions: z.array(z.string()),
    timezones: z.array(z.string()),
  }),
  types: z.record(
    z.string(),
    z.object({
      records: z.number().int(),
      firstRecordAt: Instant.nullable(),
      lastRecordAt: Instant.nullable(),
      origins: Counts,
      recordingMethods: Counts,
      devices: Counts,
      shapes: Counts.optional(),
    }),
  ),
  sleep: z.object({ sessions: z.number().int(), stages: Counts }).optional(),
  exercise: z
    .object({
      sessions: z.number().int(),
      types: z.record(
        z.string(),
        z.object({ count: z.number().int(), recordingMethods: Counts }),
      ),
    })
    .optional(),
  delays: z.record(
    z.string(),
    z.object({
      toHealthConnect: DelayStatistics.optional(),
      toApi: DelayStatistics.optional(),
    }),
  ),
  deleted: Counts,
});
export type HealthConnectSummaryResponse = z.infer<
  typeof HealthConnectSummaryResponse
>;
