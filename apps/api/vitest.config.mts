import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  // Nest's dependency injection needs decorator metadata, which esbuild does
  // not emit (deploy-api-skeleton design decision 3). The decorator settings
  // come from tsconfig.spec.json; .swcrc is the build's, and excludes specs.
  plugins: [
    swc.vite({
      swcrc: false,
      tsconfigFile: `${import.meta.dirname}/tsconfig.spec.json`,
    }),
  ],
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
  },
}));
