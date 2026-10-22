// Derived from openspec/changes/validate-health-connect-data/specs/health-connect-intake/spec.md
// ("The intake refuses what is not a signed-in delivery", "The intake route
// accepts deliveries up to 10 MB", "The summary covers the caller's
// deliveries") before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md.
//
// These are the scenarios observable without a database: a request without
// a session is refused before any session is looked up, and the body parser
// runs before the guard (design decision 3). The application is the API's
// own `AppModule` (which imports `MetricsModule`, task 2.1), with the body
// parsers `useBodyParsers(app)` applies (`./http/body-parsers.ts`, design
// decision 3), as `main.ts` applies them, listening on a free local port and
// requested with `fetch`. No database is reachable: the pool opens no
// connection until a query.
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { useBodyParsers } from './http/body-parsers.js';

const DB_URL = 'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';
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
  const body = JSON.stringify({
    timestamp: '2026-10-22T08:10:00Z',
    app_version: '1.9.25',
    timezone: 'UTC',
    heart_rate: Array.from(
      { length: Math.ceil(bytes / perRecord) },
      () => record,
    ),
  });
  return body;
};

/** A JSON object whose text is at least `bytes` long. */
const jsonOfSize = (bytes: number) =>
  JSON.stringify({ filler: 'x'.repeat(bytes) });

// ---------------------------------------------------------------------------

describe('health-connect-intake: the API without a database', () => {
  let app: INestApplication;
  let baseUrl: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of [
      'DATABASE_URL',
      'PORT',
      'APP_VERSION',
      'GOOGLE_CLIENT_IDS',
      'SIGNUP_ALLOWED_EMAILS',
    ]) {
      saved[key] = process.env[key];
    }
    process.env['DATABASE_URL'] = DB_URL;
    delete process.env['PORT'];
    process.env['APP_VERSION'] = '3f2c9e1';
    process.env['GOOGLE_CLIENT_IDS'] = '1-web.apps.googleusercontent.com';
    process.env['SIGNUP_ALLOWED_EMAILS'] = 'ann@example.org';

    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    useBodyParsers(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const post = (path: string, body: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

  describe('the intake refuses what is not a signed-in delivery', () => {
    it('a delivery without a session is refused: POST /health-connect/deliveries with no Authorization header is 401', async () => {
      const response = await post(
        '/health-connect/deliveries',
        JSON.stringify({
          timestamp: '2026-10-22T08:00:00Z',
          app_version: '1.9.25',
        }),
      );
      await response.text();

      expect(response.status).toBe(401);
      // Derived: refused as every non-public route is (identity-authentication).
      expect(response.headers.get('content-type')).toMatch(problemContentType);
    });
  });

  describe('the summary covers the caller’s deliveries', () => {
    it('the summary without a session is refused: GET /health-connect/deliveries/summary with no Authorization header is 401', async () => {
      const response = await fetch(
        `${baseUrl}/health-connect/deliveries/summary`,
      );
      await response.text();

      expect(response.status).toBe(401);
    });
  });

  describe('the intake route accepts deliveries up to 10 MB', () => {
    it('a delivery over 10 MB is refused: a body of 11 MB posted to the intake route is 413', async () => {
      const response = await post(
        '/health-connect/deliveries',
        jsonOfSize(11 * MIB),
      );
      await response.text();

      expect(response.status).toBe(413);
    });

    it('other routes keep their limit: a JSON body of 2 MB posted to POST /auth/google is 413', async () => {
      const response = await post('/auth/google', jsonOfSize(2 * MIB));
      await response.text();

      expect(response.status).toBe(413);
    });

    it('a valid 2 MB delivery without a session reaches the guard: 401, not 413 (derived: control for the two refusals above)', async () => {
      const response = await post(
        '/health-connect/deliveries',
        deliveryOfSize(2 * MIB),
      );
      await response.text();

      expect(response.status).toBe(401);
    });

    it('with a trailing slash, a valid 2 MB delivery without a session reaches the guard too (derived from design decision 3)', async () => {
      const response = await post(
        '/health-connect/deliveries/',
        deliveryOfSize(2 * MIB),
      );
      await response.text();

      expect(response.status).toBe(401);
    });

    it('a path that merely begins with the intake route keeps the 100 kB limit: 2 MB is 413 (derived from design decision 3: the path exactly)', async () => {
      const response = await post(
        '/health-connect/deliveries-elsewhere',
        deliveryOfSize(2 * MIB),
      );
      await response.text();

      expect(response.status).toBe(413);
    });

    it('a POST to the summary path keeps the 100 kB limit: 2 MB to /health-connect/deliveries/summary is 413 (derived from design decision 3: the path exactly)', async () => {
      const response = await post(
        '/health-connect/deliveries/summary',
        deliveryOfSize(2 * MIB),
      );
      await response.text();

      expect(response.status).toBe(413);
    });
  });
});
