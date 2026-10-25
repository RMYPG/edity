import { defineProject, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(
  shared,
  defineProject({
    // What the integration defines for the template helpers in a Site build.
    define: {
      __EDITY_OPTIONS__: JSON.stringify({
        enabled: true,
        narrowScreens: '(width < 600px)',
      }),
    },
    test: {
      name: '@edity/astro',
      // Playwright runs these, against the built fixture Site.
      exclude: ['test/browser/**'],
      // Tests in test/ build the fixture Site, which takes a few seconds.
      testTimeout: 60_000,
      hookTimeout: 120_000,
    },
  }),
);
