// Derived from openspec/changes/add-persistence-skeleton/specs/api-delivery/spec.md
// before implementation: the scenarios that read `deploy/api/docker-compose.yml`,
// `.github/workflows/deploy.yml`, `.github/workflows/promote.yml` and
// `.github/actions/deliver-api/action.yml` ("Both hosts run the same image,
// by digest" as revised; "Each delivery migrates the database before the API
// starts"; "The database password reaches a delivery from the Environment
// alone"). The action input is `database-password` (design decision 6).
// Provenance of each assertion is recorded in the change's test-plan.md.
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
const COMPOSE = 'deploy/api/docker-compose.yml';

const SECRET = 'BASIS_API_DATABASE_PASSWORD';
const INPUT = 'database-password';

// --- Compose --------------------------------------------------------------
// Declared locally (see "Missing shared arrangement" in test-plan.md; a
// narrower reading is declared in delivery-files.spec.ts).

interface ComposeService {
  image?: string;
  command?: string | string[];
  env_file?: string | (string | { path?: string })[];
  networks?: string[] | Record<string, unknown>;
  restart?: unknown;
  labels?: Record<string, unknown> | string[];
  healthcheck?: { disable?: unknown; test?: unknown };
  depends_on?: string[] | Record<string, { condition?: unknown }>;
  read_only?: unknown;
  cap_drop?: string[];
  security_opt?: string[];
  volumes?: unknown[];
}
const servicesOf = (text: string) =>
  ((parse(text) ?? {}) as { services?: Record<string, ComposeService> })
    .services ?? {};

const labelKeys = (service: ComposeService) =>
  Array.isArray(service.labels)
    ? service.labels.map((label) => String(label).split('=')[0] ?? '')
    : Object.keys(service.labels ?? {});

const COMPOSE_IMAGE =
  /^ghcr\.io\/shatynska-labs\/basis-api@\$\{IMAGE_DIGEST:\?[^}]*\}$/;

const composeImagesProblems = (text: string): string[] => {
  const withImage = Object.entries(servicesOf(text)).filter(
    ([, s]) => s.image !== undefined,
  );
  const problems: string[] = [];
  const names = withImage.map(([name]) => name).sort();
  if (JSON.stringify(names) !== JSON.stringify(['api', 'migrate']))
    problems.push(`image references in ${JSON.stringify(names)}`);
  for (const [name, service] of withImage)
    if (!COMPOSE_IMAGE.test(String(service.image)))
      problems.push(
        `service ${name}'s image is ${JSON.stringify(service.image)}`,
      );
  return problems;
};

const commandOf = (service: ComposeService) =>
  Array.isArray(service.command) ? service.command.join(' ') : service.command;

const envFilesOf = (service: ComposeService) =>
  (Array.isArray(service.env_file) ? service.env_file : [service.env_file])
    .filter((entry) => entry !== undefined)
    .map((entry) => (typeof entry === 'string' ? entry : entry?.path));

const networksOf = (service: ComposeService) =>
  Array.isArray(service.networks)
    ? service.networks
    : Object.keys(service.networks ?? {});

const healthcheckDisabled = (service: ComposeService) =>
  service.healthcheck?.disable === true ||
  JSON.stringify(service.healthcheck?.test) === JSON.stringify(['NONE']);

const migrationServiceProblems = (text: string): string[] => {
  const services = servicesOf(text);
  const migrate = services.migrate;
  if (!migrate) return ['no service migrate'];
  const problems: string[] = [];
  if (commandOf(migrate) !== 'node dist/migrate.js')
    problems.push(`command is ${JSON.stringify(migrate.command)}`);
  if (JSON.stringify(envFilesOf(migrate)) !== JSON.stringify(['.env']))
    problems.push(`env_file is ${JSON.stringify(migrate.env_file)}`);
  if (!networksOf(migrate).includes('platform_edge'))
    problems.push('not on platform_edge');
  if (migrate.restart !== 'no')
    problems.push(`restart is ${JSON.stringify(migrate.restart)}`);
  if (labelKeys(migrate).some((key) => key.startsWith('traefik')))
    problems.push('carries a Traefik label');
  if (!healthcheckDisabled(migrate)) problems.push('health check not disabled');
  const dependsOn = services.api?.depends_on;
  const condition = Array.isArray(dependsOn)
    ? undefined
    : dependsOn?.migrate?.condition;
  if (condition !== 'service_completed_successfully')
    problems.push(`api's condition on migrate is ${JSON.stringify(condition)}`);
  return problems;
};

