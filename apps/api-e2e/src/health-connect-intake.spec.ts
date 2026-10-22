// Derived from openspec/changes/validate-health-connect-data/specs/health-connect-intake/spec.md
// ("The intake refuses what is not a signed-in delivery", "The intake route
// accepts deliveries up to 10 MB", "The summary covers the caller's
// deliveries") and design decision 9, before implementation. Provenance of
// each assertion is recorded in that change's test-plan.md.
//
// The built API (apps/api/dist/main.js), whose bootstrap applies the body
// parsers (design decision 3), is started through ./support/api-process as
// identity-authentication.spec.ts starts it; nothing is imported from
// apps/api. No database is needed: nothing here reaches past the guard.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startApi } from './support/api-process.js';

const UNREACHABLE_URL =
  'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';
const startupTimeout = 20_000;
const MIB = 1024 * 1024;

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** A valid HC Webhook delivery whose JSON is at least `bytes` long: heart-rate samples with metadata. */
const deliveryOfSize = (bytes: number) => {
  const record = {
    bpm: 61,
    time: '2026-10-22T08:00:00Z',
    metadata: {
      id: '00000000-0000-0000-0000-000000000000',
      data_origin: 'com.sec.android.app.shealth',
      recording_method: 'automatically_recorded',
      device: { manufacturer: 'Samsung', model: 'SM-R960', type: 'WATCH' },
      last_modified_time: '2026-10-22T08:05:00Z',
    },
  };
  const perRecord = JSON.stringify(record).length + 1;
  return JSON.stringify({
    timestamp: '2026-10-22T08:10:00Z',
    app_version: '1.9.25',
    timezone: 'UTC',
    heart_rate: Array.from(
      { length: Math.ceil(bytes / perRecord) },
      () => record,
    ),
  });
};

// ---------------------------------------------------------------------------

const ENV_NAMES = [
  'DATABASE_URL',
  'GOOGLE_CLIENT_IDS',
  'SIGNUP_ALLOWED_EMAILS',
];

describe('health-connect-intake: the built API', () => {
  const saved: Record<string, string | undefined> = {};
  let api: Awaited<ReturnType<typeof startApi>>;

  beforeAll(async () => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    process.env['DATABASE_URL'] = UNREACHABLE_URL;
    process.env['GOOGLE_CLIENT_IDS'] = '1-web.apps.googleusercontent.com';
    delete process.env['SIGNUP_ALLOWED_EMAILS'];
    api = await startApi({ appVersion: '3f2c9e1' });
  }, startupTimeout);

  afterAll(async () => {
    await api?.stop();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const post = (path: string, body: string) =>
    fetch(`${api.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

  it('a delivery without a session is refused: POST /health-connect/deliveries with no Authorization header is a 401 problem', async () => {
    const response = await post(
      '/health-connect/deliveries',
      JSON.stringify({
        timestamp: '2026-10-22T08:00:00Z',
        app_version: '1.9.25',
      }),
    );
    await response.text();

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toMatch(problemContentType);
  });

  it('the summary without a session is refused: GET /health-connect/deliveries/summary with no Authorization header is 401', async () => {
    const response = await fetch(
      `${api.baseUrl}/health-connect/deliveries/summary`,
    );
    await response.text();

    expect(response.status).toBe(401);
  });

  it('a body over 100 kB but under 10 MB reaches the intake route’s guard: a valid 2 MB delivery without a session is 401, not 413 (design decision 9)', async () => {
    const response = await post(
      '/health-connect/deliveries',
      deliveryOfSize(2 * MIB),
    );
    await response.text();

    expect(response.status).toBe(401);
  });

  it('other routes keep their limit: the same 2 MB body to POST /auth/google is 413', async () => {
    const response = await post('/auth/google', deliveryOfSize(2 * MIB));
    await response.text();

    expect(response.status).toBe(413);
  });

  it('a delivery over 10 MB is refused: 11 MB to the intake route is 413', async () => {
    const response = await post(
      '/health-connect/deliveries',
      deliveryOfSize(11 * MIB),
    );
    await response.text();

    expect(response.status).toBe(413);
  });
});
