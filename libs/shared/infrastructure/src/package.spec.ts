// Derived from openspec/changes/share-the-database-connection/specs/shared-infrastructure/spec.md
// ("The built API runs with the shared infrastructure", scenario "The
// library's package exposes compiled output") before implementation.
// Provenance of each assertion is recorded in that change's test-plan.md.
// The scenario reads the library's package.json, so this is a static check:
// the check is a function over a manifest, run over the real package.json and,
// as fixture-driven discriminators, over manifests this file supplies. That
// the targets resolve and run is shown by apps/api-e2e's
// shared-infrastructure.spec.ts, which executes them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageJsonPath = fileURLToPath(
  new URL('../package.json', import.meta.url),
);

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

interface Target {
  /** The condition path leading to the target, e.g. `. > import > types`. */
  path: string;
  target: string;
  /** True where a `types` condition selects the target. */
  isTypes: boolean;
}

/** Every string target of an `exports` field, with the conditions leading to it. */
const exportTargets = (exportsField: unknown): Target[] => {
  const walk = (node: unknown, path: string[], isTypes: boolean): Target[] => {
    if (typeof node === 'string')
      return [{ path: path.join(' > '), target: node, isTypes }];
    if (Array.isArray(node))
      return node.flatMap((item) => walk(item, path, isTypes));
    if (node !== null && typeof node === 'object')
      return Object.entries(node).flatMap(([key, value]) =>
        walk(value, [...path, key], isTypes || key === 'types'),
      );
    return [];
  };
  return walk(exportsField, [], false);
};

const JS = /\.(js|mjs|cjs)$/;
const DECLARATION = /\.d\.(ts|mts|cts)$/;
const underDist = (target: string) => target.startsWith('./dist/');

/**
 * The export targets that are not compiled output: a runtime target must be a
 * JavaScript file under `dist/`; a `types` target a declaration file under
 * `dist/`. No exports at all is itself a finding.
 */
const nonCompiledExports = (manifest: { exports?: unknown }): string[] => {
  const targets = exportTargets(manifest.exports);
  if (targets.length === 0) return ['(no exports)'];
  return targets
    .filter(({ target, isTypes }) =>
      isTypes
        ? !(underDist(target) && DECLARATION.test(target))
        : !(underDist(target) && JS.test(target)),
    )
    .map(({ path, target }) => `${path || '.'}: ${target}`);
};

// ---------------------------------------------------------------------------

const manifest = () =>
  JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: unknown;
    main?: unknown;
    types?: unknown;
    files?: unknown;
  };

describe("shared-infrastructure: the library's package exposes compiled output", () => {
  it('its exports resolve to JavaScript files under dist/, not to TypeScript sources', () => {
    expect(nonCompiledExports(manifest())).toEqual([]);
  });

  it('main and types point under dist/, and files lists dist (derived from design decision 5)', () => {
    const { main, types, files } = manifest();

    expect(main).toMatch(/^(\.\/)?dist\/.+\.(js|mjs|cjs)$/);
    expect(types).toMatch(/^(\.\/)?dist\/.+\.d\.(ts|mts|cts)$/);
    expect(files).toEqual(expect.arrayContaining(['dist']));
  });
});

describe('shared-infrastructure: the exports check discriminates (fixture-driven)', () => {
  it('accepts compiled output, with declarations under a types condition', () => {
    expect(
      nonCompiledExports({
        exports: {
          '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        },
      }),
    ).toEqual([]);
  });

  it('reports exports pointing at TypeScript sources, as every other workspace library has them', () => {
    expect(
      nonCompiledExports({
        exports: {
          '.': { types: './src/index.ts', default: './src/index.ts' },
        },
      }),
    ).toEqual(['. > types: ./src/index.ts', '. > default: ./src/index.ts']);
  });

  it('reports a string export pointing at a TypeScript source', () => {
    expect(nonCompiledExports({ exports: './src/index.ts' })).toEqual([
      '.: ./src/index.ts',
    ]);
  });

  it('reports a JavaScript file outside dist/', () => {
    expect(
      nonCompiledExports({ exports: { '.': { import: './lib/index.js' } } }),
    ).toEqual(['. > import: ./lib/index.js']);
  });

  it('reports a runtime condition pointing at a declaration file', () => {
    expect(
      nonCompiledExports({
        exports: { '.': { default: './dist/index.d.ts' } },
      }),
    ).toEqual(['. > default: ./dist/index.d.ts']);
  });

  it('reports a manifest with no exports', () => {
    expect(nonCompiledExports({})).toEqual(['(no exports)']);
  });
});
