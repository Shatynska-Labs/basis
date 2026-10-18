// Derived from openspec/changes/move-api-deploys-to-staging-with-promotion/specs/api-delivery/spec.md
// ("What Compose resolves is checked before delivery") before implementation,
// against the interface design decision 7 names:
// checkCompose({ config, routerRule, imageDigest }), `config` being the parsed
// output of `docker compose config --format json`. Provenance of each
// assertion is recorded in that change's test-plan.md.
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

// The shape `docker compose config --format json` prints: services keyed by
// name, labels as a map.
const resolved = ({
  image = IMAGE,
  // `null` leaves the rule label out; `undefined` takes the default.
  rule = RENDERED_RULE as string | null,
} = {}) => ({
  name: 'basis-api',
  services: {
    api: {
      image,
      labels: {
        'traefik.enable': 'true',
        ...(rule === null ? {} : { [RULE_LABEL]: rule }),
        'traefik.http.services.basis-api.loadbalancer.server.port': '3000',
      },
    },
  },
});

const reasonOf = (result: unknown) =>
  (result as { reason?: string }).reason ?? '';

describe('the resolved configuration matches', () => {
  it('passes', () => {
    expect(
      checkCompose({
        config: resolved(),
        routerRule: RENDERED_RULE,
        imageDigest: DIGEST,
      }),
    ).toEqual({ ok: true });
  });
});

describe('the resolved rule differs', () => {
  it.each([
    ['differs', RESOLVED_RULE],
    ['is absent', null],
  ])(
    'fails naming the router rule when the rule %s, printing neither rule',
    (_name, rule) => {
      const result = checkCompose({
        config: resolved({ rule }),
        routerRule: RENDERED_RULE,
        imageDigest: DIGEST,
      });
      expect(result).toMatchObject({ ok: false });
      const reason = reasonOf(result);
      expect(reason).toMatch(/rule/i);
      expect(reason).not.toContain(RENDERED_HOST);
      expect(reason).not.toContain(RESOLVED_HOST);
    },
  );
});

describe('the resolved image differs', () => {
  it.each([
    [
      'a tag',
      'ghcr.io/shatynska-labs/basis-api:0123456789abcdef0123456789abcdef01234567',
    ],
    ['another repository', `ghcr.io/someone-else/basis-api@${DIGEST}`],
    ['another digest', `ghcr.io/shatynska-labs/basis-api@${OTHER_DIGEST}`],
  ])('fails naming the image when it is %s', (_name, image) => {
    const result = checkCompose({
      config: resolved({ image }),
      routerRule: RENDERED_RULE,
      imageDigest: DIGEST,
    });
    expect(result).toMatchObject({ ok: false });
    const reason = reasonOf(result);
    expect(reason).toMatch(/image/i);
    expect(reason).not.toContain(image);
  });
});

describe('the check-compose command', () => {
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

  it('exits 0 when the resolved configuration matches', () => {
    expect(run(resolved()).status).toBe(0);
  });

  it('exits 1 on a differing rule, its output containing neither rule', () => {
    const result = run(resolved({ rule: RESOLVED_RULE }));
    expect(result.status).toBe(1);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toMatch(/rule/i);
    expect(output).not.toContain(RENDERED_HOST);
    expect(output).not.toContain(RESOLVED_HOST);
  });
});
