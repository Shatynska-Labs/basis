// Derived from openspec/changes/deploy-api-skeleton/specs/api-health/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md. The API is started as a built process
// (apps/api/dist/main.js) through ./support/api-process; nothing is imported
// from apps/api (design decision 4).
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startApi, type ApiProcess } from './support/api-process.js';

// "a JSON content type": application/json or a +json suffix type, with or
// without parameters such as charset.
const jsonContentType = /^application\/([\w.-]+\+)?json\s*(;|$)/i;

const startupTimeout = 20_000;

describe('api-health: the API reports that it is alive, names its build, and carries nothing else', () => {
  let api: ApiProcess;

  beforeAll(async () => {
    api = await startApi({ appVersion: '3f2c9e1' });
  }, startupTimeout);

  afterAll(async () => {
    await api?.stop();
  });

  it('a running API answers its health check', async () => {
    const response = await request(api.baseUrl).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(jsonContentType);
    expect(response.body.status).toBe('ok');
  });

  it('a build identifier is reported unchanged', async () => {
    const response = await request(api.baseUrl).get('/health');

    expect(response.body.version).toBe('3f2c9e1');
  });

  it('the health check needs no credentials', async () => {
    // supertest sends no Authorization header, cookie or other credential
    // unless asked to.
    const response = await request(api.baseUrl).get('/health');

    expect(response.status).toBe(200);
  });

  it('the body holds only status and version', async () => {
    const response = await request(api.baseUrl).get('/health');

    expect(response.body).toBeTypeOf('object');
    expect(Array.isArray(response.body)).toBe(false);
    expect(Object.keys(response.body).sort()).toEqual(['status', 'version']);
  });
});

describe('api-health: no build identifier is reported as unknown', () => {
  it.each([
    ['with no build identifier', undefined],
    ['with an empty build identifier', ''],
  ] as const)(
    'no build identifier is reported as unknown: started %s',
    async (_case, appVersion) => {
      const api = await startApi({ appVersion });
      try {
        const response = await request(api.baseUrl).get('/health');

        expect(response.body.version).toBe('unknown');
      } finally {
        await api.stop();
      }
    },
    startupTimeout,
  );
});

describe('api-health: the health report depends on nothing outside the process', () => {
  // This suite's environment provides no database, queue, cache or object
  // store: the e2e target starts no Testcontainers and the harness passes the
  // API nothing but PORT and APP_VERSION beyond the inherited environment.
  it(
    'health is reported with no external service available',
    async () => {
      const api = await startApi({ appVersion: undefined });
      try {
        const response = await request(api.baseUrl).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      } finally {
        await api.stop();
      }
    },
    startupTimeout,
  );
});
