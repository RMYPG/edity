import {
  schemaFileMatches,
  toSchemaFile,
  type AnyFieldDefinitions,
} from '@edity/core';
import { AstroError } from 'astro/errors';
import { glob, type Loader, type LoaderContext } from 'astro/loaders';
import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPageName, pageNames } from './pages.js';
import { checkContentFormat } from './prettier.js';

/**
 * The loader of a page's content collection, whose name is the page's:
 *
 * ```ts
 * export const collections = {
 *   home: defineCollection({ loader: edityPage(homeFields) }),
 * };
 * ```
 *
 * It loads the page's content from `src/content/<page>.json`, as one entry
 * with the page's name as its id, and checks it against `fields`. It fails
 * for a page whose name edity-server would refuse (`isPageName`). It also
 * keeps the page's JSON Schema, `src/content/<page>.schema.json`, in step
 * with `fields`, like a lockfile: `astro dev` rewrites the file when it is
 * missing or stale, and `astro build`, `astro check` and `astro sync` fail
 * instead, so a stale file never reaches the server, which validates Changes
 * against it. And it fails when the Site's Prettier would format the page's
 * content otherwise than edity-server writes it on a Publish
 * (`checkContentFormat`).
 *
 * Write the Field definitions in `src/content.config.ts`. A running `astro
 * dev` loads content again when that file changes, but not when a file it
 * imports does, so definitions kept elsewhere only reach the JSON Schema when
 * `astro dev` starts.
 */
export function edityPage<Fields extends AnyFieldDefinitions>(
  fields: Fields,
): Loader & { readonly schema: Fields } {
  return {
    name: 'edity-page',
    schema: fields,
    async load(context) {
      const content = new URL('content/', context.config.srcDir);
      const page = context.collection;
      if (!isPageName(page)) {
        throw new AstroError(
          `"${page}" cannot be the name of a page: edity-server takes only ${pageNames}.`,
          `Rename the content collection "${page}" in src/content.config.ts, and its files in src/content/.`,
        );
      }
      await syncSchemaFile(
        context,
        new URL(`${page}.schema.json`, content),
        fields,
      );
      await checkContentFormat(
        context.config.root,
        new URL(`${page}.json`, content),
      );
      await glob({ pattern: `${page}.json`, base: content }).load(context);
    },
  };
}

/**
 * Writes the page's JSON Schema in `astro dev`, which is the only command
 * that gives loaders a file watcher, and fails any other command if the
 * committed file does not match `fields`.
 */
async function syncSchemaFile(
  context: LoaderContext,
  file: URL,
  fields: AnyFieldDefinitions,
): Promise<void> {
  const committed = await readFile(file, 'utf8').catch(() => undefined);
  if (committed !== undefined && schemaFileMatches(committed, fields)) return;
  const name = relative(
    fileURLToPath(context.config.root),
    fileURLToPath(file),
  );
  if (context.watcher) {
    await writeFile(file, toSchemaFile(fields));
    context.logger.info(`Wrote ${name}`);
    return;
  }
  throw new AstroError(
    committed === undefined
      ? `${name}, the JSON Schema of page "${context.collection}", is missing.`
      : `${name} does not match the Field definitions of page "${context.collection}".`,
    'Run `astro dev` to write it from the Field definitions, then commit it.',
  );
}
