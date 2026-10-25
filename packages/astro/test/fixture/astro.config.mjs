// @ts-check
import edity from '@edity/astro';
import { defineConfig } from 'astro/config';
import mockApi from './mock-api.mjs';

// Tests that build this Site from Vitest pass the same config inline (see
// packages/astro/test/build-fixture.ts), so keep the two in step. mockApi()
// only acts under `astro dev`, so builds need not repeat it.
export default defineConfig({
  integrations: [edity(), mockApi()],
});
