// Derived from openspec/changes/add-api-cross-cutting-basics/specs/api-logging/spec.md
// ("Secret-named properties are redacted from log entries") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md. `createLogger` is the name design decision 4 fixes, imported
// from the folder's `index.ts`. What the logger writes is captured by
// replacing `process.stdout.write` and `process.stderr.write` for the
// duration of each test: Nest's `ConsoleLogger` prints `log` entries to
// standard output and `error` entries to standard error (its declaration in
// @nestjs/common), an assumption recorded in test-plan.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from './index.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** Everything written to standard output and standard error while installed. */
const captureOutput = () => {
  let written = '';
  const record = (chunk: unknown) => {
    written += typeof chunk === 'string' ? chunk : String(chunk);
    return true;
  };
  const stdout = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(record as typeof process.stdout.write);
  const stderr = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(record as typeof process.stderr.write);
  return {
    written: () => written,
    restore: () => {
      stdout.mockRestore();
      stderr.mockRestore();
    },
  };
};

// ---------------------------------------------------------------------------

describe('api-logging: secret-named properties are redacted from log entries', () => {
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
  });

  it('a nested secret is redacted', () => {
    const params = {
      target: { host: 'db.internal', Password: 'n0t-a-real-pa55word' },
    };

    createLogger().log('connecting', params);
    const written = output.written();

    expect(written).toContain('"[REDACTED]"');
    expect(written).toContain('db.internal');
    expect(written).not.toContain('n0t-a-real-pa55word');
    expect(params.target.Password).toBe('n0t-a-real-pa55word');
  });

  it('every secret name is redacted', () => {
    const params = {
      password: 'v4lue-password',
      secret: 'v4lue-secret',
      token: 'v4lue-token',
      apiKey: 'v4lue-apiKey',
      api_key: 'v4lue-api_key',
      authorization: 'v4lue-authorization',
      cookie: 'v4lue-cookie',
      databaseUrl: 'v4lue-databaseUrl',
      DATABASE_URL: 'v4lue-DATABASE_URL',
      connectionString: 'v4lue-connectionString',
      connection_string: 'v4lue-connection_string',
    };

    createLogger().log('every secret', params);
    const written = output.written();

    // Shows the entry was written at all, so the absences below are not vacuous.
    expect(written).toContain('every secret');
    for (const value of Object.values(params)) {
      expect(written).not.toContain(value);
    }
  });

  it('a property whose name is not a secret is left unchanged (specified by the requirement text)', () => {
    createLogger().log('connecting', {
      target: { host: 'db.internal', port: 5432 },
    });
    const written = output.written();

    expect(written).toContain('db.internal');
    expect(written).toContain('5432');
    expect(written).not.toContain('[REDACTED]');
  });

  it('a secret inside an array of objects is redacted (derived from "at any depth")', () => {
    createLogger().log('batch', {
      targets: [{ host: 'db.internal', token: 'n0t-a-real-t0ken' }],
    });
    const written = output.written();

    expect(written).toContain('db.internal');
    expect(written).not.toContain('n0t-a-real-t0ken');
  });

  it('a secret in an error-level entry is redacted (derived: the requirement covers every log entry, not only log level)', () => {
    createLogger().error('failed', { cause: { secret: 'n0t-a-real-s3cret' } });
    const written = output.written();

    expect(written).toContain('failed');
    expect(written).not.toContain('n0t-a-real-s3cret');
  });

  it('the entry is one JSON line with a string level and the message (derived from the api-logging JSON-lines requirement, observed at unit level)', () => {
    createLogger().log('connecting', { target: { host: 'db.internal' } });
    const lines = output
      .written()
      .split('\n')
      .filter((line) => line.trim() !== '');

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? '') as Record<string, unknown>;
    expect(typeof entry['level']).toBe('string');
    expect(entry['message']).toBe('connecting');
  });
});
