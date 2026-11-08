// Derived from openspec/changes/add-identity-profile/specs/identity-profile/spec.md
// ("The caller's profile can be read", scenario "The profile needs a
// session") before implementation. Provenance of each assertion is recorded
// in that change's test-plan.md.
//
// The scenario observable without a database: a request with no credential
// is refused before any session is looked up, as authentication.spec.ts
// observes for `GET /me`. The application is the API's own `AppModule`,
// listening on a free local port and requested with `fetch`; no database is
// reachable. A request with a credential that names no session needs the
// database and is observed in
// apps/api/tests/integration/identity-profile.integration.spec.ts.
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';

const DB_URL = 'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

describe('identity-profile: the profile needs a session (no database)', () => {
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

  it.each([
    ['GET', 'without an Authorization header', undefined],
    ['PATCH', 'without an Authorization header', undefined],
    ['GET', 'with a scheme other than Bearer', 'Basic YW5uOnNlY3JldA=='],
    ['PATCH', 'with an empty token', 'Bearer'],
  ] as const)(
    '%s /me/profile %s is a 401 problem with code identity.invalid-session (specified; the header variants are derived from identity-authentication)',
    async (method, _case, authorization) => {
      const response = await fetch(`${baseUrl}/me/profile`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(authorization === undefined ? {} : { authorization }),
        },
        ...(method === 'PATCH'
          ? { body: JSON.stringify({ timeZone: 'Europe/Kyiv' }) }
          : {}),
      });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(body['code']).toBe('identity.invalid-session');
    },
  );
});
