// Derived from openspec/changes/add-api-cross-cutting-basics/specs/api-configuration/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md. `loadConfig`, `ConfigError` and `APP_CONFIG` are the
// names design decision 1 fixes; they are imported from the folder's
// `index.ts`, an assumption recorded in test-plan.md (unresolved project
// question 1).
import { NestFactory } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { ConfigError, loadConfig } from './index.js';

const DB_URL = 'postgres://basis:secret@db.internal:5432/basis';

/** The error `loadConfig(env)` throws, or a failure where it throws none. */
const thrownBy = (env: Record<string, string | undefined>): unknown => {
  try {
    loadConfig(env);
  } catch (error) {
    return error;
  }
  throw new Error('loadConfig did not throw');
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

describe('api-configuration: the API configuration is validated as a whole', () => {
  it('every invalid variable is named at once: DATABASE_URL unset and PORT=abc', () => {
    const error = thrownBy({ PORT: 'abc' });

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('DATABASE_URL');
    expect(messageOf(error)).toContain('PORT');
  });

  it('the error names variables without echoing their values (derived from design decision 1)', () => {
    const error = thrownBy({ DATABASE_URL: '', PORT: 'n0t-a-p0rt' });

    expect(messageOf(error)).not.toContain('n0t-a-p0rt');
  });
});

describe('api-configuration: the configuration is validated when the API is created', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {
      DATABASE_URL: process.env['DATABASE_URL'],
      PORT: process.env['PORT'],
      APP_VERSION: process.env['APP_VERSION'],
    };
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('creating the application with PORT=abc fails naming PORT, before anything listens', async () => {
    process.env['DATABASE_URL'] = DB_URL;
    process.env['PORT'] = 'abc';

    await expect(
      NestFactory.createApplicationContext(AppModule, {
        logger: false,
        abortOnError: false,
      }),
    ).rejects.toThrow(/PORT/);
  });
});

describe('api-configuration: the database URL is required and used unchanged', () => {
  it.each([
    ['unset', {}],
    ['empty', { DATABASE_URL: '' }],
  ] as const)('a missing database URL is refused: %s', (_case, env) => {
    const error = thrownBy(env);

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('DATABASE_URL');
  });

  it('a whitespace database URL is used unchanged', () => {
    expect(loadConfig({ DATABASE_URL: ' ' }).databaseUrl).toBe(' ');
  });
});

describe('api-configuration: the port defaults to 3000 and is bounded', () => {
  it.each([
    ['unset', { DATABASE_URL: DB_URL }],
    ['empty', { DATABASE_URL: DB_URL, PORT: '' }],
  ] as const)('the port takes its default: %s', (_case, env) => {
    expect(loadConfig(env).port).toBe(3000);
  });

  it.each(['abc', '0', '65536', '-1', '80.5', ' 80', '080'])(
    'a malformed port is refused: PORT=%j',
    (port) => {
      const error = thrownBy({ DATABASE_URL: DB_URL, PORT: port });

      expect(error).toBeInstanceOf(ConfigError);
      expect(messageOf(error)).toContain('PORT');
    },
  );

  it.each([
    ['1', 1],
    ['65535', 65535],
  ] as const)(
    'the bounds themselves are accepted: PORT=%s (derived from the requirement text)',
    (port, expected) => {
      expect(loadConfig({ DATABASE_URL: DB_URL, PORT: port }).port).toBe(
        expected,
      );
    },
  );
});

describe('api-configuration: the build identifier defaults to unknown', () => {
  it.each([
    ['unset', { DATABASE_URL: DB_URL }],
    ['empty', { DATABASE_URL: DB_URL, APP_VERSION: '' }],
  ] as const)('the build identifier takes its default: %s', (_case, env) => {
    expect(loadConfig(env).appVersion).toBe('unknown');
  });
});
