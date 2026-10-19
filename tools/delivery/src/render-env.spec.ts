// Derived from openspec/changes/move-api-deploys-to-staging-with-promotion/specs/api-delivery/spec.md
// ("Both hosts run the same image, by digest", "The address is built from the
// server and the base domain", "Rendered values reach Compose unchanged")
// before implementation, against the interface design decision 7 names:
// renderLine(name, value) and renderEnv({ target, baseDomain, imageDigest }).
// Provenance of each assertion is recorded in that change's test-plan.md.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { renderEnv, renderLine } from './render-env.ts';

const script = fileURLToPath(new URL('./render-env.ts', import.meta.url));

const DIGEST = `sha256:${'0123456789abcdef'.repeat(4)}`;
const BASE_DOMAIN = 'example.org';
// Rendering requires a database password since add-persistence-skeleton; these
// tests pass one and assert nothing about it (see that change's test-plan.md).
const DATABASE_PASSWORD = '3f9a0c';

const STAGING_RULE = 'Host(`basis-api.main-staging.example.org`)';
const PRODUCTION_RULE =
  'Host(`basis-api.main-production.example.org`) || Host(`api.basis.example.org`)';

const lineOf = (content: string, name: string) =>
  content.split('\n').filter((line) => line.startsWith(`${name}=`));

// Runs the command in a fresh directory; returns its result and whether the
// `.env` it was pointed at exists afterwards.
const runCommand = (env: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'render-env-'));
  try {
    const envFile = join(dir, '.env');
    const output = join(dir, 'github-output');
    writeFileSync(output, '');
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      timeout: 10_000,
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        ENV_FILE: envFile,
        GITHUB_OUTPUT: output,
        DATABASE_PASSWORD,
        ...env,
      },
    });
    const written = existsSync(envFile);
    return {
      result,
      written,
      content: written ? readFileSync(envFile, 'utf8') : '',
      mode: written ? statSync(envFile).mode & 0o777 : undefined,
      output: readFileSync(output, 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('the rendered environment names a digest', () => {
  it('holds IMAGE_DIGEST with exactly that value', () => {
    const { content } = renderEnv({
      target: 'staging',
      baseDomain: BASE_DOMAIN,
      imageDigest: DIGEST,
      databasePassword: DATABASE_PASSWORD,
    });
    expect(lineOf(content, 'IMAGE_DIGEST')).toEqual([
      `IMAGE_DIGEST="${DIGEST}"`,
    ]);
  });
});

describe('a malformed digest is refused', () => {
  const malformed = ['', 'latest', `sha256:${'a'.repeat(63)}`];

  it.each(malformed)(
    'renderEnv throws naming IMAGE_DIGEST for "%s"',
    (imageDigest) => {
      expect(() =>
        renderEnv({
          target: 'staging',
          baseDomain: BASE_DOMAIN,
          imageDigest,
          databasePassword: DATABASE_PASSWORD,
        }),
      ).toThrow(/IMAGE_DIGEST/);
    },
  );

  it.each(malformed)('the command writes no .env for "%s"', (imageDigest) => {
    const run = runCommand({
      TARGET: 'staging',
      BASE_DOMAIN,
      IMAGE_DIGEST: imageDigest,
    });
    expect(run.result.status).not.toBe(0);
    expect(`${run.result.stdout}${run.result.stderr}`).toContain(
      'IMAGE_DIGEST',
    );
    expect(run.written).toBe(false);
  });
});

describe("staging's rule", () => {
  it('routes the staging technical hostname only', () => {
    const { content, technicalHostname } = renderEnv({
      target: 'staging',
      baseDomain: BASE_DOMAIN,
      imageDigest: DIGEST,
      databasePassword: DATABASE_PASSWORD,
    });
    expect(lineOf(content, 'ROUTER_RULE')).toEqual([
      `ROUTER_RULE="${STAGING_RULE}"`,
    ]);
    expect(technicalHostname).toBe('basis-api.main-staging.example.org');
  });
});

describe("production's rule", () => {
  it('routes the production technical hostname and the alias', () => {
    const { content, technicalHostname } = renderEnv({
      target: 'production',
      baseDomain: BASE_DOMAIN,
      imageDigest: DIGEST,
      databasePassword: DATABASE_PASSWORD,
    });
    expect(lineOf(content, 'ROUTER_RULE')).toEqual([
      `ROUTER_RULE="${PRODUCTION_RULE}"`,
    ]);
    expect(technicalHostname).toBe('basis-api.main-production.example.org');
  });
});

describe('a missing or malformed base domain', () => {
  const malformed = ['', 'localhost', 'Example.org', 'example..org'];

  it.each(malformed)(
    'renderEnv throws naming BASE_DOMAIN for "%s"',
    (baseDomain) => {
      expect(() =>
        renderEnv({
          target: 'production',
          baseDomain,
          imageDigest: DIGEST,
          databasePassword: DATABASE_PASSWORD,
        }),
      ).toThrow(/BASE_DOMAIN/);
    },
  );

  it.each(malformed)('the command writes no .env for "%s"', (baseDomain) => {
    const run = runCommand({
      TARGET: 'production',
      BASE_DOMAIN: baseDomain,
      IMAGE_DIGEST: DIGEST,
    });
    expect(run.result.status).not.toBe(0);
    expect(`${run.result.stdout}${run.result.stderr}`).toContain('BASE_DOMAIN');
    expect(run.written).toBe(false);
  });
});

describe('an unknown target', () => {
  it('renderEnv throws naming the target', () => {
    expect(() =>
      renderEnv({
        target: 'preview',
        baseDomain: BASE_DOMAIN,
        imageDigest: DIGEST,
        databasePassword: DATABASE_PASSWORD,
      }),
    ).toThrow(/target|preview/i);
  });
});

describe('characters Compose would otherwise interpret', () => {
  it.each([
    ['a"b', 'NAME="a\\"b"'],
    ['c\\d', 'NAME="c\\\\d"'],
    ['e$f', 'NAME="e$$f"'],
    ['g`h', 'NAME="g`h"'],
    // The order the requirement states: `\` first, then `"`, then `$`.
    ['\\"$', 'NAME="\\\\\\"$$"'],
  ])('renders %s as %s', (value, line) => {
    expect(renderLine('NAME', value)).toBe(line);
  });
});

describe('the command, on success', () => {
  it('writes the rendered .env with mode 0600 and reports the hostname and rule', () => {
    const run = runCommand({
      TARGET: 'production',
      BASE_DOMAIN,
      IMAGE_DIGEST: DIGEST,
    });
    expect(run.result.status).toBe(0);
    expect(run.written).toBe(true);
    expect(run.content).toBe(
      renderEnv({
        target: 'production',
        baseDomain: BASE_DOMAIN,
        imageDigest: DIGEST,
        databasePassword: DATABASE_PASSWORD,
      }).content,
    );
    expect(run.content.endsWith('\n')).toBe(true);
    expect(run.mode).toBe(0o600);
    const outputLines = run.output.split('\n');
    expect(outputLines).toContain(
      'technical-hostname=basis-api.main-production.example.org',
    );
    expect(outputLines).toContain(`router-rule=${PRODUCTION_RULE}`);
  });
});
