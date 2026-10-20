// Derived from openspec/changes/add-api-cross-cutting-basics/specs/api-configuration/spec.md
// ("An invalid configuration stops the API without disclosing values") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md. The built API (apps/api/dist/main.js) is started as a process
// with an environment this file sets in full; nothing is imported from
// apps/api. The shared harness's `startApi` always sets a valid `PORT` and
// waits for `GET /health`, so the process is started here by a local helper.
import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { builtApiEntry, workspaceRoot } from './support/api-process.js';

const startupTimeout = 20_000;
const exitWindow = startupTimeout - 5_000;

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

interface Ended {
  /** The exit code, or `'running'` where the process had not exited within the window and was killed. */
  code: number | null | 'running';
  signal: NodeJS.Signals | null;
  output: string;
}

/**
 * Starts the built API with exactly `env` (and `PATH`) and resolves once it
 * exits by itself, or after `windowMs`, killing it then.
 */
const runUntilExit = (
  env: Record<string, string>,
  windowMs: number,
): Promise<Ended> =>
  new Promise((resolve) => {
    let output = '';
    const child = spawn(process.execPath, [builtApiEntry], {
      cwd: workspaceRoot,
      env: { PATH: process.env['PATH'] ?? '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const timer = setTimeout(() => {
      child.removeAllListeners('exit');
      child.once('exit', () =>
        resolve({ code: 'running', signal: null, output }),
      );
      child.kill('SIGKILL');
    }, windowMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      // Let the pipes drain what the process wrote before it exited.
      setImmediate(() => resolve({ code, signal, output }));
    });
  });

// ---------------------------------------------------------------------------

const DATABASE_PASSWORD = 'n0t-a-real-pa55word';
const INVALID_PORT = 'n0t-a-p0rt';

describe('api-configuration: an invalid configuration stops the API without disclosing values', () => {
  it(
    'an invalid port stops the API',
    async () => {
      const ended = await runUntilExit(
        {
          DATABASE_URL: `postgres://basis:${DATABASE_PASSWORD}@127.0.0.1:9/basis`,
          PORT: INVALID_PORT,
        },
        exitWindow,
      );

      // Exits by itself within the window: a process that has exited answers
      // no GET /health, and with PORT invalid there is no port it could have
      // been asked on before (see test-plan.md, scenario note).
      expect(ended.code, ended.output).not.toBe('running');
      expect(typeof ended.code, `signal ${ended.signal}`).toBe('number');
      expect(ended.code).not.toBe(0);
      expect(ended.output).toContain('PORT');
      expect(ended.output).not.toContain(DATABASE_PASSWORD);
      expect(ended.output).not.toContain(INVALID_PORT);
    },
    startupTimeout,
  );

  it(
    'an invalid port is refused by name: PORT appears as a word of its own, not only inside another identifier such as ERR_SOCKET_BAD_PORT (derived: tightens the scenario\'s "contains PORT"; see test-plan.md)',
    async () => {
      const ended = await runUntilExit(
        {
          DATABASE_URL: `postgres://basis:${DATABASE_PASSWORD}@127.0.0.1:9/basis`,
          PORT: INVALID_PORT,
        },
        exitWindow,
      );

      expect(ended.code, ended.output).not.toBe('running');
      expect(ended.output).toMatch(/(?<![A-Za-z0-9_])PORT(?![A-Za-z0-9_])/);
    },
    startupTimeout,
  );

  it(
    'every invalid variable is named in the output: DATABASE_URL unset and PORT invalid (specified by the requirement text "name every invalid variable")',
    async () => {
      const ended = await runUntilExit({ PORT: INVALID_PORT }, exitWindow);

      expect(ended.code, ended.output).not.toBe('running');
      expect(ended.code).not.toBe(0);
      expect(ended.output).toContain('DATABASE_URL');
      expect(ended.output).toContain('PORT');
      expect(ended.output).not.toContain(INVALID_PORT);
    },
    startupTimeout,
  );

  it(
    'what the refused API writes is JSON lines (derived from api-logging "from process start" applied to a refused start)',
    async () => {
      const ended = await runUntilExit(
        {
          DATABASE_URL: `postgres://basis:${DATABASE_PASSWORD}@127.0.0.1:9/basis`,
          PORT: INVALID_PORT,
        },
        exitWindow,
      );
      const lines = ended.output
        .split('\n')
        .filter((line) => line.trim() !== '');

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const entry = JSON.parse(line) as unknown;
        expect(entry, line).toBeTypeOf('object');
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
