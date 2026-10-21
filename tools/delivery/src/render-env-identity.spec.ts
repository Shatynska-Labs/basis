// Derived from openspec/changes/add-identity-authentication/specs/api-delivery/spec.md
// ("The Google client IDs are rendered from the Environment", "The sign-up
// allowlist is rendered from the Environment's secret": the rendering
// scenarios) before implementation. Provenance of each assertion is recorded
// in that change's test-plan.md.
//
// The command's inputs are `GOOGLE_CLIENT_IDS` and `SIGNUP_ALLOWED_EMAILS`,
// the names under which the requirement has them reach the rendering step's
// `env:`. The function's inputs are assumed to be `googleClientIds` and
// `signupAllowedEmails`, strings, beside the existing `target`, `baseDomain`,
// `imageDigest` and `databasePassword` (an unresolved project question in
// test-plan.md).
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
const DATABASE_PASSWORD = '3f9a0c';
const CLIENT_IDS =
  '1-web.apps.googleusercontent.com,2-android.apps.googleusercontent.com';

const lineOf = (content: string, name: string) =>
  content.split('\n').filter((line) => line.startsWith(`${name}=`));

/** Every input the rendering takes, valid, overridable one by one. */
const inputs = (
  overrides: Partial<{
    googleClientIds: string;
    signupAllowedEmails: string;
  }> = {},
) => ({
  target: 'staging',
  baseDomain: BASE_DOMAIN,
  imageDigest: DIGEST,
  databasePassword: DATABASE_PASSWORD,
  googleClientIds: CLIENT_IDS,
  signupAllowedEmails: 'ann@example.org',
  ...overrides,
});

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/**
 * Runs the command in a fresh directory with every required input valid,
 * `env` laid over them (a value of `undefined` unsets one), and returns its
 * result, whether the `.env` it was pointed at exists afterwards, and what it
 * wrote to its outputs. Found in render-env.spec.ts and
 * render-env-database.spec.ts.
 */
const runCommand = (env: Record<string, string | undefined>) => {
  const dir = mkdtempSync(join(tmpdir(), 'render-env-identity-'));
  try {
    const envFile = join(dir, '.env');
    const output = join(dir, 'github-output');
    writeFileSync(output, '');
    const merged: Record<string, string | undefined> = {
      PATH: process.env.PATH,
      ENV_FILE: envFile,
      GITHUB_OUTPUT: output,
      TARGET: 'production',
      BASE_DOMAIN,
      IMAGE_DIGEST: DIGEST,
      DATABASE_PASSWORD,
      GOOGLE_CLIENT_IDS: CLIENT_IDS,
      SIGNUP_ALLOWED_EMAILS: 'ann@example.org',
      ...env,
    };
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      timeout: 10_000,
      cwd: dir,
      env: Object.fromEntries(
        Object.entries(merged).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
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

// ---------------------------------------------------------------------------

describe('the Google client IDs are rendered from the Environment', () => {
  it('the client IDs are rendered', () => {
    const { content } = renderEnv(inputs());

    expect(lineOf(content, 'GOOGLE_CLIENT_IDS')).toEqual([
      `GOOGLE_CLIENT_IDS="${CLIENT_IDS}"`,
    ]);
  });

  it('the command writes them to .env unchanged (specified by the requirement text "the rendered .env SHALL hold them unchanged")', () => {
    const run = runCommand({});

    expect(run.result.status, run.result.stderr).toBe(0);
    expect(lineOf(run.content, 'GOOGLE_CLIENT_IDS')).toEqual([
      `GOOGLE_CLIENT_IDS="${CLIENT_IDS}"`,
    ]);
  });

  it('client IDs with blanks are held unchanged, not normalised (specified by the requirement text "unchanged")', () => {
    const { content } = renderEnv(
      inputs({ googleClientIds: ' 1-web.apps.googleusercontent.com, ' }),
    );

    expect(lineOf(content, 'GOOGLE_CLIENT_IDS')).toEqual([
      'GOOGLE_CLIENT_IDS=" 1-web.apps.googleusercontent.com, "',
    ]);
  });

  describe('no client IDs', () => {
    it.each(['', ' ', ' , '])(
      'renderEnv throws naming GOOGLE_CLIENT_IDS for %j',
      (googleClientIds) => {
        expect(() => renderEnv(inputs({ googleClientIds }))).toThrow(
          /GOOGLE_CLIENT_IDS/,
        );
      },
    );

    it.each([
      ['empty', ''],
      ['" "', ' '],
      ['" , "', ' , '],
      [
        'unset (derived: GitHub renders an absent variable as empty)',
        undefined,
      ],
    ] as const)(
      'the command fails naming GOOGLE_CLIENT_IDS and writes no .env: %s',
      (_case, value) => {
        const run = runCommand({ GOOGLE_CLIENT_IDS: value });

        expect(run.result.status).not.toBe(0);
        expect(`${run.result.stdout}${run.result.stderr}`).toContain(
          'GOOGLE_CLIENT_IDS',
        );
        expect(run.written).toBe(false);
      },
    );
  });
});

describe("the sign-up allowlist is rendered from the Environment's secret", () => {
  it('the allowlist is rendered', () => {
    const { content } = renderEnv(
      inputs({ signupAllowedEmails: 'ann@example.org,bob@example.org' }),
    );

    expect(lineOf(content, 'SIGNUP_ALLOWED_EMAILS')).toEqual([
      'SIGNUP_ALLOWED_EMAILS="ann@example.org,bob@example.org"',
    ]);
  });

  it('an empty allowlist', () => {
    const { content } = renderEnv(inputs({ signupAllowedEmails: '' }));

    expect(lineOf(content, 'SIGNUP_ALLOWED_EMAILS')).toEqual([
      'SIGNUP_ALLOWED_EMAILS=""',
    ]);
  });

  it('the command succeeds with an empty allowlist and writes the empty line (specified by "It MAY be empty")', () => {
    const run = runCommand({ SIGNUP_ALLOWED_EMAILS: '' });

    expect(run.result.status, run.result.stderr).toBe(0);
    expect(lineOf(run.content, 'SIGNUP_ALLOWED_EMAILS')).toEqual([
      'SIGNUP_ALLOWED_EMAILS=""',
    ]);
  });

  it('the allowlist is not printed', () => {
    const secret = 'n0t-a-real@example.org';

    const run = runCommand({ SIGNUP_ALLOWED_EMAILS: secret });

    expect(run.result.status, run.result.stderr).toBe(0);
    // Shows the allowlist was rendered, so its absence below is not vacuous.
    expect(run.content).toContain(secret);
    for (const text of [run.result.stdout, run.result.stderr, run.output]) {
      expect(text).not.toContain(secret);
    }
  });
});
