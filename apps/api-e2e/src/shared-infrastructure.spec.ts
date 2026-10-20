// Derived from openspec/changes/share-the-database-connection/specs/shared-infrastructure/spec.md
// ("The built API runs with the shared infrastructure") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md. The built API (apps/api/dist/main.js), and the same entry
// point inside the package `pnpm deploy --filter api --prod` writes, are
// started through ./support/api-process; nothing is imported from apps/api.
// The deployed package is written to a directory outside the workspace, so
// nothing it imports can be resolved from the workspace's node_modules.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startApi, workspaceRoot } from './support/api-process.js';

const UNREACHABLE_URL =
  'postgres://basis:n0t-a-real-pa55word@127.0.0.1:9/basis';
const startupTimeout = 20_000;
const deployTimeout = 300_000;

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/**
 * Resolves `specifier` the way an ES module in `dir` would, in a separate Node
 * process, and returns the resolved file's real path.
 */
const resolveFrom = (dir: string, specifier: string): string => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `process.stdout.write(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(
      `could not resolve ${specifier} from ${dir}: ${result.stderr}`,
    );
  return realpathSync(fileURLToPath(result.stdout.trim()));
};

// ---------------------------------------------------------------------------

describe('shared-infrastructure: the built API runs with the shared infrastructure', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL = UNREACHABLE_URL;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it(
    'the built API starts: GET /health answers 200 with DATABASE_URL naming a database where nothing listens',
    async () => {
      const api = await startApi({ appVersion: undefined });
      try {
        const response = await request(api.baseUrl).get('/health');

        expect(response.status).toBe(200);
      } finally {
        await api.stop();
      }
    },
    startupTimeout,
  );

  it("the built API resolves @basis/shared-infrastructure to a JavaScript file in the library's dist/", () => {
    const resolved = resolveFrom(
      join(workspaceRoot, 'apps/api/dist'),
      '@basis/shared-infrastructure',
    );

    expect(
      resolved.startsWith(
        realpathSync(join(workspaceRoot, 'libs/shared/infrastructure/dist')) +
          sep,
      ),
    ).toBe(true);
    expect(resolved).toMatch(/\.(js|mjs|cjs)$/);
  });

  describe('the deployed package', () => {
    let deployDir: string | undefined;

    afterAll(() => {
      if (deployDir) rmSync(deployDir, { recursive: true, force: true });
    });

    it(
      'starts: GET /health answers 200 from node dist/main.js in the package pnpm deploy --filter api --prod writes',
      async () => {
        deployDir = realpathSync(
          mkdtempSync(join(tmpdir(), 'basis-api-deploy-')),
        );
        // The premise: an empty directory outside the workspace.
        expect(readdirSync(deployDir)).toEqual([]);
        expect(deployDir.startsWith(realpathSync(workspaceRoot))).toBe(false);

        const deploy = spawnSync(
          'pnpm',
          ['deploy', '--filter', 'api', '--prod', deployDir],
          { cwd: workspaceRoot, encoding: 'utf8' },
        );
        expect(deploy.status, `${deploy.stderr}${deploy.stdout}`).toBe(0);

        // Resolved from the deployed package, inside it, to compiled output.
        const resolved = resolveFrom(
          join(deployDir, 'dist'),
          '@basis/shared-infrastructure',
        );
        expect(resolved.startsWith(deployDir + sep)).toBe(true);
        expect(resolved).toMatch(
          /shared-infrastructure[/\\]dist[/\\].+\.(js|mjs|cjs)$/,
        );

        const api = await startApi({
          appVersion: undefined,
          entry: join(deployDir, 'dist/main.js'),
        });
        try {
          const response = await request(api.baseUrl).get('/health');

          expect(response.status).toBe(200);
        } finally {
          await api.stop();
        }
      },
      deployTimeout,
    );
  });
});
