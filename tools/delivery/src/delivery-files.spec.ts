// Derived from openspec/changes/move-api-deploys-to-staging-with-promotion/specs/api-delivery/spec.md
// before implementation: the scenarios that read `.github/workflows/*.yml`,
// `.github/actions/deliver-api/action.yml` and `deploy/api/docker-compose.yml`
// (design decision 7). Provenance of each assertion is recorded in that
// change's test-plan.md.
//
// Each check is a function returning the problems it finds, applied to the
// repository's files and, beside them, to inline fixtures that must fail, so
// that a check which reads nothing cannot pass unnoticed.
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const DEPLOY = '.github/workflows/deploy.yml';
const PROMOTE = '.github/workflows/promote.yml';
const ACTION = '.github/actions/deliver-api/action.yml';
const COMPOSE = 'deploy/api/docker-compose.yml';

const VALID_COMMIT = '0123456789abcdef0123456789abcdef01234567';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: unknown;
  shell?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
}
interface Job {
  environment?: string | { name?: string };
  env?: Record<string, unknown>;
  steps?: Step[];
}
interface Workflow {
  on?: unknown;
  env?: Record<string, unknown>;
  jobs?: Record<string, Job>;
}

const workflow = (text: string) => (parse(text) ?? {}) as Workflow;

const triggersOf = (wf: Workflow): string[] => {
  if (typeof wf.on === 'string') return [wf.on];
  if (Array.isArray(wf.on)) return wf.on.map(String);
  return Object.keys((wf.on as Record<string, unknown>) ?? {});
};

const environmentOf = (job: Job) =>
  typeof job.environment === 'string' ? job.environment : job.environment?.name;

const environmentsOf = (wf: Workflow) =>
  Object.values(wf.jobs ?? {})
    .map(environmentOf)
    .filter((name): name is string => name !== undefined);

const isCheckout = (step: Step) =>
  typeof step.uses === 'string' && step.uses.startsWith('actions/checkout');

// --- The checks -----------------------------------------------------------

const mergeWorkflowProblems = (text: string): string[] => {
  const wf = workflow(text);
  const problems: string[] = [];
  const triggers = triggersOf(wf);
  if (triggers.length !== 1 || triggers[0] !== 'workflow_run')
    problems.push(`triggers are ${JSON.stringify(triggers)}`);
  const run = (wf.on as Record<string, { workflows?: unknown }> | undefined)
    ?.workflow_run;
  if (JSON.stringify(run?.workflows) !== JSON.stringify(['CI']))
    problems.push('workflow_run is not of CI alone');
  const environments = environmentsOf(wf);
  if (environments.length === 0)
    problems.push('no job declares an Environment');
  for (const name of environments)
    if (name !== 'staging') problems.push(`a job declares ${name}`);
  if (text.includes('MAIN_PRODUCTION_DEPLOY_HOST'))
    problems.push('mentions MAIN_PRODUCTION_DEPLOY_HOST');
  return problems;
};

const promotionTriggerProblems = (text: string): string[] => {
  const wf = workflow(text);
  const problems: string[] = [];
  const triggers = triggersOf(wf);
  if (triggers.length !== 1 || triggers[0] !== 'workflow_dispatch')
    problems.push(`triggers are ${JSON.stringify(triggers)}`);
  const dispatch = (
    wf.on as
      | Record<string, { inputs?: Record<string, { required?: unknown }> }>
      | undefined
  )?.workflow_dispatch;
  if (dispatch?.inputs?.commit?.required !== true)
    problems.push('no required input commit');
  return problems;
};

const productionDeclarationProblems = (files: Record<string, string>) => {
  const problems: string[] = [];
  for (const [name, text] of Object.entries(files)) {
    const declares = environmentsOf(workflow(text)).includes('production');
    if (name === 'promote.yml' && !declares)
      problems.push('promote.yml does not declare production');
    if (name !== 'promote.yml' && declares)
      problems.push(`${name} declares production`);
  }
  if (!('promote.yml' in files)) problems.push('promote.yml is absent');
  return problems;
};

const onlyJobOf = (wf: Workflow) => {
  const jobs = Object.values(wf.jobs ?? {});
  if (jobs.length !== 1)
    throw new Error(`expected one job, found ${jobs.length}`);
  return jobs[0] as NonNullable<(typeof jobs)[number]>;
};

