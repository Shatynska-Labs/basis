import { fileURLToPath } from 'node:url';

import { includeIgnoreFile } from '@eslint/compat';
import nx from '@nx/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

// ADR-0012 §7, "every framework, ORM, database, queue, HTTP and SDK package",
// enumerated once (scaffold-workspace design decision 3). A package of one of
// those classes is added here by the change that introduces it.
const frameworkAndSdkPackages = [
  '@nestjs/*',
  'drizzle-orm',
  'drizzle-kit',
  'pg',
  'postgres',
  'ioredis',
  'redis',
  'bullmq',
  '@langchain/*',
  'langfuse',
  'langfuse-*',
  'express',
  'fastify',
  'axios',
  'undici',
  'react',
  'react-dom',
  'react-native',
  'expo',
  'expo-*',
  '@aws-sdk/*',
  'openai',
  '@anthropic-ai/*',
  '@google/*',
  // add-identity-authentication design decision 13: it fetches Google's keys.
  'jose',
];

const contexts = [
  'habits',
  'stake',
  'metrics',
  'nutrition',
  'insights',
  'results',
  'sharing',
  'identity',
  'notifications',
];

const serverLibraries = [
  'type:core',
  'type:util',
  'type:contracts',
  'type:domain',
  'type:application',
  'type:infrastructure',
  'type:data-access',
  'type:testing',
];

// The tag table of ADR-0012 §7, extended with `type:tooling` and
// `scope:tooling` (design decision 11). Nothing may depend on `type:tooling`:
// no row below names it. `withExternalImports: false` gives the same tag
// constraints without the external-import bans, for test and configuration
// files (design decision 3).
const depConstraints = ({ withExternalImports }) => {
  const external = (rule) => (withExternalImports ? rule : {});
  return [
    {
      sourceTag: 'type:core',
      onlyDependOnLibsWithTags: ['type:testing'],
      ...external({ bannedExternalImports: ['*'] }),
    },
    {
      sourceTag: 'type:util',
      onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:testing'],
      ...external({ bannedExternalImports: frameworkAndSdkPackages }),
    },
    {
      sourceTag: 'type:contracts',
      onlyDependOnLibsWithTags: [
        'type:contracts',
        'type:core',
        'type:util',
        'type:testing',
      ],
      ...external({ allowedExternalImports: ['zod'] }),
    },
    {
      sourceTag: 'type:domain',
      onlyDependOnLibsWithTags: [
        'type:domain',
        'type:core',
        'type:util',
        'type:testing',
      ],
      ...external({ bannedExternalImports: frameworkAndSdkPackages }),
    },
    {
      sourceTag: 'type:application',
      onlyDependOnLibsWithTags: [
        'type:domain',
        'type:contracts',
        'type:core',
        'type:util',
        'type:testing',
      ],
      // Nx tests the banned list before the allowed one, and an allowed list
      // admits nothing else, so the exception is written into the ban: every
      // `@nestjs/*` package but `common` and `cqrs` (ADR-0012 §7). Nx turns
      // each `*` into `.*` and keeps the rest as a regular expression.
      ...external({
        bannedExternalImports: [
          ...frameworkAndSdkPackages.filter((name) => name !== '@nestjs/*'),
          '@nestjs/(?!(common|cqrs)(/|$))*',
        ],
      }),
    },
    // With the scope rows, a context's infrastructure reaches only the shared
    // infrastructure (share-the-database-connection design decision 7).
    {
      sourceTag: 'type:infrastructure',
      onlyDependOnLibsWithTags: [
        'type:infrastructure',
        'type:application',
        'type:domain',
        'type:contracts',
        'type:core',
        'type:util',
        'type:testing',
      ],
    },
    {
      sourceTag: 'type:data-access',
      onlyDependOnLibsWithTags: [
        'type:contracts',
        'type:core',
        'type:util',
        'type:testing',
      ],
    },
    // Test arrangement depends on no other workspace library, or a spec in any
    // library importing it would close a project cycle.
    { sourceTag: 'type:testing', onlyDependOnLibsWithTags: [] },
    {
      sourceTag: 'type:tooling',
      onlyDependOnLibsWithTags: [],
      ...external({ bannedExternalImports: ['*'] }),
    },
    // A context reaches its own scope, the shared kernel, and only the
    // contracts of other contexts.
    ...contexts.map((context) => ({
      sourceTag: `scope:${context}`,
      onlyDependOnLibsWithTags: [
        `scope:${context}`,
        'scope:shared',
        'type:contracts',
      ],
    })),
    // The shared kernel reaches only itself; `shared/api-client`
    // (`type:data-access`) may also reach the contracts of any scope.
    {
      sourceTag: 'scope:shared',
      onlyDependOnLibsWithTags: ['scope:shared', 'type:contracts'],
    },
    {
      allSourceTags: ['scope:shared', 'type:contracts'],
      onlyDependOnLibsWithTags: ['scope:shared'],
    },
    { sourceTag: 'scope:tooling', onlyDependOnLibsWithTags: [] },
    // Apps carry `type:app` and their own scope.
    {
      allSourceTags: ['type:app', 'scope:api'],
      onlyDependOnLibsWithTags: serverLibraries,
    },
    ...['web', 'mobile'].flatMap((app) => [
      {
        allSourceTags: ['type:app', `scope:${app}`],
        onlyDependOnLibsWithTags: [
          'type:contracts',
          'type:data-access',
          'type:core',
          'type:util',
          'type:domain',
          'type:testing',
        ],
      },
      // Of the domain libraries, only the shared kernel's.
      {
        allSourceTags: ['type:app', `scope:${app}`],
        onlyDependOnLibsWithTags: ['scope:shared', 'type:contracts'],
      },
    ]),
  ];
};

