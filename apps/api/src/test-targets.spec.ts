// Derived from openspec/changes/add-persistence-skeleton/specs/integration-testing/spec.md
// ("Integration specs run only through the integration target") before
// implementation. Both scenarios are observed by running the tools that
// decide them: Nx lists the projects with an `integration` target, and Vitest
// lists the files the `api` project's unit configuration collects
// (`vitest.config.mts`, which the `test` target runs; design decision 9).
// Provenance of each assertion is recorded in the change's test-plan.md.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, NX_DAEMON: 'false' },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

describe('integration-testing: integration specs run only through the integration target', () => {
  it('the API has an integration target', () => {
    const listed = run(
      'pnpm',
      ['nx', 'show', 'projects', '--with-target', 'integration', '--json'],
      repoRoot,
    );

    expect(listed.status, listed.stderr).toBe(0);
    expect(JSON.parse(listed.stdout) as string[]).toContain('api');
  }, 120_000);

  it('the unit run leaves integration specs out', () => {
    // Shows there are integration specs to leave out, so an empty exclusion
    // below is not vacuous.
    const integrationSpecs = filesUnder(
      join(apiRoot, 'tests/integration'),
    ).filter((file) => file.endsWith('.integration.spec.ts'));
    expect(integrationSpecs).not.toEqual([]);

    const listed = run(
      'pnpm',
      [
        'exec',
        'vitest',
        'list',
        '--config',
        'vitest.config.mts',
        '--filesOnly',
        '--json',
      ],
      apiRoot,
    );
    expect(listed.status, listed.stderr).toBe(0);
    const collected = (JSON.parse(listed.stdout) as { file: string }[]).map(
      (entry) => relative(apiRoot, entry.file).split(sep).join('/'),
    );

    // Shows the listing reports the unit specs at all.
    expect(collected).toContain('src/test-targets.spec.ts');
    expect(
      collected.filter(
        (file) =>
          file.startsWith('tests/integration/') ||
          file.endsWith('.integration.spec.ts'),
      ),
    ).toEqual([]);
  }, 120_000);
});
