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
    // The API refuses to start without a database URL; this one names an
    // address where nothing listens, so no database is reachable
    // (add-persistence-skeleton design decision 2).
    env: { DATABASE_URL: 'postgres://basis:unused@127.0.0.1:9/basis' },
    reporters: ['default'],
  },
}));
