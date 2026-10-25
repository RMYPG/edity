import { defineProject, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(
  shared,
  defineProject({
    test: {
      name: '@edity/core',
      // Also run the type-level tests in `*.test-d.ts` through tsc.
      typecheck: {
        enabled: true,
        tsconfig: './tsconfig.json',
      },
    },
  }),
);
