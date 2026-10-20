// Derived from openspec/changes/add-identity-authentication/specs/api-delivery/spec.md
// before implementation: the scenarios that read `.github/workflows/deploy.yml`,
// `.github/workflows/promote.yml` and `.github/actions/deliver-api/action.yml`
// ("Both workflows pass the Environment's variable", "The client IDs reach
// the rendering through env", "Both workflows pass the Environment's
// secret", "The allowlist reaches the rendering through env"). The action's
// inputs are `google-client-ids` and `signup-allowed-emails` (design decision
// 11). Provenance of each assertion is recorded in the change's test-plan.md.
//
// Each check is a function returning the problems it finds, applied to the
// repository's files and, beside them, to inline fixtures that must fail, so
// that a check which reads nothing cannot pass unnoticed.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const DEPLOY = '.github/workflows/deploy.yml';
const PROMOTE = '.github/workflows/promote.yml';
const ACTION = '.github/actions/deliver-api/action.yml';

const CLIENT_IDS_INPUT = 'google-client-ids';
const CLIENT_IDS_VARIABLE = 'BASIS_API_GOOGLE_CLIENT_IDS';
const CLIENT_IDS_ENV = 'GOOGLE_CLIENT_IDS';
const ALLOWLIST_INPUT = 'signup-allowed-emails';
const ALLOWLIST_SECRET = 'BASIS_API_SIGNUP_ALLOWED_EMAILS';
const ALLOWLIST_ENV = 'SIGNUP_ALLOWED_EMAILS';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---
// Found, in narrower forms, in delivery-files-migrate.spec.ts.

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  shell?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
}

