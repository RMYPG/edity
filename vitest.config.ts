import { defineConfig } from 'vitest/config';

// Each package has its own vitest.config.ts, built on vitest.shared.ts.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
