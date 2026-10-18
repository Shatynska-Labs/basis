// Derived from openspec/changes/move-api-deploys-to-staging-with-promotion/specs/api-delivery/spec.md
// ("Staging records success only for the commit it is running") before
// implementation, against the interface design decision 7 names:
// decide({ stage, commit, head, runCommit }). Provenance of each assertion is
// recorded in that change's test-plan.md.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { decide } from './supersession.ts';

const script = fileURLToPath(new URL('./supersession.ts', import.meta.url));

const COMMIT = '1111111111111111111111111111111111111111';
const NEWER_HEAD = '2222222222222222222222222222222222222222';
const OTHER_RUN = '3333333333333333333333333333333333333333';

describe('decide: superseded before the deploy job', () => {
  it('skips at the skip stage, naming the newer head', () => {
    const verdict = decide({
      stage: 'skip',
      commit: COMMIT,
      head: NEWER_HEAD,
      runCommit: COMMIT,
    });
    expect(verdict).toMatchObject({
      action: 'skip',
      reason: expect.stringContaining(NEWER_HEAD),
    });
  });
});

describe('decide: superseded while waiting for the group', () => {
  it('fails at the deliver stage, naming the newer head', () => {
    const verdict = decide({
      stage: 'deliver',
      commit: COMMIT,
      head: NEWER_HEAD,
      runCommit: COMMIT,
    });
    expect(verdict).toMatchObject({
      action: 'fail',
      reason: expect.stringContaining(NEWER_HEAD),
    });
  });
});

describe("decide: the run's commit is not the delivered commit", () => {
  it('fails at the deliver stage', () => {
    const verdict = decide({
      stage: 'deliver',
      commit: COMMIT,
      head: COMMIT,
      runCommit: OTHER_RUN,
    });
    expect(verdict.action).toBe('fail');
  });
});

describe('decide: still the head', () => {
  it.each(['skip', 'deliver'] as const)('delivers at the %s stage', (stage) => {
    expect(
      decide({ stage, commit: COMMIT, head: COMMIT, runCommit: COMMIT }),
    ).toEqual({ action: 'deliver' });
  });
});

describe('decide: the head cannot be read', () => {
  it.each(['skip', 'deliver'] as const)(
    'an empty head fails at the %s stage',
    (stage) => {
      expect(
        decide({ stage, commit: COMMIT, head: '', runCommit: COMMIT }).action,
      ).toBe('fail');
    },
  );
});

describe('supersession command: the head could not be read', () => {
  it.each(['skip', 'deliver'])(
    'an unreachable remote fails at the %s stage',
    (stage) => {
      const dir = mkdtempSync(join(tmpdir(), 'supersession-'));
      try {
        const output = join(dir, 'github-output');
        writeFileSync(output, '');
        const result = spawnSync(process.execPath, [script], {
          encoding: 'utf8',
          timeout: 20_000,
          cwd: dir,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            STAGE: stage,
            COMMIT,
            RUN_COMMIT: COMMIT,
            REMOTE: join(dir, 'no-such-repository'),
            GITHUB_OUTPUT: output,
            GIT_TERMINAL_PROMPT: '0',
          },
        });
        expect(result.status).toBe(1);
        expect(`${result.stdout}${result.stderr}`).toContain('::error::');
        expect(readFileSync(output, 'utf8')).not.toMatch(/deliver=true/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
