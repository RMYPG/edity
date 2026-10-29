// Page names. A page's name is its content collection's, and it names the
// page's files in the Site repository, `src/content/<page>.json` and
// `src/content/<page>.schema.json` (loaders.ts), which edity-server reads.

/**
 * Whether edity-server takes `name` as a page's name, as the pattern of
 * `page` in Publish's request in its OpenAPI file has it: letters from A to
 * Z, digits, `-` and `_`, starting with a letter or a digit. The Editor's
 * tests check it against that file.
 */
export function isPageName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name);
}
