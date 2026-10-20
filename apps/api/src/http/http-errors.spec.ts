// Derived from openspec/changes/add-api-cross-cutting-basics/specs/api-http-errors/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md.
//
// "Of the API" is observed through the API's own module: the application is
// built from a spec-local module that imports `AppModule` (and so whatever
// filter and pipe it registers) and adds a spec-local controller whose routes
// each provoke one scenario. It listens on a free local port and is requested
// with `fetch`. Log entries are observed through a capturing `LoggerService`
// passed to `NestFactory.create`, which Nest makes the logger behind every
// `Logger` in the application (an assumption recorded in test-plan.md). No
// database is reachable: the pool opens no connection until a query.
//
// Imports this file expects the implementation to provide: `toResponse` from
// @basis/shared-infrastructure, `DomainError` and `DomainErrorKind` from
// @basis/shared-domain, `success` and `failure` from @basis/shared-core, and
// `zod`, all resolvable from apps/api (tasks 1.1, 3.1, 3.2).
import { STATUS_CODES } from 'node:http';

import { failure, success } from '@basis/shared-core';
import { DomainError, type DomainErrorKind } from '@basis/shared-domain';
import { toResponse } from '@basis/shared-infrastructure';
import {
  Body,
  Controller,
  Get,
  HttpException,
  type INestApplication,
  type LoggerService,
  Module,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from '../app.module.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

interface LogEntry {
  level: string;
  args: unknown[];
}

/** A LoggerService that records every entry, with its level, instead of printing it. */
const capturingLogger = () => {
  const entries: LogEntry[] = [];
  const at =
    (level: string) =>
    (...args: unknown[]) => {
      entries.push({ level, args });
    };
  const logger: LoggerService = {
    log: at('log'),
    error: at('error'),
    warn: at('warn'),
    debug: at('debug'),
    verbose: at('verbose'),
    fatal: at('fatal'),
  };
  return { logger, entries };
};

/** An entry's arguments as text, with any `Error` among them spelled out as its name, message and stack. */
const serialize = (entry: LogEntry): string =>
  JSON.stringify(entry.args, (_key, value: unknown) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value,
  );

/** Throws `value` as it is, whatever it is. */
const raise = (value: unknown): never => {
  throw value;
};

/** A domain failure with the scenario's code and message, of the given kind. */
class ExampleFailure extends DomainError {
  readonly code = 'habit.example';

  constructor(readonly kind: DomainErrorKind) {
    super('Example failure.');
  }
}

/** What the validation routes' handlers were invoked with. */
const handled: { bodies: unknown[]; queries: unknown[] } = {
  bodies: [],
  queries: [],
};

/** The error the defect route last threw, kept so its stack can be compared. */
let lastThrown: Error | undefined;

const bodySchema = z.object({
  name: z.string(),
  count: z.number().int().positive(),
});
const querySchema = z.object({ limit: z.coerce.number().int() });

@Controller('probe')
class ProbeController {
  @Get('success')
  succeed() {
    return toResponse(success({ id: 'h1' }));
  }

  @Get('kind/:kind')
  failWith(@Param('kind') kind: string) {
    return toResponse(failure(new ExampleFailure(kind as DomainErrorKind)));
  }

  @Get('error')
  throwError() {
    lastThrown = new Error('n0t-for-clients');
    throw lastThrown;
  }

  @Get('named-error')
  throwNamedError() {
    class N0tForClientsDefect extends Error {
      override name = 'N0tForClientsDefect';
    }
    lastThrown = new N0tForClientsDefect('n0t-for-clients');
    throw lastThrown;
  }

  @Get('unavailable')
  throwUnavailable() {
    throw new ServiceUnavailableException('n0t-for-clients');
  }

  @Get('string')
  throwString() {
    return raise('n0t-for-logs');
  }

  @Get('upstream')
  throwUpstream() {
    throw Object.assign(new Error('upstream refused'), { status: 401 });
  }

  @Get('no-reason-phrase')
  throwNoReasonPhrase() {
    throw new HttpException('n0t-a-phrase', 499);
  }

  @Post('echo')
  echo(@Body() body: unknown) {
    return { received: typeof body };
  }

  @Post('items')
  create(@Body({ schema: bodySchema }) body: unknown) {
    handled.bodies.push(body);
    return { ok: true };
  }

  @Get('items')
  list(@Query({ schema: querySchema }) query: { limit: unknown }) {
    handled.queries.push(query);
    return { ok: true };
  }
}

@Module({ imports: [AppModule], controllers: [ProbeController] })
class ProbeModule {}

// ---------------------------------------------------------------------------

const DB_URL = 'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';

const problemContentType = /^application\/problem\+json\s*(;|$)/i;
const jsonContentType = /^application\/([\w.-]+\+)?json\s*(;|$)/i;

const keysOf = (body: unknown) =>
  Object.keys(body as Record<string, unknown>).sort();

describe('api-http-errors', () => {
  let app: INestApplication;
  let baseUrl: string;
  const captured = capturingLogger();
  const saved: Record<string, string | undefined> = {};

  const errorEntries = () =>
    captured.entries.filter((entry) => entry.level === 'error');

  const get = (path: string) => fetch(`${baseUrl}${path}`);

  beforeAll(async () => {
    for (const key of ['DATABASE_URL', 'PORT', 'APP_VERSION']) {
      saved[key] = process.env[key];
    }
    process.env['DATABASE_URL'] = DB_URL;
    delete process.env['PORT'];
    process.env['APP_VERSION'] = '3f2c9e1';

    app = await NestFactory.create(ProbeModule, {
      logger: captured.logger,
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

  beforeEach(() => {
    captured.entries.length = 0;
    handled.bodies.length = 0;
    handled.queries.length = 0;
    lastThrown = undefined;
  });

  describe('error responses are problem documents', () => {
    it('an unknown route is a problem document', async () => {
      const response = await get('/no-such-route');
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(body['type']).toBe('about:blank');
      expect(body['title']).toBe('Not Found');
      expect(body['status']).toBe(404);
    });

    it('the health report is unaffected', async () => {
      const response = await get('/health');
      const contentType = response.headers.get('content-type') ?? '';

      expect(response.status).toBe(200);
      expect(contentType).toMatch(jsonContentType);
      expect(contentType).not.toMatch(problemContentType);
      // The body api-health specifies: status "ok" and the build identifier, nothing else.
      expect(await response.json()).toEqual({
        status: 'ok',
        version: '3f2c9e1',
      });
    });

    it('a status with no reason phrase is titled "Error" (specified by the requirement text)', async () => {
      const response = await get('/probe/no-reason-phrase');
      const body = (await response.json()) as Record<string, unknown>;

      expect(STATUS_CODES[499]).toBeUndefined();
      expect(response.status).toBe(499);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(body['type']).toBe('about:blank');
      expect(body['title']).toBe('Error');
      expect(body['status']).toBe(499);
    });
  });

  describe('a domain failure is answered by its kind', () => {
    it('a success is answered with its value', async () => {
      const response = await get('/probe/success');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'h1' });
    });

    it.each([
      ['not-found', 404],
      ['conflict', 409],
      ['rule-violated', 422],
      ['forbidden', 403],
    ] as const)(
      'each kind maps to its status: %s is %i',
      async (kind, status) => {
        const response = await get(`/probe/kind/${kind}`);
        const body = (await response.json()) as Record<string, unknown>;

        expect(response.status).toBe(status);
        expect(response.headers.get('content-type')).toMatch(
          problemContentType,
        );
        expect(body['status']).toBe(response.status);
        expect(body['detail']).toBe('Example failure.');
        expect(body['code']).toBe('habit.example');
      },
    );

    it.each([
      ['not-found', 404],
      ['conflict', 409],
      ['rule-violated', 422],
      ['forbidden', 403],
    ] as const)(
      'a %s failure is a full problem document: type about:blank and the reason phrase of %i (specified by "Error responses are problem documents")',
      async (kind, status) => {
        const body = (await (
          await get(`/probe/kind/${kind}`)
        ).json()) as Record<string, unknown>;

        expect(body['type']).toBe('about:blank');
        expect(body['title']).toBe(STATUS_CODES[status]);
      },
    );

    it('a domain failure is not logged as a defect (derived from design decision 8: 4xx responses are not logged)', async () => {
      await get('/probe/kind/conflict');

      expect(errorEntries()).toEqual([]);
    });
  });

  describe('a request failing its schema is refused', () => {
    const postItems = (body: unknown) =>
      fetch(`${baseUrl}/probe/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('an invalid body is refused with its issues', async () => {
      const response = await postItems({ count: -1 });
      const body = (await response.json()) as {
        errors?: { path?: unknown; message?: unknown }[];
      };

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(Array.isArray(body.errors)).toBe(true);
      const errors = body.errors ?? [];
      const byPath = (path: string[]) =>
        errors.find(
          (entry) => JSON.stringify(entry.path) === JSON.stringify(path),
        );
      for (const path of [['name'], ['count']]) {
        const entry = byPath(path);
        expect(
          entry,
          `an errors entry with path ${JSON.stringify(path)}`,
        ).toBeDefined();
        expect(typeof entry?.message).toBe('string');
        expect(entry?.message).not.toBe('');
      }
      expect(handled.bodies).toEqual([]);
    });

    it('an invalid query is refused', async () => {
      const response = await get('/probe/items?limit=many');
      const body = (await response.json()) as {
        errors?: { path?: unknown }[];
      };

      expect(response.status).toBe(400);
      expect(
        (body.errors ?? []).some(
          (entry) => JSON.stringify(entry.path) === JSON.stringify(['limit']),
        ),
      ).toBe(true);
      expect(handled.queries).toEqual([]);
    });

    it('a valid request reaches the handler parsed', async () => {
      const response = await get('/probe/items?limit=5');

      expect(response.status).toBe(200);
      expect(handled.queries).toHaveLength(1);
      expect((handled.queries[0] as { limit: unknown }).limit).toBe(5);
    });

    it('a valid body reaches the handler as the value the schema produces (specified by the requirement text)', async () => {
      const response = await postItems({ name: 'walk', count: 3 });

      expect(response.status).toBeLessThan(300);
      expect(handled.bodies).toEqual([{ name: 'walk', count: 3 }]);
    });

    it('a refused request is a problem document titled for 400 (specified by "Error responses are problem documents")', async () => {
      const body = (await (await postItems({ count: -1 })).json()) as Record<
        string,
        unknown
      >;

      expect(body['type']).toBe('about:blank');
      expect(body['title']).toBe('Bad Request');
      expect(body['status']).toBe(400);
    });
  });

  describe('a defect is answered without disclosure and logged', () => {
    it('a thrown error is not disclosed', async () => {
      const response = await get('/probe/error');
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(keysOf(JSON.parse(text))).toEqual(['status', 'title', 'type']);
      expect(text).not.toContain('n0t-for-clients');
      expect(errorEntries()).toHaveLength(1);
    });

    it('a server-side HTTP exception is not disclosed', async () => {
      const response = await get('/probe/unavailable');
      const text = await response.text();

      expect(response.status).toBe(503);
      expect(keysOf(JSON.parse(text))).toEqual(['status', 'title', 'type']);
      expect(text).not.toContain('n0t-for-clients');
      expect(errorEntries()).toHaveLength(1);
    });

    it('a defect body holds the reason phrase of its status (specified by "Error responses are problem documents")', async () => {
      const body = (await (await get('/probe/unavailable')).json()) as Record<
        string,
        unknown
      >;

      expect(body).toEqual({
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
      });
    });
  });

  describe("a defect's log entry discloses only what is safe", () => {
    it('a thrown error is logged with its stack', async () => {
      await get('/probe/error');
      const [entry] = errorEntries();

      expect(lastThrown?.stack).toBeTypeOf('string');
      expect(entry).toBeDefined();
      const logged = serialize(entry as LogEntry);
      expect(logged).toContain(lastThrown?.name ?? '(no thrown error)');
      expect(logged).toContain(
        JSON.stringify(lastThrown?.stack ?? '(no stack)').slice(1, -1),
      );
    });

    it('a thrown error is logged with its own name, not a fixed one (derived: the scenario\'s "Error" name alone cannot tell the two apart)', async () => {
      await get('/probe/named-error');
      const [entry] = errorEntries();

      expect(entry).toBeDefined();
      expect(serialize(entry as LogEntry)).toContain('N0tForClientsDefect');
    });

    it('a thrown non-error is logged by type only', async () => {
      const response = await get('/probe/string');
      await response.text();
      const entries = errorEntries();

      expect(response.status).toBe(500);
      expect(entries.length).toBeGreaterThan(0);
      const logged = entries.map(serialize).join('\n');
      expect(logged).toContain('string');
      expect(logged).not.toContain('n0t-for-logs');
    });

    it('a thrown non-error is not disclosed to the client either (specified by "A defect is answered without disclosure")', async () => {
      const response = await get('/probe/string');
      const text = await response.text();

      expect(keysOf(JSON.parse(text))).toEqual(['status', 'title', 'type']);
      expect(text).not.toContain('n0t-for-logs');
    });
  });

  describe('a client error raised outside the framework keeps its status', () => {
    it('an oversized body is refused as too large', async () => {
      // Two mebibytes: well above the body parser's limit (Express's default is 100 kB).
      const oversized = JSON.stringify({ filler: 'x'.repeat(2 * 1024 * 1024) });

      const response = await fetch(`${baseUrl}/probe/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: oversized,
      });
      const text = await response.text();

      expect(response.status).toBe(413);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(keysOf(JSON.parse(text))).toEqual(['status', 'title', 'type']);
      expect(errorEntries()).toEqual([]);
    });

    it('a body within the limit reaches the route (control: the 413 above comes from the size)', async () => {
      const response = await fetch(`${baseUrl}/probe/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filler: 'x' }),
      });

      expect(response.status).toBeLessThan(300);
    });

    it('an upstream error carrying a client status is a defect', async () => {
      const response = await get('/probe/upstream');
      await response.text();

      expect(response.status).toBe(500);
      expect(errorEntries()).toHaveLength(1);
    });
  });
});
