// Page names. A page's name is its content collection's, and it names the
// page's files in the Site repository, `src/content/<page>.json` and
// `src/content/<page>.schema.json` (loaders.ts), which edity-server reads.

/**
 * The names edity-server takes for a page, in words that complete
 * "edity-server takes only …": those the pattern of `page` in Publish's
 * request in its OpenAPI file matches, as `isPageName` tells them.
 */
export const pageNames =
  'letters from A to Z, digits, "-" and "_", starting with a letter or a digit';

/**
 * Whether edity-server takes `name` as a page's name: one of
 * {@link pageNames}. `pages.test.ts` checks it against the OpenAPI file.
 */
export function isPageName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name);
}
