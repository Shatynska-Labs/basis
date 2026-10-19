import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Named so the @nx/vitest plugin infers no target from it: integration specs
// run only through `integration`, against one throwaway PostgreSQL per run
// (add-persistence-skeleton design decisions 8 and 9).
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api-integration',
  plugins: [
    swc.vite({
      swcrc: false,
      tsconfigFile: `${import.meta.dirname}/tsconfig.spec.json`,
    }),
  ],
  test: {
    name: 'api-integration',
    watch: false,
    environment: 'node',
    include: ['tests/integration/**/*.integration.spec.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    // Pulling and starting the image on a cold runner.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    reporters: ['default'],
  },
}));