const migrationConfinementProblems = (text: string): string[] => {
  const migrate = servicesOf(text).migrate;
  if (!migrate) return ['no service migrate'];
  const problems: string[] = [];
  if (migrate.read_only !== true) problems.push('not read_only');
  if (!(migrate.cap_drop ?? []).includes('ALL'))
    problems.push('does not drop ALL capabilities');
  if (!(migrate.security_opt ?? []).includes('no-new-privileges:true'))
    problems.push('does not set no-new-privileges:true');
  if ((migrate.volumes ?? []).length > 0 || 'volumes' in migrate)
    problems.push('declares a volume');
  return problems;
};

// --- Workflows and the action ---------------------------------------------

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

const SECRET_EXPRESSION = new RegExp(
  `^\\$\\{\\{\\s*secrets\\.${SECRET}\\s*\\}\\}$`,
);

const workflowSecretProblems = (text: string): string[] => {
  const deliveries = stepsOf(text).filter((step) =>
    String(step.uses ?? '').includes('deliver-api'),
  );
  const problems: string[] = [];
  if (deliveries.length === 0) problems.push('no delivery step');
  for (const step of deliveries)
    if (!SECRET_EXPRESSION.test(String(step.with?.[INPUT] ?? '')))
      problems.push(
        `a delivery passes ${JSON.stringify(step.with?.[INPUT])} as ${INPUT}`,
      );
  const mentions = text.split(SECRET).length - 1;
  if (mentions !== deliveries.length)
    problems.push(`${SECRET} is mentioned ${mentions} times`);
  return problems;
};

const INPUT_EXPRESSION = new RegExp(`\\$\\{\\{[^}]*${INPUT}[^}]*\\}\\}`);
const INPUT_ENV = new RegExp(`^\\$\\{\\{\\s*inputs\\.${INPUT}\\s*\\}\\}$`);

const actionPasswordProblems = (text: string): string[] => {
  const doc = (parse(text) ?? {}) as { inputs?: Record<string, unknown> };
  const problems: string[] = [];
  if (!(INPUT in (doc.inputs ?? {}))) problems.push(`no input ${INPUT}`);
  const steps = stepsOf(text);
  for (const step of steps)
    if (typeof step.run === 'string' && INPUT_EXPRESSION.test(step.run))
      problems.push(`a run body interpolates ${INPUT}`);
  const rendering = steps.filter((step) =>
    String(step.run ?? '').includes('render-env'),
  );
  if (rendering.length === 0) problems.push('no rendering step');
  for (const step of rendering)
    if (!INPUT_ENV.test(String(step.env?.DATABASE_PASSWORD ?? '')))
      problems.push(
        'the rendering step does not take DATABASE_PASSWORD from the input',
      );
  return problems;
};

// Executes the action's first step as a composite step's bash would, with
// every `${{ inputs.<name> }}` substituted: `x` for each declared input, and
// the empty string for `database-password`.
const runFirstStepWithoutPassword = (text: string) => {
  const doc = (parse(text) ?? {}) as { inputs?: Record<string, unknown> };
  const first = stepsOf(text)[0];
  if (!first || typeof first.run !== 'string')
    return { status: -1, output: 'the first step is not a shell step' };
  const values = Object.fromEntries(
    Object.keys(doc.inputs ?? {}).map((name) => [
      name,
      name === INPUT ? '' : 'x',
    ]),
  );
  const substitute = (value: unknown) => {
    const out = String(value).replace(
      /\$\{\{\s*inputs\.([\w-]+)\s*\}\}/g,
      (_m, name: string) => {
        if (!(name in values)) throw new Error(`undeclared input ${name}`);
        return values[name] ?? '';
      },
    );
    if (out.includes('${{'))
      throw new Error(`unsupported expression in the first step: ${out}`);
    return out;
  };
  const dir = mkdtempSync(join(tmpdir(), 'deliver-api-'));
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
      {
        encoding: 'utf8',
        timeout: 10_000,
        cwd: dir,
        env,
      },
    );
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const firstStepRefusalProblems = (text: string): string[] => {
  const run = runFirstStepWithoutPassword(text);
  const problems: string[] = [];
  if (run.status === 0)
    problems.push('the first step admits an empty database password');
  if (!/database[-_ ]password/i.test(run.output))
    problems.push('the refusal does not name the database password');
  return problems;
};

