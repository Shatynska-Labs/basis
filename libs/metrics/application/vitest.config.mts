import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/metrics/application',
  // Nest's dependency injection needs decorator metadata, which esbuild does
  // not emit; SWC compiles with the settings of tsconfig.spec.json.
  plugins: [
    swc.vite({
      swcrc: false,
      tsconfigFile: `${import.meta.dirname}/tsconfig.spec.json`,
    }),
  ],
  test: {
    name: 'metrics-application',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
  },
}));
