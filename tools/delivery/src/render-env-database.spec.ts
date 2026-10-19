// Derived from openspec/changes/add-persistence-skeleton/specs/api-delivery/spec.md
// ("The database URL is rendered from the target's database password", and
// the MODIFIED "Both hosts run the same image, by digest" as revised) before
// implementation. The command's input is `DATABASE_PASSWORD` (design decision
// 6, and the requirement's refusal names it); the function's input is
// assumed to be `databasePassword` beside the existing `target`, `baseDomain`
// and `imageDigest`, an unresolved project question in the change's
// test-plan.md, which also records the provenance of each assertion.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { renderEnv } from './render-env.ts';

const script = fileURLToPath(new URL('./render-env.ts', import.meta.url));

const DIGEST = `sha256:${'0123456789abcdef'.repeat(4)}`;
const BASE_DOMAIN = 'example.org';
const PASSWORD = 'n0t-a-real-pa55word';

const lineOf = (content: string, name: string) =>
  content.split('\n').filter((line) => line.startsWith(`${name}=`));

// Declared locally (see "Missing shared arrangement" in test-plan.md; the
// same helper is declared in render-env.spec.ts): runs the command in a fresh
// directory and returns its result, whether the `.env` it was pointed at
// exists afterwards, and what it wrote to its outputs.
const runCommand = (env: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'render-env-db-'));
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
        ...env,
      },
    });
    const written = existsSync(envFile);
    return {
      result,
      written,
      content: written ? readFileSync(envFile, 'utf8') : '',
      output: readFileSync(output, 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('a password is rendered into the URL', () => {
  it.each(['staging', 'production'])(
    'for %s, DATABASE_URL is exactly the URL with the password',
    (target) => {
      const { content } = renderEnv({
        target,
        baseDomain: BASE_DOMAIN,
        imageDigest: DIGEST,
        databasePassword: '3f9a0c',
      });

      expect(lineOf(content, 'DATABASE_URL')).toEqual([
        'DATABASE_URL="postgres://basis-api:3f9a0c@postgres:5432/basis-api"',
      ]);
    },
  );
});

describe('characters a URL would otherwise interpret', () => {
  it('the password is percent-encoded as a URL component', () => {
    const { content } = renderEnv({
      target: 'staging',
      baseDomain: BASE_DOMAIN,
      imageDigest: DIGEST,
      databasePassword: 'a@b:c/d%e',
    });

    expect(lineOf(content, 'DATABASE_URL')).toEqual([
      'DATABASE_URL="postgres://basis-api:a%40b%3Ac%2Fd%25e@postgres:5432/basis-api"',
    ]);
  });
});

describe('no password', () => {
  it('renderEnv throws naming DATABASE_PASSWORD for an empty password', () => {
    expect(() =>
      renderEnv({
        target: 'staging',
        baseDomain: BASE_DOMAIN,
        imageDigest: DIGEST,
        databasePassword: '',
      }),
    ).toThrow(/DATABASE_PASSWORD/);
  });

  it.each([
    ['empty', { DATABASE_PASSWORD: '' }],
    ['unset', {}],
  ] as const)(
    'the command fails naming DATABASE_PASSWORD and writes no .env when it is %s',
    (_case, env) => {
      const run = runCommand({
        TARGET: 'staging',
        BASE_DOMAIN,
        IMAGE_DIGEST: DIGEST,
        ...env,
      });

      expect(run.result.status).not.toBe(0);
      expect(`${run.result.stdout}${run.result.stderr}`).toContain(
        'DATABASE_PASSWORD',
      );
      expect(run.written).toBe(false);
    },
  );
});

describe('the password is not printed', () => {
  it('on success, neither stdout, stderr nor the outputs contain the password or DATABASE_URL', () => {
    const run = runCommand({
      TARGET: 'production',
      BASE_DOMAIN,
      IMAGE_DIGEST: DIGEST,
      DATABASE_PASSWORD: PASSWORD,
    });

    expect(run.result.status).toBe(0);
    // Shows the password was rendered, so its absence below is not vacuous.
    expect(run.content).toContain(PASSWORD);
    for (const text of [run.result.stdout, run.result.stderr, run.output]) {
      expect(text).not.toContain(PASSWORD);
      expect(text).not.toContain('DATABASE_URL');
    }
  });
});

// The MODIFIED "Both hosts run the same image, by digest", as revised: its
// rendering scenarios, with the database password the rendering now takes.

describe('the rendered environment names a digest (with a database password)', () => {
  it('holds IMAGE_DIGEST with exactly that value', () => {
    const { content } = renderEnv({
      target: 'staging',
      baseDomain: BASE_DOMAIN,
      imageDigest: DIGEST,
      databasePassword: '3f9a0c',
    });

    expect(lineOf(content, 'IMAGE_DIGEST')).toEqual([
      `IMAGE_DIGEST="${DIGEST}"`,
    ]);
  });
});

describe('a malformed digest is refused (with a database password)', () => {
  const malformed = ['', 'latest', `sha256:${'a'.repeat(63)}`];

  it.each(malformed)(
    'renderEnv throws naming IMAGE_DIGEST for "%s"',
    (imageDigest) => {
      expect(() =>
        renderEnv({
          target: 'staging',
          baseDomain: BASE_DOMAIN,
          imageDigest,
          databasePassword: '3f9a0c',
        }),
      ).toThrow(/IMAGE_DIGEST/);
    },
  );

  it.each(malformed)('the command writes no .env for "%s"', (imageDigest) => {
    const run = runCommand({
      TARGET: 'staging',
      BASE_DOMAIN,
      IMAGE_DIGEST: imageDigest,
      DATABASE_PASSWORD: '3f9a0c',
    });

    expect(run.result.status).not.toBe(0);
    expect(`${run.result.stdout}${run.result.stderr}`).toContain(
      'IMAGE_DIGEST',
    );
    expect(run.written).toBe(false);
  });
});