// --- The checks applied to fixtures that must fail ------------------------

describe('the checks themselves discriminate', () => {
  const goodCompose = `
services:
  migrate:
    image: ghcr.io/shatynska-labs/basis-api@\${IMAGE_DIGEST:?IMAGE_DIGEST is not rendered}
    command: [node, dist/migrate.js]
    env_file: .env
    restart: "no"
    healthcheck:
      disable: true
    networks: [platform_edge]
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
  api:
    image: ghcr.io/shatynska-labs/basis-api@\${IMAGE_DIGEST:?IMAGE_DIGEST is not rendered}
    depends_on:
      migrate:
        condition: service_completed_successfully
    labels:
      - traefik.enable=true
networks:
  platform_edge:
    external: true
`;
  it('the Compose checks pass a well-formed fixture', () => {
    expect(composeImagesProblems(goodCompose)).toEqual([]);
    expect(migrationServiceProblems(goodCompose)).toEqual([]);
    expect(migrationConfinementProblems(goodCompose)).toEqual([]);
  });
  it.each([
    [
      'only one image reference',
      goodCompose.replace(/ {2}migrate:\n {4}image: [^\n]*\n/, '  migrate:\n'),
    ],
    [
      'a third image reference',
      goodCompose.replace(
        '\nnetworks:\n',
        '\n  sidecar:\n    image: busybox\nnetworks:\n',
      ),
    ],
    [
      'a tagged migrate image',
      goodCompose.replace(
        /@\$\{IMAGE_DIGEST[^}]*\}\n {4}command/,
        ':latest\n    command',
      ),
    ],
    [
      'a default instead of a refusal',
      goodCompose.replace('IMAGE_DIGEST:?', 'IMAGE_DIGEST:-'),
    ],
  ])('the image check fails a fixture with %s', (_name, text) => {
    expect(composeImagesProblems(text)).not.toEqual([]);
  });
  it.each([
    [
      'no migrate service',
      goodCompose.replace(/ {2}migrate:[\s\S]*?(?= {2}api:)/, ''),
    ],
    ['another command', goodCompose.replace('dist/migrate.js', 'dist/main.js')],
    [
      'another env_file',
      goodCompose.replace('env_file: .env', 'env_file: other.env'),
    ],
    [
      'another network',
      goodCompose.replace('networks: [platform_edge]', 'networks: [default]'),
    ],
    [
      'a restart policy',
      goodCompose.replace('restart: "no"', 'restart: on-failure'),
    ],
    [
      'a Traefik label',
      goodCompose.replace(
        '    networks: [platform_edge]',
        '    labels: [traefik.enable=true]\n    networks: [platform_edge]',
      ),
    ],
    [
      'the health check enabled',
      goodCompose.replace('      disable: true', '      disable: false'),
    ],
    [
      'api started without waiting',
      goodCompose.replace('service_completed_successfully', 'service_started'),
    ],
  ])('the migration service check fails a fixture with %s', (_name, text) => {
    expect(migrationServiceProblems(text)).not.toEqual([]);
  });
  it.each([
    [
      'a writable root',
      goodCompose.replace('read_only: true', 'read_only: false'),
    ],
    [
      'capabilities kept',
      goodCompose.replace('cap_drop: [ALL]', 'cap_drop: [NET_RAW]'),
    ],
    [
      'privileges escalable',
      goodCompose.replace('"no-new-privileges:true"', '"label:disable"'),
    ],
    [
      'a volume',
      goodCompose.replace(
        '    read_only: true',
        '    volumes: [./data:/data]\n    read_only: true',
      ),
    ],
  ])('the confinement check fails a fixture with %s', (_name, text) => {
    expect(migrationConfinementProblems(text)).not.toEqual([]);
  });

  const goodWorkflow = `
jobs:
  deliver:
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/deliver-api
        with:
          image-digest: \${{ needs.build.outputs.digest }}
          ${INPUT}: \${{ secrets.${SECRET} }}
`;
  it('the workflow check passes a well-formed fixture', () => {
    expect(workflowSecretProblems(goodWorkflow)).toEqual([]);
  });
  it.each([
    [
      'no password',
      goodWorkflow.replace(/ {10}database-password:[^\n]*\n/, ''),
    ],
    [
      'another secret',
      goodWorkflow.replace(`secrets.${SECRET}`, 'secrets.OTHER_PASSWORD'),
    ],
    ['a variable', goodWorkflow.replace(`secrets.${SECRET}`, `vars.${SECRET}`)],
    [
      'a further mention',
      `${goodWorkflow}      - run: echo "\${{ secrets.${SECRET} }}"\n`,
    ],
  ])('the workflow check fails a fixture with %s', (_name, text) => {
    expect(workflowSecretProblems(text)).not.toEqual([]);
  });

  const goodAction = `
inputs:
  image-digest:
    required: true
  ${INPUT}:
    required: true
runs:
  using: composite
  steps:
    - name: Refuse missing inputs
      shell: bash
      env:
        IMAGE_DIGEST: \${{ inputs.image-digest }}
        DATABASE_PASSWORD: \${{ inputs.${INPUT} }}
      run: |
        [ -n "$IMAGE_DIGEST" ] || { echo "::error::image-digest is required"; exit 1; }
        [ -n "$DATABASE_PASSWORD" ] || { echo "::error::database-password is required"; exit 1; }
    - name: Join the tailnet
      uses: tailscale/github-action@v3
    - name: Render
      shell: bash
      env:
        DATABASE_PASSWORD: \${{ inputs.${INPUT} }}
      run: node tools/delivery/src/render-env.ts
`;
  it('the action checks pass a well-formed fixture', () => {
    expect(actionPasswordProblems(goodAction)).toEqual([]);
    expect(firstStepRefusalProblems(goodAction)).toEqual([]);
  });
  it.each([
    ['no input', goodAction.replace(`  ${INPUT}:\n    required: true\n`, '')],
    [
      'the input in a run body',
      goodAction.replace(
        'run: node tools/delivery/src/render-env.ts',
        `run: DATABASE_PASSWORD='\${{ inputs.${INPUT} }}' node tools/delivery/src/render-env.ts`,
      ),
    ],
    [
      'the rendering without the env',
      goodAction.replace(
        / {6}env:\n {8}DATABASE_PASSWORD: [^\n]*\n {6}run: node/,
        '      run: node',
      ),
    ],
  ])('the action check fails a fixture with %s', (_name, text) => {
    expect(actionPasswordProblems(text)).not.toEqual([]);
  });
  it('the refusal check fails a first step that does not refuse an empty password', () => {
    const permissive = goodAction.replace(
      / {8}\[ -n "\$DATABASE_PASSWORD" \][^\n]*\n/,
      '',
    );
    expect(firstStepRefusalProblems(permissive)).not.toEqual([]);
  });
});

