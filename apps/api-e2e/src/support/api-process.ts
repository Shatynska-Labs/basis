// Test harness for the api-e2e project, written with the derived tests of
// openspec/changes/deploy-api-skeleton (design decision 4, tasks.md §0). It
// starts the built API as a child process, through the same entry point the
// image runs, and imports nothing from apps/api. The implementer conforms to
// this interface; see that change's test-plan.md.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

/** The workspace root, resolved from this file: apps/api-e2e/src/support/. */
export const workspaceRoot = fileURLToPath(
  new URL('../../../../', import.meta.url),
);

/** The built API's entry point, `apps/api/dist/main.js` under the workspace root. */
export const builtApiEntry = fileURLToPath(
  new URL('../../../../apps/api/dist/main.js', import.meta.url),
);

export interface StartApiOptions {
  /**
   * The build identifier the process is started with, as `APP_VERSION`:
   * a string sets it (an empty string sets it empty); `undefined` removes it
   * from the inherited environment.
   */
  appVersion: string | undefined;
  /** How long to wait for `GET /health` to answer. Defaults to 15 seconds. */
  startupTimeoutMs?: number;
  /** Overrides the entry point; defaults to {@link builtApiEntry}. */
  entry?: string;
}

export interface ExitStatus {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** True where the process did not exit within the stop timeout and was killed. */
  killed: boolean;
}

export interface ApiProcess {
  /** `http://127.0.0.1:<port>`, for supertest's `request(baseUrl)`. */
  baseUrl: string;
  port: number;
  /** Everything the process wrote to standard output and standard error so far. */
  output(): string;
  /** Sends `SIGTERM` and resolves once the process has exited. */
  stop(timeoutMs?: number): Promise<ExitStatus>;
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('could not obtain a free port'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const exited = (child: ChildProcess) =>
  child.exitCode !== null || child.signalCode !== null;

const waitForExit = (child: ChildProcess): Promise<void> =>
  exited(child)
    ? Promise.resolve()
    : new Promise((resolve) => child.once('exit', () => resolve()));

/**
 * Starts the built API on a free port and resolves once `GET /health` answers
 * with any HTTP response. Rejects, with the process's output, where the entry
 * point is missing, the process exits first, or the timeout passes.
 */
export async function startApi(options: StartApiOptions): Promise<ApiProcess> {
  const entry = options.entry ?? builtApiEntry;
  const startupTimeoutMs = options.startupTimeoutMs ?? 15_000;

  if (!existsSync(entry)) {
    throw new Error(
      `built API not found at ${entry}; build it first (pnpm nx build api)`,
    );
  }

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
  if (options.appVersion === undefined) {
    delete env['APP_VERSION'];
  } else {
    env['APP_VERSION'] = options.appVersion;
  }

  const child = spawn(process.execPath, [entry], {
    cwd: workspaceRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  let spawnError: Error | undefined;
  child.on('error', (error) => (spawnError = error));

  const stop = async (timeoutMs = 5_000): Promise<ExitStatus> => {
    let killed = false;
    if (!exited(child)) {
      child.kill('SIGTERM');
      const outcome = await Promise.race([
        waitForExit(child).then(() => 'exited'),
        delay(timeoutMs).then(() => 'timeout'),
      ]);
      if (outcome === 'timeout') {
        killed = true;
        child.kill('SIGKILL');
        await waitForExit(child);
      }
    }
    return { code: child.exitCode, signal: child.signalCode, killed };
  };

  const deadline = Date.now() + startupTimeoutMs;
  for (;;) {
    if (spawnError !== undefined || exited(child)) {
      await stop();
      throw new Error(
        `API process ended before GET /health answered (code ${child.exitCode}, signal ${child.signalCode})` +
          `${spawnError ? `: ${spawnError.message}` : ''}\n${output}`,
      );
    }
    try {
      await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1_000) });
      break;
    } catch {
      // not answering yet
    }
    if (Date.now() >= deadline) {
      await stop();
      throw new Error(
        `GET /health did not answer within ${startupTimeoutMs} ms\n${output}`,
      );
    }
    await delay(100);
  }

  return { baseUrl, port, output: () => output, stop };
}
