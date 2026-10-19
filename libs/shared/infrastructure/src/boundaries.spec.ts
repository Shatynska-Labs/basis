// Derived from openspec/changes/share-the-database-connection/specs/shared-infrastructure/spec.md
// ("Only infrastructure libraries and the API depend on the shared
// infrastructure") before implementation. Provenance of each assertion is
// recorded in that change's test-plan.md. As in
// libs/shared/testing/src/boundaries.spec.ts (design decision 8), sample
// sources are linted through ESLint's Node API against the root
// `eslint.config.mjs`; they are virtual, given a path inside a real project and
// never written to disk. Where no project of a type exists (a context's
// libraries, the web and mobile apps), the computed constraint table is read
// for that type instead and evaluated against the library's tags, with the
// semantics of @nx/enforce-module-boundaries; that evaluator is itself run over
// fixture tables, so its verdicts are shown to discriminate.
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: `${repoRoot}eslint.config.mjs`,
});

const boundaryRule = '@nx/enforce-module-boundaries';

// The tags the requirement gives the library.
const SHARED_INFRASTRUCTURE = ['scope:shared', 'type:infrastructure'];

// A context scope. No context exists yet; `identity` is the first the roadmap
// names (proposal, Why). Unresolved project question 1 in test-plan.md.
const CONTEXT_SCOPE = 'scope:identity';

// The web and mobile apps do not exist yet. Their tags are assumed by analogy
// with `api` (`type:app`, `scope:api`). Unresolved project question 2.
const WEB_APP = ['type:app', 'scope:web'];
const MOBILE_APP = ['type:app', 'scope:mobile'];

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

const lintBoundaries = async (relativePath: string, source: string) => {
  const [result] = await eslint.lintText(source, {
    filePath: `${repoRoot}${relativePath}`,
  });
  return (result?.messages ?? []).filter(
    (message) => message.severity === 2 && message.ruleId === boundaryRule,
  );
};

interface DepConstraint {
  sourceTag?: string;
  allSourceTags?: string[];
  onlyDependOnLibsWithTags?: string[];
  notDependOnLibsWithTags?: string[];
}