// --- The checks applied to the repository's files -------------------------

describe('the Compose file has no tag (api and migrate)', () => {
  it(`${COMPOSE} has exactly two image references, api and migrate, each the digest, failing when unset`, () => {
    expect(composeImagesProblems(read(COMPOSE))).toEqual([]);
  });
});

describe('the migration runs once before the API', () => {
  it(`${COMPOSE}'s migrate runs node dist/migrate.js once from .env on platform_edge, and api waits for it`, () => {
    expect(migrationServiceProblems(read(COMPOSE))).toEqual([]);
  });
});

describe('the migration service is confined like the API', () => {
  it(`${COMPOSE}'s migrate is read_only, drops ALL, sets no-new-privileges:true and declares no volume`, () => {
    expect(migrationConfinementProblems(read(COMPOSE))).toEqual([]);
  });
});

describe("both workflows pass the Environment's secret", () => {
  it.each([DEPLOY, PROMOTE])(
    `%s passes secrets.${SECRET} as the database password and mentions it nowhere else`,
    (path) => {
      expect(workflowSecretProblems(read(path))).toEqual([]);
    },
  );
});

describe('the password reaches the rendering through env', () => {
  it(`${ACTION} declares ${INPUT}, interpolates it in no run body, and passes it to the rendering as DATABASE_PASSWORD`, () => {
    expect(actionPasswordProblems(read(ACTION))).toEqual([]);
  });

  it(`${ACTION}'s first step refuses an empty ${INPUT}`, () => {
    expect(firstStepRefusalProblems(read(ACTION))).toEqual([]);
  });
});
