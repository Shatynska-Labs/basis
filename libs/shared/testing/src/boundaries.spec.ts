// Derived from openspec/changes/share-the-test-arrangement/specs/shared-testing/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md. The scenarios describe the repository ESLint
// configuration's behaviour, so each lints a sample source (design decision 7)
// through ESLint's Node API against the root `eslint.config.mjs`. Sample
// sources are virtual: they are given a path inside a real project and are
// never written to disk.
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: `${repoRoot}eslint.config.mjs`,
});

const boundaryRule = '@nx/enforce-module-boundaries';
const restrictionRule = 'no-restricted-imports';
const relevantRules = [boundaryRule, restrictionRule];

// Declared locally: the project has no shared test arrangement (see
// "Missing shared arrangement" in test-plan.md).
const lint = async (relativePath: string, source: string) => {
  const [result] = await eslint.lintText(source, {
    filePath: `${repoRoot}${relativePath}`,
  });
  return (result?.messages ?? []).filter(
    (message) =>
      message.severity === 2 &&
      message.ruleId !== null &&
      relevantRules.includes(message.ruleId),
  );
};

const importSharedTesting = `import { } from '@basis/shared-testing';\nexport const x = 1;\n`;

describe('Shared test arrangement: a spec may use it', () => {
  it.each([
    [
      'a spec in a type:core library',
      'libs/shared/core/src/lib/sample.spec.ts',
    ],
    ['a spec in an app', 'apps/api/src/sample.spec.ts'],
  ])('%s importing it is not reported', async (_name, path) => {
    const errors = await lint(path, importSharedTesting);

    expect(errors).toEqual([]);
  });

  it('a spec in a type:core library importing the shared-core entry stays clean (control)', async () => {
    // Control: shows the lint harness reports nothing for a legal import, so
    // the empty results above are not an artefact of the harness.
    const errors = await lint(
      'libs/shared/core/src/lib/sample.spec.ts',
      `import { } from '../index.js';\nexport const x = 1;\n`,
    );

    expect(errors).toEqual([]);
  });

  it.each([
    'type:core',
    'type:util',
    'type:contracts',
    'type:domain',
    'type:application',
    'type:infrastructure',
    'type:data-access',
    'type:app',
  ])(
    'the spec-file dependency constraints allow type:testing for %s',
    async (sourceTag) => {
      // No library of most of these types exists yet, so a sample file cannot
      // be placed in one; the constraint table is read instead (derived).
      const config = await eslint.calculateConfigForFile(
        `${repoRoot}libs/shared/core/src/lib/sample.spec.ts`,
      );
      const options = config.rules?.[boundaryRule]?.[1] as {
        depConstraints: {
          sourceTag?: string;
          allSourceTags?: string[];
          onlyDependOnLibsWithTags: string[];
        }[];
      };
      const rows = options.depConstraints.filter(
        (row) =>
          row.sourceTag === sourceTag || row.allSourceTags?.includes(sourceTag),
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.some((row) =>
          row.onlyDependOnLibsWithTags.includes('type:testing'),
        ),
      ).toBe(true);
    },
  );
});

describe('Shared test arrangement: production code cannot import it', () => {
  it.each([
    [
      'a non-spec source file in a library',
      'libs/shared/core/src/lib/sample.ts',
    ],
    ['a non-spec source file in an app', 'apps/api/src/sample.ts'],
  ])('%s importing it is an error', async (_name, path) => {
    const errors = await lint(path, importSharedTesting);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('the error comes from the file-level restriction (derived from design decision 3)', async () => {
    const errors = await lint(
      'libs/shared/core/src/lib/sample.ts',
      importSharedTesting,
    );

    expect(errors.map((error) => error.ruleId)).toContain(restrictionRule);
  });

  it('a file under a tests directory is test code', async () => {
    const errors = await lint(
      'libs/shared/core/tests/sample.ts',
      importSharedTesting,
    );

    expect(errors).toEqual([]);
  });

  it.each([
    'libs/shared/core/vitest.config.mts',
    'libs/shared/core/eslint.config.mjs',
  ])(
    'test and lint configuration %s may import it (derived from the requirement title and design decision 3)',
    async (path) => {
      const errors = await lint(path, importSharedTesting);

      expect(errors).toEqual([]);
    },
  );
});

describe('Shared test arrangement: it depends on no other workspace library', () => {
  it('a file in libs/shared/testing importing @basis/shared-core is a boundary violation', async () => {
    const errors = await lint(
      'libs/shared/testing/src/sample.ts',
      `import { } from '@basis/shared-core';\nexport const x = 1;\n`,
    );

    expect(errors.map((error) => error.ruleId)).toContain(boundaryRule);
  });

  it('a spec in libs/shared/testing importing @basis/shared-core is a boundary violation', async () => {
    const errors = await lint(
      'libs/shared/testing/src/sample.spec.ts',
      `import { } from '@basis/shared-core';\nexport const x = 1;\n`,
    );

    expect(errors.map((error) => error.ruleId)).toContain(boundaryRule);
  });

  it('a file in libs/shared/testing importing nothing from the workspace is clean (control)', async () => {
    const errors = await lint(
      'libs/shared/testing/src/sample.ts',
      `export const x = 1;\n`,
    );

    expect(errors).toEqual([]);
  });
});
