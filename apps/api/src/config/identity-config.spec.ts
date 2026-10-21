// Derived from openspec/changes/add-identity-authentication/specs/api-configuration/spec.md
// before implementation: the MODIFIED "The API's configuration is validated
// as a whole" as revised, and the ADDED "Google client IDs are an optional
// list" and "The sign-up allowlist is an optional list of emails".
// Provenance of each assertion is recorded in that change's test-plan.md.
// `loadConfig`, `ConfigError` and `APP_CONFIG` are imported from the
// configuration folder's `index.ts`, as config.spec.ts does; the new members
// are `googleClientIds` and `signupAllowedEmails`, the names the requirement
// gives.
import { NestFactory } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { APP_CONFIG, ConfigError, loadConfig } from './index.js';

const DB_URL = 'postgres://basis:secret@db.internal:5432/basis';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** The error `loadConfig(env)` throws, or a failure where it throws none. Found in config.spec.ts. */
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

// ---------------------------------------------------------------------------

describe('api-configuration: the API configuration is validated as a whole (as revised)', () => {
  it('a complete environment is read', () => {
    expect(
      loadConfig({
        DATABASE_URL: DB_URL,
        PORT: '8080',
        APP_VERSION: '3f2c9e1',
        GOOGLE_CLIENT_IDS: '123-web.apps.googleusercontent.com',
        SIGNUP_ALLOWED_EMAILS: 'ann@example.org',
      }),
    ).toEqual({
      databaseUrl: DB_URL,
      port: 8080,
      appVersion: '3f2c9e1',
      googleClientIds: ['123-web.apps.googleusercontent.com'],
      signupAllowedEmails: ['ann@example.org'],
    });
  });

  it('every invalid variable is named at once: DATABASE_URL unset and PORT=abc', () => {
    const error = thrownBy({ PORT: 'abc' });

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('DATABASE_URL');
    expect(messageOf(error)).toContain('PORT');
  });

  it('every invalid variable is named at once: both new variables malformed (specified by the requirement text "names every invalid variable")', () => {
    const error = thrownBy({
      DATABASE_URL: DB_URL,
      GOOGLE_CLIENT_IDS: 'not-a-client-id',
      SIGNUP_ALLOWED_EMAILS: 'carol',
    });

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('GOOGLE_CLIENT_IDS');
    expect(messageOf(error)).toContain('SIGNUP_ALLOWED_EMAILS');
  });
});

describe('api-configuration: Google client IDs are an optional list', () => {
  it('two client IDs', () => {
    expect(
      loadConfig({
        DATABASE_URL: DB_URL,
        GOOGLE_CLIENT_IDS:
          ' 1-web.apps.googleusercontent.com, ,2-android.apps.googleusercontent.com',
      }).googleClientIds,
    ).toEqual([
      '1-web.apps.googleusercontent.com',
      '2-android.apps.googleusercontent.com',
    ]);
  });

  it.each([
    ['unset', { DATABASE_URL: DB_URL }],
    ['empty', { DATABASE_URL: DB_URL, GOOGLE_CLIENT_IDS: '' }],
  ] as const)('unset client IDs: %s', (_case, env) => {
    expect(loadConfig(env).googleClientIds).toEqual([]);
  });

  it('a malformed client ID', () => {
    const error = thrownBy({
      DATABASE_URL: DB_URL,
      GOOGLE_CLIENT_IDS: 'not-a-client-id',
    });

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('GOOGLE_CLIENT_IDS');
    expect(messageOf(error)).not.toContain('not-a-client-id');
  });

  it('one malformed entry beside a valid one is refused (specified by the requirement text "every remaining entry SHALL match")', () => {
    const error = thrownBy({
      DATABASE_URL: DB_URL,
      GOOGLE_CLIENT_IDS: '1-web.apps.googleusercontent.com,n0t-a-cl1ent',
    });

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('GOOGLE_CLIENT_IDS');
    expect(messageOf(error)).not.toContain('n0t-a-cl1ent');
  });

  it('only separators and blanks yield no client ID (derived: "empty entries skipped" leaves nothing; design decision 10 treats "," as disabling sign-in)', () => {
    expect(
      loadConfig({ DATABASE_URL: DB_URL, GOOGLE_CLIENT_IDS: ' , ' })
        .googleClientIds,
    ).toEqual([]);
  });
});

describe('api-configuration: the sign-up allowlist is an optional list of emails', () => {
  it('entries are normalised', () => {
    expect(
      loadConfig({
        DATABASE_URL: DB_URL,
        SIGNUP_ALLOWED_EMAILS: ' Ann@Example.org ,,bob@example.org',
      }).signupAllowedEmails,
    ).toEqual(['ann@example.org', 'bob@example.org']);
  });

  it.each([
    ['unset', { DATABASE_URL: DB_URL }],
    ['empty', { DATABASE_URL: DB_URL, SIGNUP_ALLOWED_EMAILS: '' }],
  ] as const)('unset allowlist: %s', (_case, env) => {
    expect(loadConfig(env).signupAllowedEmails).toEqual([]);
  });

  it('a malformed entry', () => {
    const error = thrownBy({
      DATABASE_URL: DB_URL,
      SIGNUP_ALLOWED_EMAILS: 'ann@example.org,carol',
    });

    expect(error).toBeInstanceOf(ConfigError);
    expect(messageOf(error)).toContain('SIGNUP_ALLOWED_EMAILS');
    expect(messageOf(error)).not.toContain('carol');
    expect(messageOf(error)).not.toContain('ann@example.org');
  });
});

describe('api-configuration: the application provides the revised configuration', () => {
  const names = [
    'DATABASE_URL',
    'PORT',
    'APP_VERSION',
    'GOOGLE_CLIENT_IDS',
    'SIGNUP_ALLOWED_EMAILS',
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('APP_CONFIG holds the two lists read from the environment (derived from design decision 1 of add-api-cross-cutting-basics, as revised)', async () => {
    process.env['DATABASE_URL'] = DB_URL;
    process.env['PORT'] = '8080';
    process.env['APP_VERSION'] = '3f2c9e1';
    process.env['GOOGLE_CLIENT_IDS'] = '123-web.apps.googleusercontent.com';
    process.env['SIGNUP_ALLOWED_EMAILS'] = 'Ann@Example.org';

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    try {
      expect(app.get(APP_CONFIG)).toEqual({
        databaseUrl: DB_URL,
        port: 8080,
        appVersion: '3f2c9e1',
        googleClientIds: ['123-web.apps.googleusercontent.com'],
        signupAllowedEmails: ['ann@example.org'],
      });
    } finally {
      await app.close();
    }
  });

  it('creating the application with a malformed allowlist fails naming SIGNUP_ALLOWED_EMAILS (derived: the requirement validates "when the API is created")', async () => {
    process.env['DATABASE_URL'] = DB_URL;
    delete process.env['PORT'];
    process.env['SIGNUP_ALLOWED_EMAILS'] = 'carol';

    await expect(
      NestFactory.createApplicationContext(AppModule, {
        logger: false,
        abortOnError: false,
      }),
    ).rejects.toThrow(/SIGNUP_ALLOWED_EMAILS/);
  });
});
