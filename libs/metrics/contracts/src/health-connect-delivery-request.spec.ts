// Derived from openspec/changes/validate-health-connect-data/specs/health-connect-intake/spec.md
// ("A signed-in caller's Health Connect delivery is stored as received", "The
// intake refuses what is not a signed-in delivery") before implementation.
// Provenance of each assertion is recorded in that change's test-plan.md.
//
// `HealthConnectDeliveryRequest` is the Zod schema design decision 6 names in
// `@basis/metrics-contracts`; it is assumed exported from this library's
// `src/index.ts` (an unresolved project question in test-plan.md). The same
// behaviour is observed over HTTP in
// apps/api/tests/integration/health-connect-intake.integration.spec.ts.
import { describe, expect, it } from 'vitest';

import { HealthConnectDeliveryRequest } from './index.js';

const DELIVERY = {
  timestamp: '2026-10-22T08:00:00Z',
  app_version: '1.9.25',
  timezone: 'UTC',
  steps: [
    {
      count: 120,
      start_time: '2026-10-22T07:00:00Z',
      end_time: '2026-10-22T07:15:00Z',
    },
  ],
  future_type: [{ anything: true }],
};

describe('health-connect-intake: HealthConnectDeliveryRequest', () => {
  it('a JSON object with a string timestamp and a string app_version is accepted with every key kept', () => {
    const result = HealthConnectDeliveryRequest.safeParse(DELIVERY);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(DELIVERY);
  });

  it.each([
    ['an object without timestamp', { app_version: '1.9.25' }],
    ['a JSON array', []],
  ] as const)('a body that is not a delivery is refused: %s', (_case, body) => {
    expect(HealthConnectDeliveryRequest.safeParse(body).success).toBe(false);
  });

  it.each([
    ['an object without app_version', { timestamp: '2026-10-22T08:00:00Z' }],
    [
      'a timestamp that is not a string',
      { timestamp: 1729584000, app_version: '1.9.25' },
    ],
    [
      'an app_version that is not a string',
      { timestamp: '2026-10-22T08:00:00Z', app_version: 1 },
    ],
    ['null', null],
    ['a string', 'delivery'],
  ] as const)(
    'a body that is not a delivery is refused: %s (specified by the requirement text)',
    (_case, body) => {
      expect(HealthConnectDeliveryRequest.safeParse(body).success).toBe(false);
    },
  );
});