const stepsOf = (text: string): Step[] => {
  const doc = (parse(text) ?? {}) as {
    jobs?: Record<string, { steps?: Step[] }>;
    runs?: { steps?: Step[] };
  };
  return [
    ...Object.values(doc.jobs ?? {}).flatMap((job) => job.steps ?? []),
    ...(doc.runs?.steps ?? []),
  ];
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

/** Problems with a workflow's delivery steps passing `expression` (`vars.X` or `secrets.X`) as `input`. */
const workflowPassesProblems = (
  text: string,
  input: string,
  expression: string,
): string[] => {
  const deliveries = stepsOf(text).filter((step) =>
    String(step.uses ?? '').includes('deliver-api'),
  );
  const problems: string[] = [];
  if (deliveries.length === 0) problems.push('no delivery step');
  const wanted = new RegExp(`^\\$\\{\\{\\s*${escape(expression)}\\s*\\}\\}$`);
  for (const step of deliveries)
    if (!wanted.test(String(step.with?.[input] ?? '')))
      problems.push(
        `a delivery passes ${JSON.stringify(step.with?.[input])} as ${input}`,
      );
  return problems;
};

/** Problems with a secret being mentioned anywhere but the delivery steps' inputs. */
const secretConfinedProblems = (text: string, secret: string): string[] => {
  const deliveries = stepsOf(text).filter((step) =>
    String(step.uses ?? '').includes('deliver-api'),
  );
  const mentions = text.split(secret).length - 1;
  return mentions === deliveries.length
    ? []
    : [`${secret} is mentioned ${mentions} times`];
};

/** Problems with the action declaring `input`, keeping it out of every `run:` body, and passing it to the rendering as `envName`. */
const actionEnvProblems = (
  text: string,
  input: string,
  envName: string,
): string[] => {
  const doc = (parse(text) ?? {}) as { inputs?: Record<string, unknown> };
  const problems: string[] = [];
  if (!(input in (doc.inputs ?? {}))) problems.push(`no input ${input}`);
  const steps = stepsOf(text);
  const inRun = new RegExp(`\\$\\{\\{[^}]*${escape(input)}[^}]*\\}\\}`);
  for (const step of steps)
    if (typeof step.run === 'string' && inRun.test(step.run))
      problems.push(`a run body interpolates ${input}`);
  const rendering = steps.filter((step) =>
    String(step.run ?? '').includes('render-env'),
  );
  if (rendering.length === 0) problems.push('no rendering step');
  const fromInput = new RegExp(
    `^\\$\\{\\{\\s*inputs\\.${escape(input)}\\s*\\}\\}$`,
  );
  for (const step of rendering)
    if (!fromInput.test(String(step.env?.[envName] ?? '')))
      problems.push(
        `the rendering step does not take ${envName} from ${input}`,
      );
  return problems;
};

/**
 * Executes the action's first step as a composite step's bash would, with
 * every `${{ inputs.<name> }}` substituted: `x` for each declared input, and
 * the given values for the inputs named in `values`.
 */
const runFirstStep = (text: string, values: Record<string, string>) => {
  const doc = (parse(text) ?? {}) as { inputs?: Record<string, unknown> };
  const first = stepsOf(text)[0];
  if (!first || typeof first.run !== 'string')
    return { status: -1, output: 'the first step is not a shell step' };
  const declared: Record<string, string> = Object.fromEntries(
    Object.keys(doc.inputs ?? {}).map((name) => [name, values[name] ?? 'x']),
  );
  const substitute = (value: unknown) => {
    const out = String(value).replace(
      /\$\{\{\s*inputs\.([\w-]+)\s*\}\}/g,
      (_m, name: string) => {
        if (!(name in declared)) throw new Error(`undeclared input ${name}`);
        return declared[name] ?? '';
      },
    );
    if (out.includes('${{'))
      throw new Error(`unsupported expression in the first step: ${out}`);
    return out;
  };
  const dir = mkdtempSync(join(tmpdir(), 'deliver-api-identity-'));
  try {
    const scriptPath = join(dir, 'step.sh');
    writeFileSync(scriptPath, substitute(first.run));
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: join(dir, 'output'),
      GITHUB_ENV: join(dir, 'env'),
      GITHUB_STEP_SUMMARY: join(dir, 'summary'),
    };
    for (const [key, value] of Object.entries(first.env ?? {}))
      env[key] = substitute(value);
    const result = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', scriptPath],
      { encoding: 'utf8', timeout: 10_000, cwd: dir, env },
    );
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const CLIENT_IDS_NAMED = /google[-_ ]client[-_ ]ids/i;
const ALLOWLIST_NAMED = /signup[-_ ]allowed[-_ ]emails/i;

/** Problems with the first step admitting empty client IDs. */
const clientIdsRefusalProblems = (text: string): string[] => {
  const run = runFirstStep(text, { [CLIENT_IDS_INPUT]: '' });
  const problems: string[] = [];
  if (run.status === 0)
    problems.push('the first step admits empty Google client IDs');
  if (!CLIENT_IDS_NAMED.test(run.output))
    problems.push('the refusal does not name the Google client IDs');
  return problems;
};

/** Problems with the first step refusing an empty allowlist. */
const allowlistNotRefusedProblems = (text: string): string[] => {
  const doc = (parse(text) ?? {}) as { inputs?: Record<string, unknown> };
  if (!(ALLOWLIST_INPUT in (doc.inputs ?? {})))
    return [`no input ${ALLOWLIST_INPUT}`];
  const empty = runFirstStep(text, { [ALLOWLIST_INPUT]: '' });
  const filled = runFirstStep(text, { [ALLOWLIST_INPUT]: 'x' });
  const problems: string[] = [];
  if (empty.status !== filled.status)
    problems.push(
      `the first step exits ${empty.status} with an empty allowlist and ${filled.status} with one`,
    );
  if (ALLOWLIST_NAMED.test(empty.output))
    problems.push('the first step names the allowlist when it is empty');
  return problems;
};

// --- The checks applied to fixtures that must fail ------------------------

describe('the checks themselves discriminate', () => {
  const goodWorkflow = `
jobs:
  deliver:
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/deliver-api
        with:
          image-digest: \${{ needs.build.outputs.digest }}
          ${CLIENT_IDS_INPUT}: \${{ vars.${CLIENT_IDS_VARIABLE} }}
          ${ALLOWLIST_INPUT}: \${{ secrets.${ALLOWLIST_SECRET} }}
`;
  it('the workflow checks pass a well-formed fixture', () => {
    expect(
      workflowPassesProblems(
        goodWorkflow,
        CLIENT_IDS_INPUT,
        `vars.${CLIENT_IDS_VARIABLE}`,
      ),
    ).toEqual([]);
    expect(
      workflowPassesProblems(
        goodWorkflow,
        ALLOWLIST_INPUT,
        `secrets.${ALLOWLIST_SECRET}`,
      ),
    ).toEqual([]);
    expect(secretConfinedProblems(goodWorkflow, ALLOWLIST_SECRET)).toEqual([]);
  });
  it.each([
    [
      'no client IDs',
      goodWorkflow.replace(/ {10}google-client-ids:[^\n]*\n/, ''),
    ],
    [
      'a secret instead of the variable',
      goodWorkflow.replace(
        `vars.${CLIENT_IDS_VARIABLE}`,
        `secrets.${CLIENT_IDS_VARIABLE}`,
      ),
    ],
    [
      'another variable',
      goodWorkflow.replace(`vars.${CLIENT_IDS_VARIABLE}`, 'vars.OTHER_IDS'),
    ],
    ['no delivery step', 'jobs:\n  deliver:\n    steps:\n      - run: true\n'],
  ])('the client-ID workflow check fails a fixture with %s', (_name, text) => {
    expect(
      workflowPassesProblems(
        text,
        CLIENT_IDS_INPUT,
        `vars.${CLIENT_IDS_VARIABLE}`,
      ),
    ).not.toEqual([]);
  });
  it.each([
    [
      'no allowlist',
      goodWorkflow.replace(/ {10}signup-allowed-emails:[^\n]*\n/, ''),
    ],
    [
      'a variable instead of the secret',
      goodWorkflow.replace(
        `secrets.${ALLOWLIST_SECRET}`,
        `vars.${ALLOWLIST_SECRET}`,
      ),
    ],
  ])('the allowlist workflow check fails a fixture with %s', (_name, text) => {
    expect(
      workflowPassesProblems(
        text,
        ALLOWLIST_INPUT,
        `secrets.${ALLOWLIST_SECRET}`,
      ),
    ).not.toEqual([]);
  });
  it('the confinement check fails a fixture mentioning the secret elsewhere', () => {
    expect(
      secretConfinedProblems(
        `${goodWorkflow}      - run: echo "\${{ secrets.${ALLOWLIST_SECRET} }}"\n`,
        ALLOWLIST_SECRET,
      ),
    ).not.toEqual([]);
  });

  const goodAction = `
inputs:
  image-digest:
    required: true
  ${CLIENT_IDS_INPUT}:
    required: true
  ${ALLOWLIST_INPUT}:
    required: false
    default: ""
runs:
  using: composite
  steps:
    - name: Refuse missing inputs
      shell: bash
      env:
        IMAGE_DIGEST: \${{ inputs.image-digest }}
        GOOGLE_CLIENT_IDS: \${{ inputs.${CLIENT_IDS_INPUT} }}
      run: |
        [ -n "$IMAGE_DIGEST" ] || { echo "::error::image-digest is required"; exit 1; }
        [ -n "$GOOGLE_CLIENT_IDS" ] || { echo "::error::google-client-ids is required"; exit 1; }
    - name: Join the tailnet
      uses: tailscale/github-action@v3
    - name: Render
      shell: bash
      env:
        ${CLIENT_IDS_ENV}: \${{ inputs.${CLIENT_IDS_INPUT} }}
        ${ALLOWLIST_ENV}: \${{ inputs.${ALLOWLIST_INPUT} }}
      run: node tools/delivery/src/render-env.ts
`;
  it('the action checks pass a well-formed fixture', () => {
    expect(
      actionEnvProblems(goodAction, CLIENT_IDS_INPUT, CLIENT_IDS_ENV),
    ).toEqual([]);
    expect(
      actionEnvProblems(goodAction, ALLOWLIST_INPUT, ALLOWLIST_ENV),
    ).toEqual([]);
    expect(clientIdsRefusalProblems(goodAction)).toEqual([]);
    expect(allowlistNotRefusedProblems(goodAction)).toEqual([]);
  });
  it.each([
    [
      'no input',
      goodAction.replace(`  ${CLIENT_IDS_INPUT}:\n    required: true\n`, ''),
    ],
    [
      'the input in a run body',
      goodAction.replace(
        'run: node tools/delivery/src/render-env.ts',
        `run: GOOGLE_CLIENT_IDS='\${{ inputs.${CLIENT_IDS_INPUT} }}' node tools/delivery/src/render-env.ts`,
      ),
    ],
    [
      'the rendering without the env',
      goodAction.replace(/ {8}GOOGLE_CLIENT_IDS: [^\n]*\n(?= {8}SIGNUP)/, ''),
    ],
  ])('the client-ID action check fails a fixture with %s', (_name, text) => {
    expect(
      actionEnvProblems(text, CLIENT_IDS_INPUT, CLIENT_IDS_ENV),
    ).not.toEqual([]);
  });
  it.each([
    [
      'the input in a run body',
      goodAction.replace(
        'run: node tools/delivery/src/render-env.ts',
        `run: echo "\${{ inputs.${ALLOWLIST_INPUT} }}" > /dev/null; node tools/delivery/src/render-env.ts`,
      ),
    ],
    [
      'the rendering without the env',
      goodAction.replace(/ {8}SIGNUP_ALLOWED_EMAILS: [^\n]*\n/, ''),
    ],
  ])('the allowlist action check fails a fixture with %s', (_name, text) => {
    expect(actionEnvProblems(text, ALLOWLIST_INPUT, ALLOWLIST_ENV)).not.toEqual(
      [],
    );
  });
  it('the refusal check fails a first step that does not refuse empty client IDs', () => {
    const permissive = goodAction.replace(
      / {8}\[ -n "\$GOOGLE_CLIENT_IDS" \][^\n]*\n/,
      '',
    );
    expect(clientIdsRefusalProblems(permissive)).not.toEqual([]);
  });
  it('the non-refusal check fails a first step that refuses an empty allowlist', () => {
    const strict = goodAction
      .replace(
        '        GOOGLE_CLIENT_IDS: ${{ inputs.google-client-ids }}\n      run: |',
        `        GOOGLE_CLIENT_IDS: \${{ inputs.google-client-ids }}\n        SIGNUP_ALLOWED_EMAILS: \${{ inputs.${ALLOWLIST_INPUT} }}\n      run: |`,
      )
      .replace(
        '        [ -n "$GOOGLE_CLIENT_IDS" ]',
        '        [ -n "$SIGNUP_ALLOWED_EMAILS" ] || { echo "::error::signup-allowed-emails is required"; exit 1; }\n        [ -n "$GOOGLE_CLIENT_IDS" ]',
      );
    expect(allowlistNotRefusedProblems(strict)).not.toEqual([]);
  });
});

// --- The checks applied to the repository's files -------------------------

describe("both workflows pass the Environment's variable", () => {
  it.each([DEPLOY, PROMOTE])(
    `%s passes vars.${CLIENT_IDS_VARIABLE} as the delivery's Google client IDs`,
    (path) => {
      expect(
        workflowPassesProblems(
          read(path),
          CLIENT_IDS_INPUT,
          `vars.${CLIENT_IDS_VARIABLE}`,
        ),
      ).toEqual([]);
    },
  );
});

describe('the client IDs reach the rendering through env', () => {
  it(`${ACTION} declares ${CLIENT_IDS_INPUT}, interpolates it in no run body, and passes it to the rendering as ${CLIENT_IDS_ENV}`, () => {
    expect(
      actionEnvProblems(read(ACTION), CLIENT_IDS_INPUT, CLIENT_IDS_ENV),
    ).toEqual([]);
  });

  it(`${ACTION}'s first step refuses empty ${CLIENT_IDS_INPUT}`, () => {
    expect(clientIdsRefusalProblems(read(ACTION))).toEqual([]);
  });
});

describe("both workflows pass the Environment's secret", () => {
  it.each([DEPLOY, PROMOTE])(
    `%s passes secrets.${ALLOWLIST_SECRET} as the delivery's sign-up allowlist`,
    (path) => {
      expect(
        workflowPassesProblems(
          read(path),
          ALLOWLIST_INPUT,
          `secrets.${ALLOWLIST_SECRET}`,
        ),
      ).toEqual([]);
    },
  );

  it.each([DEPLOY, PROMOTE])(
    `%s mentions secrets.${ALLOWLIST_SECRET} nowhere but the delivery's input (derived from "pass it to the rendering only through a step's env:")`,
    (path) => {
      expect(secretConfinedProblems(read(path), ALLOWLIST_SECRET)).toEqual([]);
    },
  );
});

describe('the allowlist reaches the rendering through env', () => {
  it(`${ACTION} declares ${ALLOWLIST_INPUT}, interpolates it in no run body, and passes it to the rendering as ${ALLOWLIST_ENV}`, () => {
    expect(
      actionEnvProblems(read(ACTION), ALLOWLIST_INPUT, ALLOWLIST_ENV),
    ).toEqual([]);
  });

  it(`${ACTION}'s first step does not refuse an empty ${ALLOWLIST_INPUT}`, () => {
    expect(allowlistNotRefusedProblems(read(ACTION))).toEqual([]);
  });
});
