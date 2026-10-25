import { defineProject, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(
  shared,
  defineProject({
    // What the integration defines for the template helpers in a Site build.
    define: {
      __EDITY_OPTIONS__: JSON.stringify({ enabled: true }),
    },
    test: {
      name: '@edity/astro',
    },
  }),
);
