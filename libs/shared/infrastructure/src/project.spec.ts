// Derived from openspec/changes/share-the-database-connection/specs/shared-infrastructure/spec.md
// ("The API's database is provided under a shared token", scenario "The
// library is a workspace project with the declared tags") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md. The workspace's projects are listed through the Nx CLI, the
// same way the scenario reads them, rather than by reading a project file.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const nxTimeout = 120_000;

// Declared locally (see "Missing shared arrangement" in test-plan.md).
const nx = (args: string[]): string => {
  const result = spawnSync('pnpm', ['exec', 'nx', ...args], {
    cwd: repoRoot,
    env: { ...process.env, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `nx ${args.join(' ')} exited ${result.status}: ${result.stderr}${result.stdout}`,
    );
  }
  return result.stdout;
};

// Nx may print notices around the JSON; take the outermost JSON value.
const parseJson = <T>(output: string, open: '[' | '{'): T => {
  const close = open === '[' ? ']' : '}';
  return JSON.parse(
    output.slice(output.indexOf(open), output.lastIndexOf(close) + 1),
  ) as T;
};

describe('shared-infrastructure: the library is a workspace project with the declared tags', () => {
  it(
    'shared-infrastructure is among the listed workspace projects',
    () => {
      const projects = parseJson<string[]>(
        nx(['show', 'projects', '--json']),
        '[',
      );

      expect(projects).toContain('shared-infrastructure');
    },
    nxTimeout,
  );

  it(
    'it carries the tags scope:shared and type:infrastructure',
    () => {
      const project = parseJson<{ tags?: string[] }>(
        nx(['show', 'project', 'shared-infrastructure', '--json']),
        '{',
      );

      expect(project.tags).toEqual(
        expect.arrayContaining(['scope:shared', 'type:infrastructure']),
      );
    },
    nxTimeout,
  );
});
