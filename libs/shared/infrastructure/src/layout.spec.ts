// Derived from openspec/changes/share-the-database-connection/specs/shared-infrastructure/spec.md
// ("The shared infrastructure is split into driving and driven", scenario
// "The layout holds") before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md. The layout is checked by a function
// over a list of paths relative to `src/`; the function is run over the
// library's real files and, as fixture-driven discriminators, over lists this
// file supplies, so a pass over the real files is shown not to be vacuous.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('./', import.meta.url));

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const SPEC = /\.spec\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

/** Every file under `dir`, as POSIX paths relative to `dir`. */
const listFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'),
    );

/** Non-spec source files, relative to `src/`. */
const nonSpecSources = (files: string[]) =>
  files.filter((file) => SOURCE.test(file) && !SPEC.test(file));

/** Non-spec sources other than `index.ts` lying outside `driving/` and `driven/`. */
const misplaced = (files: string[]) =>
  nonSpecSources(files).filter(
    (file) =>
      file !== 'index.ts' &&
      !file.startsWith('driving/') &&
      !file.startsWith('driven/'),
  );

// ---------------------------------------------------------------------------

describe('shared-infrastructure: the layout holds', () => {
  it('every non-spec source file other than src/index.ts is under src/driving/ or src/driven/', () => {
    const sources = nonSpecSources(listFiles(srcDir));

    // The premise: the library has sources to check (src/index.ts at least).
    expect(sources).toContain('index.ts');
    expect(misplaced(sources)).toEqual([]);
  });

  it('DATABASE is defined in a file under src/driven/', async () => {
    const { DATABASE } = (await import('./index.js')) as { DATABASE?: unknown };
    expect(DATABASE).toBeDefined();

    const driven = nonSpecSources(listFiles(srcDir)).filter((file) =>
      file.startsWith('driven/'),
    );
    const definers: string[] = [];
    for (const file of driven) {
      const module = (await import(
        /* @vite-ignore */ `./${file.replace(SOURCE, '.js')}`
      )) as Record<string, unknown>;
      if (module['DATABASE'] === DATABASE) definers.push(file);
    }

    expect(definers.length).toBeGreaterThan(0);
  });

  it('DATABASE is a Symbol (derived from design decision 3)', async () => {
    const { DATABASE } = (await import('./index.js')) as { DATABASE?: unknown };

    expect(typeof DATABASE).toBe('symbol');
  });
});

describe('shared-infrastructure: the layout check discriminates (fixture-driven)', () => {
  it('accepts index.ts beside files under driving/ and driven/', () => {
    expect(
      misplaced(['index.ts', 'driven/database.ts', 'driving/http.ts']),
    ).toEqual([]);
  });

  it('reports a source file outside driving/ and driven/', () => {
    expect(
      misplaced(['index.ts', 'driven/database.ts', 'lib/database.ts', 'x.ts']),
    ).toEqual(['lib/database.ts', 'x.ts']);
  });

  it('a nested index.ts is not exempt: only src/index.ts is', () => {
    expect(misplaced(['index.ts', 'lib/index.ts'])).toEqual(['lib/index.ts']);
  });

  it('ignores spec files wherever they are', () => {
    expect(misplaced(['index.ts', 'layout.spec.ts', 'lib/x.spec.ts'])).toEqual(
      [],
    );
  });
});
