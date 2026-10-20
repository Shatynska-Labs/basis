// Derived from openspec/changes/add-identity-authentication/specs/identity-authentication/spec.md
// ("Every route requires a session unless declared public", "Signing in with
// Google opens a session" for its body schema) and
// specs/shared-infrastructure/spec.md ("Other contexts read the caller from
// the shared infrastructure", scenario "A declared public route") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md.
//
// These are the scenarios observable without a database: a request refused
// for a missing, malformed or empty credential never looks a session up
// (design decision 7), and a body failing its schema is refused before any
// handler runs. The application is built from a spec-local module importing
// `AppModule` (which imports `IdentityModule`, task 3.6) and adding a
// controller outside `identity`, listening on a free local port, requested
// with `fetch`. No database is reachable: the pool opens no connection until
// a query.
import { Public } from '@basis/shared-infrastructure';
import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

@Controller('probe-auth')
class OutsideIdentityController {
  @Public()
  @Get('open')
  open() {
    return { reached: 'open' };
  }

  @Get('closed')
  closed() {
    return { reached: 'closed' };
  }
}

@Module({ imports: [AppModule], controllers: [OutsideIdentityController] })
class ProbeModule {}

// ---------------------------------------------------------------------------

const DB_URL = 'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

describe('identity-authentication: every route requires a session unless declared public (no database)', () => {
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

    app = await NestFactory.create(ProbeModule, {
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

  const getWith = (path: string, authorization?: string) =>
    fetch(`${baseUrl}${path}`, {
      headers:
        authorization === undefined ? {} : { authorization: authorization },
    });

  describe('no credentials', () => {
    it.each([
      ['without an Authorization header', undefined],
      ['with a scheme other than Bearer', 'Basic YW5uOnNlY3JldA=='],
      ['with an empty token', 'Bearer'],
      ['with an empty token after the scheme and spaces', 'Bearer    '],
    ] as const)(
      'GET /me %s is a 401 problem with code identity.invalid-session and WWW-Authenticate: Bearer',
      async (_case, authorization) => {
        const response = await getWith('/me', authorization);
        const body = (await response.json()) as Record<string, unknown>;

        expect(response.status).toBe(401);
        expect(response.headers.get('content-type')).toMatch(
          problemContentType,
        );
        expect(body['code']).toBe('identity.invalid-session');
        expect(response.headers.get('www-authenticate')).toBe('Bearer');
      },
    );

    it('the refusal is a full problem document with the detail design decision 7 names (derived from design decision 7)', async () => {
      const body = (await (await getWith('/me')).json()) as Record<
        string,
        unknown
      >;

      expect(body['type']).toBe('about:blank');
      expect(body['title']).toBe('Unauthorized');
      expect(body['status']).toBe(401);
      expect(body['detail']).toBe('Authentication is required.');
    });

    it('a route of another context that is not declared public is refused too (specified by the requirement text "Every route")', async () => {
      const response = await getWith('/probe-auth/closed');
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(body['code']).toBe('identity.invalid-session');
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    });

    it('POST /auth/sign-out without a session is refused (derived: the route is not declared public)', async () => {
      const response = await fetch(`${baseUrl}/auth/sign-out`, {
        method: 'POST',
      });
      await response.text();

      expect(response.status).toBe(401);
    });
  });

  describe('public routes need no session', () => {
    it('GET /health without an Authorization header is 200 with the health report', async () => {
      const response = await getWith('/health');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'ok',
        version: '3f2c9e1',
      });
    });

    it('POST /auth/google is public: a body failing its schema is answered 400, not 401 (specified by the requirement text "POST /auth/google SHALL be public")', async () => {
      const response = await fetch(`${baseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      await response.text();

      expect(response.status).toBe(400);
    });

    it('an unknown route stays a 404, not a 401 (derived from design decision 7 and api-http-errors "An unknown route is a problem document")', async () => {
      const response = await getWith('/no-such-route');
      await response.text();

      expect(response.status).toBe(404);
    });
  });

  describe('shared-infrastructure: a declared public route', () => {
    it('a controller method marked @Public() outside identity, requested without credentials, is not refused for lack of a session', async () => {
      const response = await getWith('/probe-auth/open');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ reached: 'open' });
    });
  });

  describe('signing in with Google: a body without a token is refused', () => {
    it.each([
      ['{}', {}],
      ['{ "idToken": "" }', { idToken: '' }],
    ] as const)(
      'POST /auth/google with %s is a 400 problem',
      async (_case, body) => {
        const response = await fetch(`${baseUrl}/auth/google`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const parsed = (await response.json()) as Record<string, unknown>;

        expect(response.status).toBe(400);
        expect(response.headers.get('content-type')).toMatch(
          problemContentType,
        );
        expect(parsed['status']).toBe(400);
      },
    );
  });
});