/** @nx/enforce-module-boundaries' tag matching: `*`, `/regex/`, globs, equality. */
const hasTag = (tags: string[], pattern: string) => {
  if (pattern === '*') return true;
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    const regex = new RegExp(pattern.slice(1, -1));
    return tags.some((tag) => regex.test(tag));
  }
  if (pattern.includes('*')) {
    const regex = new RegExp(
      `^${pattern
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
    );
    return tags.some((tag) => regex.test(tag));
  }
  return tags.includes(pattern);
};

/**
 * Whether the constraints allow a project tagged `source` to depend directly on
 * one tagged `target`, as @nx/enforce-module-boundaries decides it: a source
 * no row applies to may depend on nothing; every applying row must accept the
 * target.
 */
const allows = (
  constraints: DepConstraint[],
  source: string[],
  target: string[],
) => {
  const applying = constraints.filter((row) =>
    row.allSourceTags
      ? row.allSourceTags.every((tag) => hasTag(source, tag))
      : row.sourceTag !== undefined && hasTag(source, row.sourceTag),
  );
  if (applying.length === 0) return false;
  return applying.every((row) => {
    const only = row.onlyDependOnLibsWithTags;
    if (only && only.length > 0 && !only.some((tag) => hasTag(target, tag)))
      return false;
    if (only && only.length === 0 && target.length > 0) return false;
    const not = row.notDependOnLibsWithTags ?? [];
    return !not.some((tag) => hasTag(target, tag));
  });
};

/** The boundary rule's constraint table, as computed for a non-spec source file. */
const constraintTable = async (): Promise<DepConstraint[]> => {
  const config = await eslint.calculateConfigForFile(
    `${repoRoot}libs/shared/core/src/lib/sample.ts`,
  );
  const options = config.rules?.[boundaryRule]?.[1] as
    { depConstraints?: DepConstraint[] } | undefined;
  return options?.depConstraints ?? [];
};

// ---------------------------------------------------------------------------

const importIt = `import { DATABASE } from '@basis/shared-infrastructure';\nexport const token = DATABASE;\n`;

describe('shared-infrastructure: an infrastructure library may import it', () => {
  it(`the constraints for type:infrastructure and a context scope (${CONTEXT_SCOPE}) allow a dependency on type:infrastructure and scope:shared`, async () => {
    const table = await constraintTable();

    // The premise: the table was read and has rows.
    expect(table.length).toBeGreaterThan(0);
    expect(
      allows(
        table,
        ['type:infrastructure', CONTEXT_SCOPE],
        SHARED_INFRASTRUCTURE,
      ),
    ).toBe(true);
  });
});

describe('shared-infrastructure: the API may import it', () => {
  it('a source file in apps/api importing @basis/shared-infrastructure is not reported', async () => {
    const errors = await lintBoundaries('apps/api/src/sample.ts', importIt);

    expect(errors).toEqual([]);
  });

  it('the constraints for the API project allow it (derived: shows the lint result is not merely an unresolved import)', async () => {
    // The lint above would also come back clean if the import resolved to no
    // workspace project; the table read here does not depend on resolution.
    const table = await constraintTable();

    expect(
      allows(table, ['type:app', 'scope:api'], SHARED_INFRASTRUCTURE),
    ).toBe(true);
  });
});

describe('shared-infrastructure: other layers may not import it', () => {
  it('a source file in a type:core library importing @basis/shared-infrastructure is reported', async () => {
    const errors = await lintBoundaries(
      'libs/shared/core/src/lib/sample.ts',
      importIt,
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    'type:domain',
    'type:application',
    'type:contracts',
    'type:util',
    'type:data-access',
  ])(
    `the constraints for %s (in ${CONTEXT_SCOPE}) do not allow a dependency on it`,
    async (type) => {
      const table = await constraintTable();

      expect(table.length).toBeGreaterThan(0);
      expect(allows(table, [type, CONTEXT_SCOPE], SHARED_INFRASTRUCTURE)).toBe(
        false,
      );
    },
  );

  it.each([
    ['the web app', WEB_APP],
    ['the mobile app', MOBILE_APP],
  ])(
    'the constraints for %s do not allow a dependency on it',
    async (_name, tags) => {
      const table = await constraintTable();

      expect(table.length).toBeGreaterThan(0);
      expect(allows(table, tags, SHARED_INFRASTRUCTURE)).toBe(false);
    },
  );
});

describe('shared-infrastructure: the constraint evaluator discriminates (fixture-driven)', () => {
  const target = SHARED_INFRASTRUCTURE;

  it('allows where every applying row accepts one of the target tags', () => {
    const table: DepConstraint[] = [
      {
        sourceTag: 'type:infrastructure',
        onlyDependOnLibsWithTags: ['type:infrastructure'],
      },
      { sourceTag: 'scope:*', onlyDependOnLibsWithTags: ['scope:shared'] },
    ];

    expect(
      allows(table, ['type:infrastructure', 'scope:identity'], target),
    ).toBe(true);
  });

  it('refuses where one applying row accepts none of the target tags', () => {
    const table: DepConstraint[] = [
      {
        sourceTag: 'type:infrastructure',
        onlyDependOnLibsWithTags: ['type:domain'],
      },
      {
        sourceTag: 'scope:identity',
        onlyDependOnLibsWithTags: ['scope:shared'],
      },
    ];

    expect(
      allows(table, ['type:infrastructure', 'scope:identity'], target),
    ).toBe(false);
  });

  it('refuses where a row forbids a target tag', () => {
    const table: DepConstraint[] = [
      { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
      {
        allSourceTags: ['type:app', 'scope:web'],
        notDependOnLibsWithTags: ['type:infrastructure'],
      },
    ];

    expect(allows(table, ['type:app', 'scope:web'], target)).toBe(false);
    expect(allows(table, ['type:app', 'scope:api'], target)).toBe(true);
  });

  it('refuses where no row applies to the source', () => {
    const table: DepConstraint[] = [
      { sourceTag: 'type:core', onlyDependOnLibsWithTags: ['*'] },
    ];

    expect(allows(table, ['type:domain', 'scope:identity'], target)).toBe(
      false,
    );
  });

  it('refuses where an applying row allows nothing', () => {
    const table: DepConstraint[] = [
      { sourceTag: '/^type:/', onlyDependOnLibsWithTags: [] },
    ];

    expect(allows(table, ['type:util', 'scope:identity'], target)).toBe(false);
  });
});
