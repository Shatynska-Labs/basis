// Derived from openspec/changes/add-api-cross-cutting-basics/specs/api-configuration/spec.md
// ("Only the configuration reads the API's environment") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md. The scenarios describe the repository ESLint configuration's
// behaviour, so each lints a sample source through ESLint's Node API with
// the configuration ESLint finds for the sample's path. Sample sources are virtual: they are given a path inside apps/api/src
// and are never written to disk.
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

// No config file is forced: ESLint looks it up from each sample's path, as
// `nx lint` and lint-staged do (changed after code review, which found the
// rule applied only when the root config was forced).
const eslint = new ESLint({ cwd: repoRoot });

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** The lint errors (severity 2) ESLint reports for `source` placed at `relativePath`. */
const lintErrors = async (relativePath: string, source: string) => {
  const [result] = await eslint.lintText(source, {
    filePath: `${repoRoot}${relativePath}`,
  });
  return (result?.messages ?? []).filter((message) => message.severity === 2);
};

// ---------------------------------------------------------------------------

const readsPortByIndex = `export const port = process.env['PORT'];\n`;

describe("api-configuration: only the configuration reads the API's environment", () => {
  it('reading the environment elsewhere is reported: process.env["PORT"] in apps/api/src/health/sample.ts', async () => {
    const errors = await lintErrors(
      'apps/api/src/health/sample.ts',
      readsPortByIndex,
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it('the configuration may read the environment: process.env["PORT"] in apps/api/src/config/sample.ts', async () => {
    const errors = await lintErrors(
      'apps/api/src/config/sample.ts',
      readsPortByIndex,
    );

    expect(errors).toEqual([]);
  });

  it.each([
    ['dot access', `export const port = process.env.PORT;\n`],
    [
      'destructuring',
      `const { PORT } = process.env;\nexport const port = PORT;\n`,
    ],
  ])(
    'reading the environment elsewhere by %s is reported too (derived from the requirement text "read process.env")',
    async (_form, source) => {
      const errors = await lintErrors('apps/api/src/health/sample.ts', source);

      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it('a source file at the root of apps/api/src reading it is reported (derived from the requirement text)', async () => {
    const errors = await lintErrors('apps/api/src/sample.ts', readsPortByIndex);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('the migration process may read it (specified by the requirement text: "other than ... the migration process")', async () => {
    const errors = await lintErrors(
      'apps/api/src/migrate.ts',
      readsPortByIndex,
    );

    expect(errors).toEqual([]);
  });

  it('a spec under apps/api/src may read it (derived from the requirement text "non-spec" and design decision 2)', async () => {
    const errors = await lintErrors(
      'apps/api/src/health/sample.spec.ts',
      readsPortByIndex,
    );

    expect(errors).toEqual([]);
  });

  it('a source file outside apps/api reading it is not reported by this restriction (derived: the requirement bounds itself to apps/api/src)', async () => {
    const errors = await lintErrors(
      'tools/delivery/src/sample.ts',
      readsPortByIndex,
    );

    expect(errors).toEqual([]);
  });

  it('the same file in apps/api/src without the read is clean (control: the errors above come from the read)', async () => {
    const errors = await lintErrors(
      'apps/api/src/health/sample.ts',
      `export const port = 3000;\n`,
    );

    expect(errors).toEqual([]);
  });
});
