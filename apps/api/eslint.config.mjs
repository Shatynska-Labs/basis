import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  // Only the API's configuration reads its environment, so nothing bypasses
  // validation (add-api-cross-cutting-basics design decision 2). The migration
  // process reads DATABASE_URL on its own (api-persistence). The globs are
  // relative to this file: `nx lint api` and lint-staged both load it.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/config/**', 'src/migrate.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            "Take the API's configuration from APP_CONFIG (apps/api/src/config) instead of reading process.env.",
        },
      ],
    },
  },
];