const refRefusalProblems = (text: string): string[] => {
  const job = onlyJobOf(workflow(text));
  const steps = job.steps ?? [];
  const problems: string[] = [];
  const first = steps[0];
  if (!first) return ['the job has no steps'];
  if (first.uses !== undefined || typeof first.run !== 'string')
    problems.push('the first step is not a shell step');
  const firstText = JSON.stringify(first);
  if (!firstText.includes('refs/heads/main'))
    problems.push('the first step does not name refs/heads/main');
  if (!/github\.ref\b|GITHUB_REF\b/.test(firstText))
    problems.push('the first step does not read github.ref');
  if (steps.findIndex(isCheckout) === 0)
    problems.push('a checkout is the first step');
  if (!steps.some(isCheckout)) problems.push('the job checks nothing out');
  return problems;
};

// Executes the shell steps before the job's first checkout, as GitHub's default
// bash would, with `github.ref` and the `commit` input substituted.
const runBeforeCheckout = (text: string, ref: string, commit: string) => {
  const wf = workflow(text);
  const job = onlyJobOf(wf);
  const steps = job.steps ?? [];
  const firstCheckout = steps.findIndex(isCheckout);
  const before = steps.slice(
    0,
    firstCheckout === -1 ? steps.length : firstCheckout,
  );
  const substitute = (value: unknown) => {
    const out = String(value)
      .replace(/\$\{\{\s*github\.ref\s*\}\}/g, ref)
      .replace(/\$\{\{\s*(github\.event\.)?inputs\.commit\s*\}\}/g, commit);
    if (out.includes('${{'))
      throw new Error(`unsupported expression before checkout: ${out}`);
    return out;
  };
  const dir = mkdtempSync(join(tmpdir(), 'promote-'));
  try {
    for (const step of before) {
      if (step.run === undefined) continue;
      if (step.if !== undefined)
        throw new Error('a conditional step before checkout is not supported');
      const scriptPath = join(dir, 'step.sh');
      writeFileSync(scriptPath, substitute(step.run));
      const env: Record<string, string> = {
        PATH: process.env.PATH ?? '',
        GITHUB_REF: ref,
        GITHUB_REF_NAME: ref.replace(/^refs\/heads\//, ''),
        GITHUB_OUTPUT: join(dir, 'output'),
        GITHUB_ENV: join(dir, 'env'),
        GITHUB_STEP_SUMMARY: join(dir, 'summary'),
      };
      for (const scope of [wf.env, job.env, step.env])
        for (const [key, value] of Object.entries(scope ?? {}))
          env[key] = substitute(value);
      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-eo', 'pipefail', scriptPath],
        { encoding: 'utf8', timeout: 10_000, cwd: dir, env },
      );
      if (result.status !== 0)
        return {
          status: result.status,
          output: `${result.stdout}${result.stderr}`,
        };
    }
    return { status: 0, output: '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const LITERAL_HOSTNAMES = [
  'shatynska.com',
  'main-staging.',
  'main-production.',
];
const literalHostnameProblems = (text: string) =>
  LITERAL_HOSTNAMES.filter((literal) => text.includes(literal)).map(
    (literal) => `contains ${literal}`,
  );

interface ComposeService {
  image?: string;
  labels?: Record<string, unknown> | string[];
}
const servicesOf = (text: string) =>
  ((parse(text) ?? {}) as { services?: Record<string, ComposeService> })
    .services ?? {};

const labelOf = (service: ComposeService | undefined, key: string) => {
  const labels = service?.labels;
  if (Array.isArray(labels)) {
    const entry = labels.find((l) => String(l).startsWith(`${key}=`));
    return entry === undefined
      ? undefined
      : String(entry).slice(key.length + 1);
  }
  const value = labels?.[key];
  return value === undefined ? undefined : String(value);
};

const COMPOSE_IMAGE =
  /^ghcr\.io\/shatynska-labs\/basis-api@\$\{IMAGE_DIGEST:\?[^}]*\}$/;
const COMPOSE_RULE = /^\$\{ROUTER_RULE:\?[^}]*\}$/;

const composeImageProblems = (text: string): string[] => {
  const services = servicesOf(text);
  const images = Object.entries(services).filter(
    ([, s]) => s.image !== undefined,
  );
  const problems: string[] = [];
  if (images.length !== 1) problems.push(`${images.length} image references`);
  const image = services.api?.image;
  if (image === undefined || !COMPOSE_IMAGE.test(image))
    problems.push(`service api's image is ${JSON.stringify(image)}`);
  return problems;
};

const composeRuleProblems = (text: string): string[] => {
  const rule = labelOf(
    servicesOf(text).api,
    'traefik.http.routers.basis-api.rule',
  );
  return rule !== undefined && COMPOSE_RULE.test(rule)
    ? []
    : [`router rule is ${JSON.stringify(rule)}`];
};

// --- The checks applied to fixtures that must fail ------------------------

