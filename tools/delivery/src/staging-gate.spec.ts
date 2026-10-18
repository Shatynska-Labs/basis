// Derived from openspec/changes/move-api-deploys-to-staging-with-promotion/specs/api-delivery/spec.md
// ("Production is reached only by an operator's promotion of a named commit",
// "A promotion is refused unless staging ran that commit successfully") before
// implementation, against the interface design decision 7 names:
// isCommitSha(value), hasSucceeded(statuses) over statuses newest first, and
// checkStaging({ commit, repository, apiUrl, getJson }). Provenance of each
// assertion is recorded in that change's test-plan.md.
import { describe, expect, it, vi } from 'vitest';

import { checkStaging, hasSucceeded, isCommitSha } from './staging-gate.ts';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const OTHER_COMMIT = 'fedcba9876543210fedcba9876543210fedcba98';
const REPOSITORY = 'Shatynska-Labs/basis';
const API_URL = 'https://api.github.example';

type State =
  | 'queued'
  | 'in_progress'
  | 'success'
  | 'failure'
  | 'error'
  | 'inactive'
  | 'pending';

interface FakeDeployment {
  id: number;
  sha: string;
  environment: string;
  // Chronological order, oldest first, as the scenarios state them.
  history: State[];
}

const deployment = (
  id: number,
  history: State[],
  overrides: Partial<Omit<FakeDeployment, 'id' | 'history'>> = {},
): FakeDeployment => ({
  id,
  sha: COMMIT,
  environment: 'staging',
  history,
  ...overrides,
});

// GitHub serves a deployment's statuses newest first.
const served = (history: State[]) =>
  [...history].reverse().map((state) => ({ state }));

// A fake GitHub REST API. It answers the deployments list with every record it
// holds, whatever the query asked for, and a deployment's statuses by id.
// Any other URL rejects.
const fakeGitHub = (deployments: FakeDeployment[]) =>
  vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const statuses = path.match(/\/deployments\/(\d+)\/statuses$/);
    if (statuses) {
      const found = deployments.find((d) => d.id === Number(statuses[1]));
      if (!found) throw new Error(`404 ${url}`);
      return served(found.history);
    }
    if (path === `/repos/${REPOSITORY}/deployments`) {
      return deployments.map((d) => ({
        id: d.id,
        sha: d.sha,
        environment: d.environment,
        statuses_url: `${API_URL}/repos/${REPOSITORY}/deployments/${d.id}/statuses`,
      }));
    }
    throw new Error(`unexpected request ${url}`);
  });

const check = (getJson: (url: string) => Promise<unknown>, commit = COMMIT) =>
  checkStaging({ commit, repository: REPOSITORY, apiUrl: API_URL, getJson });

describe('a malformed commit is refused', () => {
  const malformed = [
    'main',
    COMMIT.slice(0, 7),
    `${COMMIT.slice(0, 39)}A`,
    `${COMMIT}0`,
  ];

  it.each(malformed)(
    'refuses %s, naming it as not a full commit SHA, with no request',
    async (commit) => {
      const getJson = fakeGitHub([deployment(1, ['in_progress', 'success'])]);
      const result = await check(getJson, commit);
      expect(result).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/full commit sha/i),
      });
      expect(getJson).not.toHaveBeenCalled();
    },
  );

  it.each(malformed)('isCommitSha rejects %s', (value) => {
    expect(isCommitSha(value)).toBe(false);
  });

  it('isCommitSha accepts a full lowercase SHA', () => {
    expect(isCommitSha(COMMIT)).toBe(true);
  });
});

describe('the staging gate', () => {
  it('no staging record: refuses, naming the commit and saying staging has not run it', async () => {
    const result = await check(fakeGitHub([]));
    expect(result).toMatchObject({ ok: false });
    const { reason } = result as { reason: string };
    expect(reason).toContain(COMMIT);
    expect(reason).toMatch(/staging/i);
  });

  it('a successful staging deployment: may proceed', async () => {
    const result = await check(
      fakeGitHub([deployment(42, ['in_progress', 'success'])]),
    );
    expect(result).toMatchObject({ ok: true, deploymentId: 42 });
  });

  it('a success superseded by a later deployment: may proceed', async () => {
    const result = await check(
      fakeGitHub([deployment(42, ['success', 'inactive'])]),
    );
    expect(result).toMatchObject({ ok: true, deploymentId: 42 });
  });

  it.each(['failure', 'error'] as const)(
    'a success withdrawn by a later %s on the only deployment: refused',
    async (later) => {
      const result = await check(
        fakeGitHub([deployment(42, ['success', later])]),
      );
      expect(result).toMatchObject({ ok: false });
    },
  );

  it('a deployment still in progress: refused', async () => {
    const result = await check(
      fakeGitHub([deployment(42, ['queued', 'in_progress'])]),
    );
    expect(result).toMatchObject({ ok: false });
  });

  it('a successful record for another commit, and no other: refused', async () => {
    const result = await check(
      fakeGitHub([
        deployment(42, ['in_progress', 'success'], { sha: OTHER_COMMIT }),
      ]),
    );
    expect(result).toMatchObject({ ok: false });
  });

  it('a successful record for another Environment, and no other: refused', async () => {
    const result = await check(
      fakeGitHub([
        deployment(42, ['in_progress', 'success'], {
          environment: 'production',
        }),
      ]),
    );
    expect(result).toMatchObject({ ok: false });
  });

  it('GitHub does not answer: refused, saying the records could not be read', async () => {
    const getJson = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const result = await check(getJson);
    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/could not be read/i),
    });
  });

  // Requirement text: "at least one deployment whose status history contains
  // a success with no later failure or error".
  it('one failed and one successful staging deployment of the commit: may proceed', async () => {
    const result = await check(
      fakeGitHub([
        deployment(41, ['success', 'failure']),
        deployment(42, ['in_progress', 'success']),
      ]),
    );
    expect(result).toMatchObject({ ok: true, deploymentId: 42 });
  });

  it('records for another commit and Environment beside a successful one: may proceed on the matching one', async () => {
    const result = await check(
      fakeGitHub([
        deployment(40, ['success'], { sha: OTHER_COMMIT }),
        deployment(41, ['success'], { environment: 'production' }),
        deployment(42, ['in_progress', 'success']),
      ]),
    );
    expect(result).toMatchObject({ ok: true, deploymentId: 42 });
  });
});

describe('hasSucceeded: statuses as GitHub serves them, newest first', () => {
  it.each<[string, State[], boolean]>([
    ['in_progress then success', ['in_progress', 'success'], true],
    ['success then inactive', ['success', 'inactive'], true],
    ['success then failure', ['success', 'failure'], false],
    ['success then error', ['success', 'error'], false],
    ['queued then in_progress', ['queued', 'in_progress'], false],
    ['no statuses', [], false],
    ['failure then success', ['failure', 'success'], true],
  ])('%s', (_name, history, expected) => {
    expect(hasSucceeded(served(history))).toBe(expected);
  });
});
