// Derived from openspec/changes/add-persistence-skeleton/specs/api-persistence/spec.md
// ("Starting the API does not connect to the database", "The API is given its
// database by DATABASE_URL alone") before implementation. The built API
// (apps/api/dist/main.js) is started as a process with an environment this
// file sets in full; nothing is imported from apps/api. Provenance of each
// assertion is recorded in the change's test-plan.md.
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const apiMain = fileURLToPath(
  new URL('../../api/dist/main.js', import.meta.url),
);

const UNREACHABLE_URL =
  'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';
const startupTimeout = 20_000;

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address !== null
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });

const refusesConnections = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });

interface Started {
  process: ChildProcess;
  output: () => string;
  exited: Promise<number | null>;
}

const startApi = (env: Record<string, string>): Started => {
  let output = '';
  const child = spawn(process.execPath, [apiMain], {
    env: { PATH: process.env.PATH ?? '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => (output += String(chunk)));
  child.stderr?.on('data', (chunk) => (output += String(chunk)));
  const exited = new Promise<number | null>((resolve) =>
    child.once('exit', (code) => resolve(code)),
  );
  return { process: child, output: () => output, exited };
};

const stop = async (started: Started) => {
  if (
    started.process.exitCode === null &&
    started.process.signalCode === null
  ) {
    started.process.kill('SIGTERM');
    await started.exited;
  }
};

// Polls /health until it answers, the process exits, or the window passes.
const awaitHealth = async (started: Started, port: number) => {
  const deadline = Date.now() + startupTimeout - 2_000;
  while (Date.now() < deadline) {
    if (started.process.exitCode !== null)
      throw new Error(
        `the API exited with ${started.process.exitCode}: ${started.output()}`,
      );
    try {
      return await fetch(`http://127.0.0.1:${port}/health`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`the API did not answer /health: ${started.output()}`);
};

// ---------------------------------------------------------------------------

describe('api-persistence: starting the API does not connect to the database', () => {
  it(
    'an unreachable database at startup: GET /health answers 200 with status "ok"',
    async () => {
      // The premise: nothing listens where DATABASE_URL points.
      expect(await refusesConnections('127.0.0.1', 9)).toBe(true);

      const port = await freePort();
      const api = startApi({
        PORT: String(port),
        DATABASE_URL: UNREACHABLE_URL,
      });
      try {
        const response = await awaitHealth(api, port);

        expect(response.status).toBe(200);
        expect(((await response.json()) as { status?: unknown }).status).toBe(
          'ok',
        );
      } finally {
        await stop(api);
      }
    },
    startupTimeout,
  );
  it(
    'starting and answering GET /health opens no connection to the database DATABASE_URL names',
    async () => {
      // A listener standing where DATABASE_URL points, counting connections.
      let connections = 0;
      const listener = createServer((socket) => {
        connections += 1;
        socket.destroy();
      });
      await new Promise<void>((resolve) =>
        listener.listen(0, '127.0.0.1', resolve),
      );
      const address = listener.address();
      const dbPort =
        typeof address === 'object' && address !== null ? address.port : 0;

      const port = await freePort();
      const api = startApi({
        PORT: String(port),
        DATABASE_URL: `postgres://basis:n0t-a-real-pa55word@127.0.0.1:${dbPort}/basis`,
      });
      try {
        const response = await awaitHealth(api, port);

        expect(response.status).toBe(200);
        expect(connections).toBe(0);
      } finally {
        await stop(api);
        await new Promise((resolve) => listener.close(resolve));
      }
    },
    startupTimeout,
  );
});

describe('api-persistence: the API refuses to start without DATABASE_URL', () => {
  it.each([
    ['unset', {}],
    ['empty', { DATABASE_URL: '' }],
  ] as const)(
    'with DATABASE_URL %s, the process exits non-zero naming DATABASE_URL',
    async (_case, env) => {
      const port = await freePort();
      const api = startApi({ PORT: String(port), ...env });
      try {
        const code = await Promise.race([
          api.exited,
          new Promise<'running'>((resolve) =>
            setTimeout(() => resolve('running'), startupTimeout - 2_000),
          ),
        ]);

        expect(code).not.toBe('running');
        expect(code).not.toBe(0);
        expect(api.output()).toContain('DATABASE_URL');
      } finally {
        await stop(api);
      }
    },
    startupTimeout,
  );
});
