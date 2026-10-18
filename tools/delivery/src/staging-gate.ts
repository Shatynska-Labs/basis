// Refuses a promotion unless staging ran the commit successfully
// (move-api-deploys-to-staging-with-promotion design decision 4). The record is
// GitHub's own, written by deploy.yml's `environment: staging`. A deployment
// passes when its status history holds a `success` with no later `failure` or
// `error`; not "its latest status is success", because GitHub may append
// `inactive` to a superseded deployment, and that reading would refuse every
// commit but the newest, which is the rollback path.
//
// It runs as `node tools/delivery/src/staging-gate.ts`, so it imports Node
// built-ins only and uses erasable syntax only.

export type GateResult =
  { ok: true; deploymentId: number } | { ok: false; reason: string };

const ENVIRONMENT = 'staging';
const WITHDRAWING = new Set(['failure', 'error']);

export const isCommitSha = (value: string): boolean =>
  /^[0-9a-f]{40}$/.test(value);

// Statuses as GitHub serves them, newest first: the first `success` met is the
// most recent one, and anything met before it happened after it.
export const hasSucceeded = (
  statuses: readonly { state?: unknown }[],
): boolean => {
  for (const { state } of statuses) {
    const name = String(state ?? '').toLowerCase();
    if (WITHDRAWING.has(name)) return false;
    if (name === 'success') return true;
  }
  return false;
};

const asRecords = (payload: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(payload)) throw new Error('not a list');
  return payload.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null,
  );
};

export const checkStaging = async ({
  commit,
  repository,
  apiUrl,
  getJson,
}: {
  commit: string;
  repository: string;
  apiUrl: string;
  getJson: (url: string) => Promise<unknown>;
}): Promise<GateResult> => {
  if (!isCommitSha(commit)) {
    return {
      ok: false,
      reason: `'${commit}' is not a full commit SHA (40 lowercase hexadecimal characters).`,
    };
  }
  const api = apiUrl.replace(/\/+$/, '');
  const query = new URLSearchParams({
    environment: ENVIRONMENT,
    sha: commit,
    per_page: '100',
  });
  try {
    // Scoped again rather than trusted from the query, so an API change
    // cannot admit a commit staging never ran.
    const candidates = asRecords(
      await getJson(`${api}/repos/${repository}/deployments?${query}`),
    ).filter(
      (entry) =>
        entry['sha'] === commit && entry['environment'] === ENVIRONMENT,
    );
    if (candidates.length === 0) {
      return {
        ok: false,
        reason: `staging has not run commit ${commit}: there is no staging deployment record for it. Only a commit deployed to staging can be promoted.`,
      };
    }
    for (const entry of candidates) {
      const id = Number(entry['id']);
      const statusesUrl = new URL(
        typeof entry['statuses_url'] === 'string'
          ? entry['statuses_url']
          : `${api}/repos/${repository}/deployments/${id}/statuses`,
      );
      statusesUrl.searchParams.set('per_page', '100');
      if (hasSucceeded(asRecords(await getJson(statusesUrl.toString())))) {
        return { ok: true, deploymentId: id };
      }
    }
    return {
      ok: false,
      reason: `staging has not successfully run commit ${commit}: its ${candidates.length} staging deployment record(s) carry no success, or one withdrawn by a later failure. A deploy still in progress does not count; wait for it.`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `the staging deployment records could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

if (import.meta.main) {
  const token = process.env['GH_TOKEN'] ?? '';
  const result = await checkStaging({
    commit: process.env['COMMIT'] ?? '',
    repository: process.env['GITHUB_REPOSITORY'] ?? '',
    apiUrl: process.env['GITHUB_API_URL'] || 'https://api.github.com',
    getJson: async (url) => {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
      return response.json();
    },
  });
  if (!result.ok) {
    console.log(`::error::${result.reason}`);
    process.exit(1);
  }
  console.log(
    `staging deployment ${result.deploymentId} succeeded; the promotion may proceed.`,
  );
}
