// @ts-check
import edity from '@edity/astro';
import { defineConfig } from 'astro/config';

// Tests that build this Site from Vitest pass the same config inline (see
// packages/astro/test/build-fixture.ts), so keep the two in step.
export default defineConfig({
  integrations: [edity()],
});
