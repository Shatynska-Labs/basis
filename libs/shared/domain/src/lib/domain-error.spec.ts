// Derived from openspec/changes/add-api-cross-cutting-basics/specs/shared-domain/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md. This file runs once the `shared-domain` project
// exists at libs/shared/domain (task 3.1); until then no runner collects it.
// The type-level assertions in "only the four kinds type-check" are enforced
// by the `typecheck` target, not by the `test` target's runtime, as in
// libs/shared/core/src/lib/result.spec.ts.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../index.js';

const libraryRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/**
 * The runtime dependency names a package manifest declares: `dependencies`,
 * `peerDependencies` and `optionalDependencies`; `devDependencies` are not
 * shipped to consumers. Found in libs/shared/core/src/lib/result.spec.ts.
 */
const declaredRuntimeDependencies = (
  manifest: Record<string, unknown>,
): string[] =>
  ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap(
    (field) => {
      const declared = manifest[field];
      return declared && typeof declared === 'object'
        ? Object.keys(declared)
        : [];
    },
  );

/**
 * The module specifiers a TypeScript source imports or re-exports that are
 * neither relative nor a Node built-in: what would make it depend on a
 * workspace library or a third-party package.
 */
const nonRelativeImports = (source: string): string[] =>
  [
    ...source.matchAll(
      /(?:\bimport\b[^'"`]*?\bfrom\s*|\bexport\b[^'"`]*?\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"`]([^'"`]+)['"`]/g,
    ),
  ]
    .map((match) => match[1] ?? '')
    .filter(
      (specifier) =>
        !specifier.startsWith('.') && !specifier.startsWith('node:'),
    );

/** Non-spec TypeScript sources under a directory, recursively. */
const nonSpecSources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(ts|tsx|mts|cts)$/.test(entry.name) &&
        !/\.spec\.(ts|tsx)$/.test(entry.name),
    )
    .map((entry) => join(entry.parentPath, entry.name));

/** Nx's view of a project, through the Nx CLI. Found in libs/shared/infrastructure/src/project.spec.ts. */
const nxProject = (name: string): { tags?: string[] } => {
  const result = spawnSync(
    'pnpm',
    ['exec', 'nx', 'show', 'project', name, '--json'],
    {
      cwd: repoRoot,
      env: { ...process.env, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' },
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `nx show project ${name} exited ${result.status}: ${result.stderr}${result.stdout}`,
    );
  }
  const output = result.stdout;
  return JSON.parse(
    output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1),
  ) as { tags?: string[] };
};

class HabitNotFound extends DomainError {
  readonly kind = 'not-found' as const;
  readonly code = 'habit.not-found';
}

// ---------------------------------------------------------------------------

describe('shared-domain: a domain error carries a kind, a code and a message', () => {
  it('a subclass declares its kind and code', () => {
    const error = new HabitNotFound('No such habit.');

    expect(error.kind).toBe('not-found');
    expect(error.code).toBe('habit.not-found');
    expect(error.message).toBe('No such habit.');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).not.toBeInstanceOf(Error);
  });

  it.each(['not-found', 'conflict', 'rule-violated', 'forbidden'] as const)(
    'each of the four kinds is accepted: %s (specified by the requirement text)',
    (kind) => {
      class Example extends DomainError {
        readonly kind = kind;
        readonly code = 'habit.example';
      }

      expect(new Example('Example failure.').kind).toBe(kind);
    },
  );

  it('code and message are strings, and a domain error has no stack (derived from "not an instance of Error", design decision 6)', () => {
    const error = new HabitNotFound('No such habit.');

    expect(typeof error.code).toBe('string');
    expect(typeof error.message).toBe('string');
    expect('stack' in error).toBe(false);
  });
});

describe('shared-domain: the shared domain depends on nothing', () => {
  it('the shared domain is used without a framework', () => {
    // Usable: imported through the public entry point above, in a test with
    // no framework, database or network, and constructed.
    expect(new HabitNotFound('No such habit.')).toBeInstanceOf(DomainError);

    const manifest = JSON.parse(
      readFileSync(join(libraryRoot, 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(declaredRuntimeDependencies(manifest)).toEqual([]);

    expect(nxProject('shared-domain').tags).toEqual(
      expect.arrayContaining(['scope:shared', 'type:domain']),
    );
  }, 120_000);

  it('its sources import no other workspace library and no third-party package (specified by the requirement text)', () => {
    const sources = nonSpecSources(join(libraryRoot, 'src'));

    // Shows there are sources to check, so an empty finding is not vacuous.
    expect(sources.length).toBeGreaterThan(0);
    const found = sources.flatMap((file) =>
      nonRelativeImports(readFileSync(file, 'utf8')).map(
        (specifier) => `${file}: ${specifier}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('the dependency check detects a declared runtime dependency (fixture)', () => {
    expect(
      declaredRuntimeDependencies({ dependencies: { 'left-pad': '1.3.0' } }),
    ).toEqual(['left-pad']);
    expect(
      declaredRuntimeDependencies({ peerDependencies: { react: '19.0.0' } }),
    ).toEqual(['react']);
    expect(
      declaredRuntimeDependencies({
        optionalDependencies: { fsevents: '2.3.3' },
      }),
    ).toEqual(['fsevents']);
    expect(
      declaredRuntimeDependencies({ devDependencies: { vitest: '3.0.0' } }),
    ).toEqual([]);
  });

  it('the import check detects a workspace or third-party import (fixture)', () => {
    expect(
      nonRelativeImports(`import { failure } from '@basis/shared-core';\n`),
    ).toEqual(['@basis/shared-core']);
    expect(
      nonRelativeImports(`import type { Injectable } from '@nestjs/common';\n`),
    ).toEqual(['@nestjs/common']);
    expect(nonRelativeImports(`export * from 'zod';\n`)).toEqual(['zod']);
    expect(nonRelativeImports(`import 'reflect-metadata';\n`)).toEqual([
      'reflect-metadata',
    ]);
    expect(
      nonRelativeImports(`export const load = () => import('drizzle-orm');\n`),
    ).toEqual(['drizzle-orm']);
    expect(
      nonRelativeImports(
        `export { DomainError } from './lib/domain-error.js';\nimport { x } from '../y.js';\n`,
      ),
    ).toEqual([]);
  });
});
