// Derived from openspec/changes/add-persistence-skeleton/specs/api-delivery/spec.md
// (the MODIFIED "What Compose resolves is checked before delivery", as
// revised) before implementation, against the existing interface
// checkCompose({ config, routerRule, imageDigest }), `config` being the parsed
// output of `docker compose config --format json`, which design decision 7
// keeps. Provenance of each assertion is recorded in the change's test-plan.md.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkCompose } from './check-compose.ts';

const script = fileURLToPath(new URL('./check-compose.ts', import.meta.url));

const DIGEST = `sha256:${'0123456789abcdef'.repeat(4)}`;
const OTHER_DIGEST = `sha256:${'fedcba9876543210'.repeat(4)}`;
const IMAGE = `ghcr.io/shatynska-labs/basis-api@${DIGEST}`;
const RENDERED_HOST = 'basis-api.main-staging.example.org';
const RESOLVED_HOST = 'resolved-elsewhere.example.net';
const RENDERED_RULE = `Host(\`${RENDERED_HOST}\`)`;
const RESOLVED_RULE = `Host(\`${RESOLVED_HOST}\`)`;
const RULE_LABEL = 'traefik.http.routers.basis-api.rule';

const DIFFERING_IMAGES = [
  [
    'a tag',
    'ghcr.io/shatynska-labs/basis-api:0123456789abcdef0123456789abcdef01234567',
  ],
  ['another repository', `ghcr.io/someone-else/basis-api@${DIGEST}`],
  ['another digest', `ghcr.io/shatynska-labs/basis-api@${OTHER_DIGEST}`],
] as const;

const ABSENT = Symbol('absent');

// Declared locally (see "Missing shared arrangement" in test-plan.md; a
// narrower builder is declared in check-compose.spec.ts): the shape `docker
// compose config --format json` prints, with `api` and, unless left out,
// `migrate`.
const resolved = ({
  image = IMAGE as string,
  rule = RENDERED_RULE as string | null,
  migrate = IMAGE as string | typeof ABSENT | null,
  extra = {} as Record<string, unknown>,
} = {}) => ({
  name: 'basis-api',
  services: {
    api: {
      image,
      depends_on:
        migrate === null
          ? undefined
          : { migrate: { condition: 'service_completed_successfully' } },
      labels: {
        'traefik.enable': 'true',
        ...(rule === null ? {} : { [RULE_LABEL]: rule }),
        'traefik.http.services.basis-api.loadbalancer.server.port': '3000',
      },
    },
    // `null` leaves the service out; ABSENT declares it without an image.
    ...(migrate === null
      ? {}
      : {
          migrate: {
            ...(migrate === ABSENT ? {} : { image: migrate }),
            command: ['node', 'dist/migrate.js'],
            restart: 'no',
          },
        }),
    ...extra,
  },
});

const check = (config: unknown) =>
  checkCompose({ config, routerRule: RENDERED_RULE, imageDigest: DIGEST });

const reasonOf = (result: unknown) =>
  (result as { reason?: string }).reason ?? '';

describe('the resolved configuration matches (api and migrate)', () => {
  it('passes', () => {
    expect(check(resolved())).toEqual({ ok: true });
  });
});

describe('a Compose file from before migrations were delivered', () => {
  it('passes a configuration declaring only api, whose image and rule match', () => {
    expect(check(resolved({ migrate: null }))).toEqual({ ok: true });
  });
});

describe('the resolved rule differs (with migrate declared)', () => {
  it.each([
    ['differs', RESOLVED_RULE],
    ['is absent', null],
  ])(
    'fails naming the router rule when the rule %s, printing neither rule',
    (_name, rule) => {
      const result = check(resolved({ rule }));

      expect(result).toMatchObject({ ok: false });
      const reason = reasonOf(result);
      expect(reason).toMatch(/rule/i);
      expect(reason).not.toContain(RENDERED_HOST);
      expect(reason).not.toContain(RESOLVED_HOST);
    },
  );
});

describe("the resolved image differs (api's, with migrate declared)", () => {
  it.each(DIFFERING_IMAGES)(
    'fails naming the image when it is %s',
    (_name, image) => {
      const result = check(resolved({ image }));

      expect(result).toMatchObject({ ok: false });
      const reason = reasonOf(result);
      expect(reason).toMatch(/image/i);
      expect(reason).not.toContain(image);
    },
  );
});

describe('the resolved migration image differs', () => {
  it.each([['absent', ABSENT] as const, ...DIFFERING_IMAGES])(
    "fails naming the service migrate's image when it is %s",
    (_name, image) => {
      const result = check(resolved({ migrate: image }));

      expect(result).toMatchObject({ ok: false });
      const reason = reasonOf(result);
      expect(reason).toMatch(/migrate/);
      expect(reason).toMatch(/image/i);
      if (typeof image === 'string') expect(reason).not.toContain(image);
    },
  );
});

describe('every other declared service', () => {
  it('fails when a further service resolves to another image', () => {
    const result = check(
      resolved({ extra: { sidecar: { image: 'busybox:latest' } } }),
    );

    expect(result).toMatchObject({ ok: false });
    expect(reasonOf(result)).toMatch(/image/i);
    expect(reasonOf(result)).not.toContain('busybox:latest');
  });
});

describe('the check-compose command (with migrate declared)', () => {
  const run = (config: unknown) =>
    spawnSync(process.execPath, [script], {
      input: JSON.stringify(config),
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        ROUTER_RULE: RENDERED_RULE,
        IMAGE_DIGEST: DIGEST,
      },
    });

  it('exits 0 when api and migrate match', () => {
    expect(run(resolved()).status).toBe(0);
  });

  it("exits 1 on a differing migrate image, naming migrate's image and printing no value", () => {
    const other = `ghcr.io/shatynska-labs/basis-api@${OTHER_DIGEST}`;
    const result = run(resolved({ migrate: other }));

    expect(result.status).toBe(1);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toMatch(/migrate/);
    expect(output).toMatch(/image/i);
    expect(output).not.toContain(other);
    expect(output).not.toContain(OTHER_DIGEST);
  });
});
