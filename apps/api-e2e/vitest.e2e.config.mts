import { defineConfig } from 'vitest/config';

// Named so the @nx/vitest plugin infers no `test` target: these tests run
// only through `e2e`, against the built API (deploy-api-skeleton design
// decision 4).
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api-e2e',
  test: {
    name: 'api-e2e',
    watch: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
}));
