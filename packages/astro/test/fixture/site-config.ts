// The fixture Site's Astro config, but for what only `astro dev` needs.
// astro.config.mjs adds that, and the tests that build the Site or run it
// from Vitest (../build-fixture.ts, ../dev-fixture.ts) start from this, so
// they build the Site the fixture's own config does.
import edity, { type EdityOptions } from '@edity/astro';
import type { AstroIntegration } from 'astro';

/** What the fixture Site's config sets. */
export interface SiteConfig {
  readonly integrations: AstroIntegration[];
}

/** The fixture Site's config, with Edity's `options`. */
export function siteConfig(options: EdityOptions = {}): SiteConfig {
  return { integrations: [edity(options)] };
}
