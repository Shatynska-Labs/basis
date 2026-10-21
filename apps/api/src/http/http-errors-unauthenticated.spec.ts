// Derived from openspec/changes/add-identity-authentication/specs/api-http-errors/spec.md
// before implementation: the MODIFIED "A domain failure is answered by its
// kind" as revised, and the ADDED "A problem can carry response headers".
// Provenance of each assertion is recorded in that change's test-plan.md.
//
// "Of the API" is observed as http-errors.spec.ts observes it: a spec-local
// module imports `AppModule` and adds a spec-local controller, listening on a
// free local port, requested with `fetch`. Since this change every route
// requires a session unless declared public, so the probe controller is
// marked `@Public()` (from @basis/shared-infrastructure, design decision 7).
//
// The `ProblemException` carrying a header is the one `toResponse` throws for
// kind `unauthenticated` (design decision 9): its constructor is not stated by
// the change, its optional `headers` member is (design decision 7).
import { failure, success } from '@basis/shared-core';
import { DomainError, type DomainErrorKind } from '@basis/shared-domain';
import {
  ProblemException,
  Public,
  toResponse,
} from '@basis/shared-infrastructure';
import {
  Controller,
  Get,
  type INestApplication,
  type LoggerService,
  Module,
  Param,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

interface LogEntry {
  level: string;
  args: unknown[];
}

/** A LoggerService that records every entry, with its level. Found in http-errors.spec.ts. */
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

/** A domain failure with the scenario's code and message, of the given kind. Found in http-errors.spec.ts. */
class ExampleFailure extends DomainError {
  readonly code = 'habit.example';

  constructor(readonly kind: DomainErrorKind) {
    super('Example failure.');
  }
}

/** A header's value in a headers record, its name matched case-insensitively. */
const headerIn = (headers: unknown, name: string): unknown => {
  if (!headers || typeof headers !== 'object') return undefined;
  const entry = Object.entries(headers as Record<string, unknown>).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return entry?.[1];
};

/** What the rethrowing route observed of the exception `toResponse` threw. */
let observed: { isProblem: boolean; status: unknown; headers: unknown } | null =
  null;

@Public()
@Controller('probe-401')
class ProbeController {
  @Get('success')
  succeed() {
    return toResponse(success({ id: 'h1' }));
  }

  @Get('kind/:kind')
  failWith(@Param('kind') kind: string) {
    return toResponse(failure(new ExampleFailure(kind as DomainErrorKind)));
  }

  @Get('rethrow')
  rethrow() {
    try {
      toResponse(failure(new ExampleFailure('unauthenticated')));
    } catch (thrown) {
      observed = {
        isProblem: thrown instanceof ProblemException,
        status:
          thrown instanceof ProblemException ? thrown.getStatus() : undefined,
        headers: (thrown as { headers?: unknown }).headers,
      };
      throw thrown;
    }
    throw new Error('toResponse did not throw for a failure');
  }
}

@Module({ imports: [AppModule], controllers: [ProbeController] })
class ProbeModule {}

// ---------------------------------------------------------------------------

const DB_URL = 'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';

const problemContentType = /^application\/problem\+json\s*(;|$)/i;

describe('api-http-errors: unauthenticated failures and problem headers', () => {
  let app: INestApplication;
  let baseUrl: string;
  const captured = capturingLogger();
  const saved: Record<string, string | undefined> = {};

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
    observed = null;
  });

  describe('a domain failure is answered by its kind (as revised)', () => {
    it('a success is answered with its value', async () => {
      const response = await get('/probe-401/success');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'h1' });
    });

    it.each([
      ['not-found', 404],
      ['conflict', 409],
      ['rule-violated', 422],
      ['forbidden', 403],
      ['unauthenticated', 401],
    ] as const)(
      'each kind maps to its status: %s is %i',
      async (kind, status) => {
        const response = await get(`/probe-401/kind/${kind}`);
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

    it('an unauthenticated failure names the scheme', async () => {
      const response = await get('/probe-401/kind/unauthenticated');
      await response.text();

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    });

    it.each(['not-found', 'conflict', 'rule-violated', 'forbidden'] as const)(
      'a %s failure carries no WWW-Authenticate (derived from design decision 9: the header is set for kind unauthenticated)',
      async (kind) => {
        const response = await get(`/probe-401/kind/${kind}`);
        await response.text();

        expect(response.headers.get('www-authenticate')).toBeNull();
      },
    );

    it('an unauthenticated failure is not logged as a defect (derived from add-api-cross-cutting-basics design decision 8: 4xx responses are not logged)', async () => {
      await (await get('/probe-401/kind/unauthenticated')).text();

      expect(captured.entries.filter((e) => e.level === 'error')).toEqual([]);
    });
  });

  describe('a problem can carry response headers', () => {
    it('a header reaches the response', async () => {
      const response = await get('/probe-401/rethrow');
      await response.text();

      // The premise: the route threw a ProblemException of status 401 carrying
      // WWW-Authenticate: Bearer in its headers member.
      expect(observed?.isProblem).toBe(true);
      expect(observed?.status).toBe(401);
      expect(headerIn(observed?.headers, 'WWW-Authenticate')).toBe('Bearer');

      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toMatch(problemContentType);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    });
  });
});
