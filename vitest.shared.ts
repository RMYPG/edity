import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

// Shared by every package's vitest.config.ts.
export default defineConfig({
  // Resolve `@edity/*` imports to source, like tsconfig.base.json does, so
  // tests run without a build. `ssr` covers the node environment and
  // `resolve` covers browser-like ones.
  resolve: {
    conditions: ['@edity/source', ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: ['@edity/source', ...defaultServerConditions],
    },
  },
  server: {
    watch: {
      ignored: ['**/.claude/**', '**/dist/**'],
    },
  },
  test: {
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/dist/**'],
  },
});
