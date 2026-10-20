// Derived from openspec/changes/add-api-cross-cutting-basics/specs/api-logging/spec.md
// ("The API writes its logs as JSON lines") before implementation. Provenance
// of each assertion is recorded in that change's test-plan.md. The built API
// (apps/api/dist/main.js) is started through ./support/api-process, which
// captures everything the process writes to standard output and standard
// error from its start; nothing is imported from apps/api.
import { createConnection } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startApi } from './support/api-process.js';

const UNREACHABLE_URL =
  'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';
const startupTimeout = 20_000;

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

const refusesConnections = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });

// ---------------------------------------------------------------------------

describe('api-logging: the API writes its logs as JSON lines', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = UNREACHABLE_URL;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = saved;
  });

  it(
    "the built API's output is JSON lines",
    async () => {
      // The premise: nothing listens where DATABASE_URL points.
      expect(await refusesConnections('127.0.0.1', 9)).toBe(true);

      const api = await startApi({ appVersion: '3f2c9e1' });
      let output: string;
      try {
        const response = await fetch(`${api.baseUrl}/health`);
        expect(response.status).toBe(200);
      } finally {
        await api.stop();
        output = api.output();
      }
      const lines = output.split('\n').filter((line) => line.trim() !== '');

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        let entry: unknown;
        expect(() => (entry = JSON.parse(line)), line).not.toThrow();
        expect(entry, line).toBeTypeOf('object');
        expect(entry, line).not.toBeNull();
        expect(Array.isArray(entry), line).toBe(false);
        expect(typeof (entry as Record<string, unknown>)['level'], line).toBe(
          'string',
        );
        expect(entry as Record<string, unknown>, line).toHaveProperty(
          'message',
        );
      }
    },
    startupTimeout,
  );
});