const sharedTestingMessage =
  'Shared test arrangement is for specs, tests/ and test configuration only.';
const sharedTestingSpecifier = String.raw`/^@basis\/shared-testing(\/|$)/`;

const productionIgnores = [
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/tests/**',
  '**/vitest.config.*',
  '**/vite.config.*',
  '**/jest.config.*',
  '**/eslint.config.*',
];

const sharedTestingPatterns = {
  group: ['@basis/shared-testing', '@basis/shared-testing/*'],
  message: sharedTestingMessage,
};

// ADR-0012 §1: a driving adapter reaches a driven one only through
// `application`; the composition root at the library's `src/` binds them
// (add-identity-authentication design decision 5).
const drivenPattern = {
  regex: '(^|/)driven(/|$)',
  message:
    "A driving adapter reaches a driven one only through the context's application (ADR-0012 §1).",
};

// Specs are excluded from every library's build output, so the buildable-
// library rule, which keeps built code from importing unbuilt sources, holds
// for production files only (add-identity-authentication design decision 12).
const boundaries = (withExternalImports) => [
  'error',
  {
    enforceBuildableLibDependency: withExternalImports,
    // A project's own ESLint configuration extends the root one by path.
    allow: withExternalImports ? [] : ['^(\\.\\./)+eslint\\.config\\.mjs$'],
    depConstraints: depConstraints({ withExternalImports }),
  },
];

export default [
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  { ignores: ['**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'] },
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: { '@nx/enforce-module-boundaries': boundaries(true) },
  },
  {
    files: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/tests/**',
      '**/vitest.config.*',
      '**/vite.config.*',
      '**/eslint.config.*',
    ],
    rules: { '@nx/enforce-module-boundaries': boundaries(false) },
  },
  // Tags are per project and cannot tell a spec from a source file, so the
  // shared test arrangement is kept out of production code by file.
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    ignores: productionIgnores,
    rules: {
      'no-restricted-imports': ['error', { patterns: [sharedTestingPatterns] }],
      // `no-restricted-imports` sees only static imports and re-exports.
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportExpression[source.value=${sharedTestingSpecifier}]`,
          message: sharedTestingMessage,
        },
        {
          selector: `ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.cooked=${sharedTestingSpecifier}]`,
          message: sharedTestingMessage,
        },
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=${sharedTestingSpecifier}]`,
          message: sharedTestingMessage,
        },
      ],
    },
  },
  // Flat config replaces a rule configured twice for one file, so the
  // driving folder's production files repeat the shared-testing pattern. The
  // globs start at `src/`, so they match from a library's own configuration,
  // which resolves them against the library's directory, as from the root.
  {
    files: ['**/src/driving/**/*.ts'],
    ignores: productionIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [sharedTestingPatterns, drivenPattern] },
      ],
    },
  },
  {
    files: ['**/src/driving/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [drivenPattern] }],
    },
  },
  eslintConfigPrettier,
];
