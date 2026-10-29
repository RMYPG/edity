// The Prettier a Site formats its content files with. edity-server writes
// a page's content file itself, `src/content/<page>.json`, as Prettier 3.9
// formats JSON with its default options, and a Site's CI runs `prettier
// --check`. So a Site whose Prettier would format that file otherwise fails
// CI on every Publish: its build fails first (edity-server's README,
// "Content files and Prettier").
import { AstroError } from 'astro/errors';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The Prettier whose formatting edity-server ports, by its major and minor
 * version: its width tables come from Prettier 3.9 (`prettierVersion` in its
 * `internal/content/emoji.go`).
 */
export const serverPrettier = '3.9';

/**
 * The options edity-server writes content files with, which are Prettier's
 * defaults for JSON, and the values of each that format a file alike.
 * `endOfLine: 'auto'` keeps the line ends a file has, which edity-server
 * writes as `\n`.
 */
const serverOptions: Readonly<Record<string, readonly unknown[]>> = {
  printWidth: [80],
  tabWidth: [2],
  useTabs: [false],
  endOfLine: ['lf', 'auto'],
  objectWrap: ['preserve'],
  // The parser Prettier picks for a `.json` file.
  parser: ['json'],
};

/** What the check calls of the Site's Prettier. */
interface Prettier {
  resolveConfig(
    file: string,
    options: { editorconfig: boolean },
  ): Promise<Record<string, unknown> | null>;
}

/**
 * Fails when the Site's Prettier would format `file`, a page's content file,
 * otherwise than edity-server writes it: when the Site's Prettier config,
 * an override that matches the file or its `.editorconfig` sets an option
 * that changes the formatting, or when the Site's Prettier is another major
 * or minor version than {@link serverPrettier}. A Site without Prettier has
 * nothing to check.
 */
export async function checkContentFormat(root: URL, file: URL): Promise<void> {
  const require = createRequire(new URL('package.json', root));
  let manifest;
  try {
    manifest = require.resolve('prettier/package.json');
  } catch {
    return;
  }
  const { version } = JSON.parse(await readFile(manifest, 'utf8')) as {
    version: string;
  };
  const name = relative(fileURLToPath(root), fileURLToPath(file));
  if (version.split('.').slice(0, 2).join('.') !== serverPrettier) {
    throw new AstroError(
      `The Site's Prettier is ${version}, but edity-server writes ${name} as Prettier ${serverPrettier} does with its default options, so the Site's \`prettier --check\` could fail on a Publish.`,
      `Keep Prettier at ${serverPrettier} in package.json until edity-server writes content files as the new Prettier does.`,
    );
  }
  const prettier = (await import(
    pathToFileURL(join(dirname(manifest), 'index.mjs')).href
  )) as Prettier;
  const config =
    (await prettier.resolveConfig(fileURLToPath(file), {
      editorconfig: true,
    })) ?? {};
  const differs = Object.entries(serverOptions).filter(
    ([option, alike]) => option in config && !alike.includes(config[option]),
  );
  if (differs.length === 0) return;
  const set = differs
    .map(([option]) => `${option} ${String(config[option])}`)
    .join(', ');
  const defaults = differs
    .map(([option, alike]) => `${option} ${String(alike[0])}`)
    .join(', ');
  throw new AstroError(
    `Prettier would format ${name} with ${set}, but edity-server writes content files with Prettier's default options, ${defaults}, so the Site's \`prettier --check\` would fail on every Publish.`,
    `Leave src/content/*.json to Prettier's defaults: set none of these options for them in the Site's Prettier config, its overrides or .editorconfig.`,
  );
}
