// @ts-check
import { defineConfig } from 'astro/config';
import mockApi from './mock-api.mjs';
import { siteConfig } from './site-config.ts';

// The tests that build this Site from Vitest start from siteConfig() too.
// mockApi() only acts under `astro dev`, so they leave it out.
const config = siteConfig();

export default defineConfig({
  ...config,
  integrations: [...config.integrations, mockApi()],
});