describe('the checks themselves discriminate', () => {
  const goodDeploy = `
name: Deploy
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
jobs:
  deploy:
    environment: staging
    steps:
      - run: echo "$HOST"
        env:
          HOST: \${{ vars.MAIN_STAGING_DEPLOY_HOST }}
`;
  it('the merge check passes a staging-only fixture', () => {
    expect(mergeWorkflowProblems(goodDeploy)).toEqual([]);
  });
  it.each([
    [
      'a push trigger',
      goodDeploy.replace('  workflow_run:', '  push:\n  workflow_run:'),
    ],
    ['another workflow', goodDeploy.replace('[CI]', '[Lint]')],
    [
      'a production job',
      `${goodDeploy}  prod:\n    environment:\n      name: production\n`,
    ],
    ['no Environment', goodDeploy.replace('    environment: staging\n', '')],
    [
      'the production host',
      goodDeploy.replace('MAIN_STAGING', 'MAIN_PRODUCTION'),
    ],
  ])('the merge check fails a fixture with %s', (_name, text) => {
    expect(mergeWorkflowProblems(text)).not.toEqual([]);
  });

  const goodPromote = `
name: Promote
on:
  workflow_dispatch:
    inputs:
      commit:
        required: true
        type: string
jobs:
  promote:
    environment: production
    steps:
      - name: Refuse
        env:
          REF: \${{ github.ref }}
          COMMIT: \${{ inputs.commit }}
        run: |
          [ "$REF" = refs/heads/main ] || { echo "::error::not refs/heads/main: $REF"; exit 1; }
          [[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "::error::commit is not a full commit SHA"; exit 1; }
      - uses: actions/checkout@v5
`;
  it('the promotion checks pass a well-formed fixture', () => {
    expect(promotionTriggerProblems(goodPromote)).toEqual([]);
    expect(refRefusalProblems(goodPromote)).toEqual([]);
    expect(
      productionDeclarationProblems({
        'promote.yml': goodPromote,
        'deploy.yml': goodDeploy,
      }),
    ).toEqual([]);
    expect(
      runBeforeCheckout(goodPromote, 'refs/heads/main', VALID_COMMIT).status,
    ).toBe(0);
    expect(
      runBeforeCheckout(goodPromote, 'refs/heads/other', VALID_COMMIT).status,
    ).not.toBe(0);
    expect(
      runBeforeCheckout(goodPromote, 'refs/heads/main', 'main').status,
    ).not.toBe(0);
  });
  it.each([
    [
      'a push trigger',
      goodPromote.replace(
        '  workflow_dispatch:',
        '  push:\n  workflow_dispatch:',
      ),
    ],
    [
      'an optional commit',
      goodPromote.replace('required: true', 'required: false'),
    ],
  ])('the trigger check fails a fixture with %s', (_name, text) => {
    expect(promotionTriggerProblems(text)).not.toEqual([]);
  });
  it('the ref check fails a fixture checking out first', () => {
    const checkoutFirst = goodPromote
      .replace('      - uses: actions/checkout@v5\n', '')
      .replace(
        '    steps:\n',
        '    steps:\n      - uses: actions/checkout@v5\n',
      );
    expect(refRefusalProblems(checkoutFirst)).not.toEqual([]);
  });
  it('the ref check fails a fixture whose first step ignores the ref', () => {
    expect(
      refRefusalProblems(goodPromote.replace(/refs\/heads\/main/g, 'x')),
    ).not.toEqual([]);
  });
  it('the production check fails another workflow declaring production', () => {
    expect(
      productionDeclarationProblems({
        'promote.yml': goodPromote,
        'deploy.yml': goodDeploy.replace(
          'environment: staging',
          'environment: production',
        ),
      }),
    ).not.toEqual([]);
  });
  it('the execution reports success for a refusal that refuses nothing', () => {
    const permissive = goodPromote.replace(
      /run: \|[\s\S]*?(?= {6}- uses)/,
      'run: echo ok\n',
    );
    expect(
      runBeforeCheckout(permissive, 'refs/heads/other', VALID_COMMIT).status,
    ).toBe(0);
  });

  const goodCompose = `
services:
  api:
    image: ghcr.io/shatynska-labs/basis-api@\${IMAGE_DIGEST:?IMAGE_DIGEST is not rendered}
    labels:
      - traefik.enable=true
      - traefik.http.routers.basis-api.rule=\${ROUTER_RULE:?ROUTER_RULE is not rendered}
`;
  it('the Compose checks pass a digest-and-rendered-rule fixture', () => {
    expect(composeImageProblems(goodCompose)).toEqual([]);
    expect(composeRuleProblems(goodCompose)).toEqual([]);
    expect(literalHostnameProblems(goodCompose)).toEqual([]);
  });
  it.each([
    ['a tag', goodCompose.replace(/@\$\{IMAGE_DIGEST[^}]*\}/, ':${COMMIT}')],
    [
      'a default instead of a refusal',
      goodCompose.replace('IMAGE_DIGEST:?', 'IMAGE_DIGEST:-'),
    ],
    ['a second image', `${goodCompose}  sidecar:\n    image: busybox\n`],
  ])('the image check fails a fixture with %s', (_name, text) => {
    expect(composeImageProblems(text)).not.toEqual([]);
  });
  it.each([
    [
      'a literal rule',
      goodCompose.replace(
        /\$\{ROUTER_RULE[^}]*\}/,
        'Host(`api.basis.shatynska.com`)',
      ),
    ],
    [
      'a rule that may be unset',
      goodCompose.replace(
        'ROUTER_RULE:?ROUTER_RULE is not rendered',
        'ROUTER_RULE',
      ),
    ],
  ])('the rule check fails a fixture with %s', (_name, text) => {
    expect(composeRuleProblems(text)).not.toEqual([]);
  });
  it.each(LITERAL_HOSTNAMES)(
    'the hostname check fails a fixture containing %s',
    (literal) => {
      expect(literalHostnameProblems(`host: x.${literal}y`)).not.toEqual([]);
    },
  );
});

