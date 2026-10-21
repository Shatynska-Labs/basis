// add-identity-authentication design decision 5: a driving adapter reaches a
// driven one only through the application (ADR-0012 §1). Virtual sources are
// linted through ESLint's Node API, as `nx lint` and lint-staged lint them:
// through the library's own configuration, from the library's directory, and
// through the root configuration from the repository's root.
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const libraryRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

const RULE = 'no-restricted-imports';

const linters = {
  "the library's own configuration": new ESLint({
    cwd: libraryRoot,
    overrideConfigFile: `${libraryRoot}eslint.config.mjs`,
  }),
  'the root configuration': new ESLint({
    cwd: repoRoot,
    overrideConfigFile: `${repoRoot}eslint.config.mjs`,
  }),
};

const restrictedImports = async (
  eslint: ESLint,
  file: string,
  source: string,
) => {
  const [result] = await eslint.lintText(source, {
    filePath: `${libraryRoot}${file}`,
  });
  return (result?.messages ?? []).filter((message) => message.ruleId === RULE);
};

const importDriven = `import { users } from '../driven/schema.js';\nexport const x = users;\n`;
const importApplication = `import { Clock } from '@basis/identity-application';\nexport const x = Clock;\n`;
const importSharedTesting = `import { freshDatabase } from '@basis/shared-testing';\nexport const x = freshDatabase;\n`;

describe.each(Object.entries(linters))(
  'a driving adapter does not import a driven one, through %s',
  (_name, eslint) => {
    it('a driving file importing from driven/ is reported', async () => {
      expect(
        await restrictedImports(eslint, 'src/driving/sample.ts', importDriven),
      ).toHaveLength(1);
    });

    it('a driving spec importing from driven/ is reported', async () => {
      expect(
        await restrictedImports(
          eslint,
          'src/driving/sample.spec.ts',
          importDriven,
        ),
      ).toHaveLength(1);
    });

    it('a driving file importing the application is not reported (control)', async () => {
      expect(
        await restrictedImports(
          eslint,
          'src/driving/sample.ts',
          importApplication,
        ),
      ).toEqual([]);
    });

    it('the composition root importing from driven/ is not reported', async () => {
      expect(
        await restrictedImports(eslint, 'src/sample.module.ts', importDriven),
      ).toEqual([]);
    });

    it('a driving file still may not import the shared test arrangement', async () => {
      expect(
        await restrictedImports(
          eslint,
          'src/driving/sample.ts',
          importSharedTesting,
        ),
      ).toHaveLength(1);
    });

    it('a driving spec may import the shared test arrangement', async () => {
      expect(
        await restrictedImports(
          eslint,
          'src/driving/sample.spec.ts',
          importSharedTesting,
        ),
      ).toEqual([]);
    });
  },
);
