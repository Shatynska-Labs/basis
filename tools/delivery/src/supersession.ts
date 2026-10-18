// Decides whether a staging deploy delivers its commit (move-api-deploys-to-
// staging-with-promotion design decision 5). Deploys arrive in the order their
// CI runs finish, not in commit order, so a commit main has moved past is not
// delivered. Before the deploy job it is skipped, leaving no staging record;
// once the job holds the concurrency group it fails, because a job that ended
// successfully without delivering would record a staging success the
// promotion's gate would admit.
//
// It runs as `node tools/delivery/src/supersession.ts`, so it imports Node
// built-ins only and uses erasable syntax only.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export type Stage = 'skip' | 'deliver';

export type Verdict =
  | { action: 'deliver' }
  | { action: 'skip'; reason: string }
  | { action: 'fail'; reason: string };

export const decide = ({
  stage,
  commit,
  head,
  runCommit,
}: {
  stage: Stage;
  commit: string;
  head: string;
  runCommit: string;
}): Verdict => {
  if (head === '') {
    return { action: 'fail', reason: "main's head could not be read." };
  }
  if (head !== commit) {
    const reason = `main is now at ${head}, so ${commit} is superseded and is not deployed; the newer commit's own run deploys it once its CI succeeds.`;
    return stage === 'skip'
      ? { action: 'skip', reason }
      : { action: 'fail', reason };
  }
  // A Deployment record takes the run's own commit, so delivering another
  // would record it under the wrong one (design decision 4).
  if (stage === 'deliver' && runCommit !== commit) {
    return {
      action: 'fail',
      reason: `this run's commit is ${runCommit}, not ${commit}, so its staging record would name another commit; nothing is delivered.`,
    };
  }
  return { action: 'deliver' };
};

const readHead = (remote: string): string => {
  try {
    const listing = execFileSync(
      'git',
      ['ls-remote', remote, 'refs/heads/main'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return listing.split('\t')[0]?.trim() ?? '';
  } catch {
    return '';
  }
};

if (import.meta.main) {
  const stage = process.env['STAGE'];
  if (stage !== 'skip' && stage !== 'deliver') {
    console.log(`::error::STAGE must be skip or deliver, not '${stage}'.`);
    process.exit(1);
  }
  const verdict = decide({
    stage,
    commit: process.env['COMMIT'] ?? '',
    head: readHead(process.env['REMOTE'] ?? ''),
    runCommit: process.env['RUN_COMMIT'] ?? '',
  });
  const output = process.env['GITHUB_OUTPUT'];
  if (verdict.action === 'fail') {
    console.log(`::error::${verdict.reason}`);
    process.exit(1);
  }
  if (verdict.action === 'skip') console.log(`::notice::${verdict.reason}`);
  if (output) {
    appendFileSync(output, `deliver=${verdict.action === 'deliver'}\n`);
  }
}