// --- The checks applied to the repository's files -------------------------

describe('the merge workflow targets staging only', () => {
  it(`${DEPLOY} is triggered by CI alone and declares only staging`, () => {
    expect(mergeWorkflowProblems(read(DEPLOY))).toEqual([]);
  });
});

describe('the promotion has no automatic trigger', () => {
  it(`${PROMOTE} is triggered by workflow_dispatch alone, with a required commit`, () => {
    expect(promotionTriggerProblems(read(PROMOTE))).toEqual([]);
  });

  it('promote.yml is the only workflow declaring production', () => {
    const dir = join(root, '.github/workflows');
    const files = Object.fromEntries(
      readdirSync(dir)
        .filter((name) => /\.ya?ml$/.test(name))
        .map((name) => [name, readFileSync(join(dir, name), 'utf8')]),
    );
    expect(productionDeclarationProblems(files)).toEqual([]);
  });
});

describe('a promotion from another branch is refused', () => {
  it("the promotion job's first step refuses unless github.ref is refs/heads/main, before every checkout", () => {
    expect(refRefusalProblems(read(PROMOTE))).toEqual([]);
  });

  it('run before any checkout, it refuses another ref and admits main', () => {
    const text = read(PROMOTE);
    const other = runBeforeCheckout(text, 'refs/heads/other', VALID_COMMIT);
    expect(other.status).not.toBe(0);
    expect(other.output).toContain('refs/heads/other');
    expect(
      runBeforeCheckout(text, 'refs/heads/main', VALID_COMMIT).status,
    ).toBe(0);
  });

  it('run before any checkout, it refuses a malformed commit', () => {
    const text = read(PROMOTE);
    for (const commit of [
      'main',
      VALID_COMMIT.slice(0, 7),
      VALID_COMMIT.toUpperCase(),
      `${VALID_COMMIT}0`,
    ])
      expect(
        runBeforeCheckout(text, 'refs/heads/main', commit).status,
      ).not.toBe(0);
  });
});

describe('a promotion does not build', () => {
  it(`${PROMOTE} uses no build action`, () => {
    const steps = Object.values(workflow(read(PROMOTE)).jobs ?? {}).flatMap(
      (job) => job.steps ?? [],
    );
    expect(
      steps.filter((s) =>
        String(s.uses ?? '').startsWith('docker/build-push-action'),
      ),
    ).toEqual([]);
    expect(read(PROMOTE)).not.toMatch(/docker (buildx )?build\b/);
  });
});

describe('the Compose file has no tag', () => {
  it(`${COMPOSE}'s only image reference is the digest, failing when unset`, () => {
    expect(composeImageProblems(read(COMPOSE))).toEqual([]);
  });
});

describe('no literal hostname', () => {
  it.each([COMPOSE, DEPLOY, PROMOTE])(
    '%s contains no literal hostname',
    (path) => {
      expect(literalHostnameProblems(read(path))).toEqual([]);
    },
  );

  it(`${COMPOSE}'s router rule is \${ROUTER_RULE…}, failing when unset`, () => {
    expect(composeRuleProblems(read(COMPOSE))).toEqual([]);
  });

  it(`${ACTION} contains no literal hostname`, () => {
    expect(literalHostnameProblems(read(ACTION))).toEqual([]);
  });
});
