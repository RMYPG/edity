import edity, { type EdityOptions } from '@edity/astro';
import { build, type AstroIntegration } from 'astro';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  defaultClientConditions,
  defaultServerConditions,
  type Plugin,
} from 'vite';

/** The fixture Site, which every test of the integration builds. */
export const fixture = new URL('./fixture/', import.meta.url);

export interface BuildOptions extends EdityOptions {
  /** Extra pages to build, by URL pattern, from files of the fixture Site. */
  readonly routes?: Readonly<Record<string, string>>;
  /** Changes to the copy's files before the build (see `copyFixture`). */
  readonly edits?: Edits;
}

/**
 * Changes to files of a copy of the fixture, by path: each takes the file's
 * text and returns the new text, or `null` removes the file. An edit that
 * changes nothing throws, so a test cannot pass because the fixture moved on.
 */
export type Edits = Readonly<Record<string, ((text: string) => string) | null>>;

export interface FixtureCopy {
  /** The copy's directory. */
  readonly root: string;
  /**
   * Removes the copy, once Astro has written its data store. Astro writes it
   * 500 ms after the last change, and a build or server that fails leaves
   * that write pending.
   */
  remove(): Promise<void>;
}

export interface BuiltSite {
  /** Reads the HTML of a built page, such as `index.html`. */
  read(file: string): Promise<string>;
  /** Removes the build output. */
  remove(): Promise<void>;
}

/**
 * Builds a copy of the fixture Site, with the integration read from source.
 * Each build gets its own copy under the fixture's `.builds/`, so builds can
 * run side by side and never touch the fixture's own `.astro/` or `dist/`.
 * The config repeats the fixture's `astro.config.mjs`.
 */
export async function buildFixture(
  options: BuildOptions = {},
): Promise<BuiltSite> {
  const { routes = {}, edits, ...edityOptions } = options;
  const { root, remove } = await copyFixture('build-', edits);
  const injectRoutes: AstroIntegration = {
    name: 'inject-test-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const [pattern, file] of Object.entries(routes)) {
          injectRoute({ pattern, entrypoint: join(root, file) });
        }
      },
    },
  };
  try {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      integrations: [edity(edityOptions), injectRoutes],
      vite: { plugins: [fromSource] },
    });
  } catch (error) {
    await remove();
    throw error;
  }
  return {
    read: (file) => readFile(join(root, 'dist', file), 'utf8'),
    remove,
  };
}

/**
 * Copies the fixture Site under its `.builds/`, then makes `edits` to the
 * copy. Tests that change files work on a copy, so they can run side by side
 * and the committed fixture stays as it is.
 */
export async function copyFixture(
  prefix: string,
  edits: Edits = {},
): Promise<FixtureCopy> {
  // Inside the fixture, so the copy resolves the fixture's node_modules.
  const builds = fileURLToPath(new URL('.builds/', fixture));
  await mkdir(builds, { recursive: true });
  const root = await mkdtemp(join(builds, prefix));
  for (const entry of await readdir(fixture)) {
    if (skipped.has(entry)) continue;
    await cp(new URL(entry, fixture), join(root, entry), { recursive: true });
  }
  for (const [file, edit] of Object.entries(edits)) {
    if (edit === null) await rm(join(root, file));
    else await editFile(root, file, edit);
  }
  const remove = async () => {
    await setTimeout(1_000);
    await rm(root, { recursive: true, force: true });
  };
  return { root, remove };
}

/** Changes a file of a copy of the fixture (see `Edits`). */
export async function editFile(
  root: string,
  file: string,
  edit: (text: string) => string,
): Promise<void> {
  const path = join(root, file);
  const text = await readFile(path, 'utf8');
  const edited = edit(text);
  if (edited === text) throw new Error(`The edit of ${file} changed nothing`);
  await writeFile(path, edited);
}

/** What a copy of the fixture leaves out: installs and build output. */
const skipped = new Set(['node_modules', 'dist', '.astro', '.builds']);

/**
 * Resolves the workspace's @edity/* packages to source, as Vitest does, in
 * every Vite environment of the build (Astro adds its own).
 */
export const fromSource: Plugin = {
  name: 'edity-from-source',
  configEnvironment: (name) => ({
    resolve: {
      conditions: [
        '@edity/source',
        ...(name === 'client'
          ? defaultClientConditions
          : defaultServerConditions),
      ],
    },
  }),
};

/**
 * Removes what Edity adds to a built page: `data-edity-*` attributes and the
 * `<template>` of every List.
 */
// TODO(ticket 09): also remove the inline check.
export function withoutEdity(html: string): string {
  let rest = html;
  let out = '';
  for (
    let start = rest.indexOf('<template data-edity-template');
    start !== -1;
    start = rest.indexOf('<template data-edity-template')
  ) {
    out += rest.slice(0, start);
    rest = rest.slice(endOfTemplate(rest, start));
  }
  return (out + rest).replace(/ data-edity-[a-z-]+="[^"]*"/g, '');
}

/** The index just after the `</template>` that closes the one at `start`. */
function endOfTemplate(html: string, start: number): number {
  const tags = /<template[\s>]|<\/template>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(html); tag !== null; tag = tags.exec(html)) {
    depth += tag[0] === '</template>' ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error(`Unclosed <template> at ${start}`);
}
