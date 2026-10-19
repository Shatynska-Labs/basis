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
      ...external({
        bannedExternalImports: frameworkAndSdkPackages,
        allowedExternalImports: ['@nestjs/common', '@nestjs/cqrs'],
      }),
    },
    {
      sourceTag: 'type:infrastructure',
      onlyDependOnLibsWithTags: [
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

const boundaries = (withExternalImports) => [
  'error',
  {
    enforceBuildableLibDependency: true,
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
    ignores: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/tests/**',
      '**/vitest.config.*',
      '**/vite.config.*',
      '**/jest.config.*',
      '**/eslint.config.*',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@basis/shared-testing', '@basis/shared-testing/*'],
              message: sharedTestingMessage,
            },
          ],
        },
      ],
      // `no-restricted-imports` sees only static imports and re-exports.
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportExpression[source.value=${sharedTestingSpecifier}]`,
          message: sharedTestingMessage,
        },
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=${sharedTestingSpecifier}]`,
          message: sharedTestingMessage,
        },
      ],
    },
  },
  eslintConfigPrettier,
];
