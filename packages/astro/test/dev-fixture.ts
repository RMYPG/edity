import edity, { type EdityOptions } from '@edity/astro';
import { dev } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  copyFixture,
  editFile,
  fromSource,
  type Edits,
} from './build-fixture.js';

export interface DevOptions extends EdityOptions {
  /** Changes to the copy's files before the server starts. */
  readonly edits?: Edits;
}

export interface DevSite {
  /** Reads a file of the copy, such as `src/content/home.schema.json`. */
  read(file: string): Promise<string>;
  /** Changes a file of the copy while the server runs. */
  edit(file: string, edit: (text: string) => string): Promise<void>;
  /** Stops the server and removes the copy. */
  stop(): Promise<void>;
}

/**
 * Runs `astro dev` on a copy of the fixture Site, with the integration read
 * from source. Astro keeps module-level state between `dev()` and `build()`,
 * so a test file that calls this must not build the fixture too. The server
 * listens on `EDITY_TEST_DEV_PORT`, or on a port the OS picks.
 */
export async function devFixture(options: DevOptions = {}): Promise<DevSite> {
  const { edits, ...edityOptions } = options;
  const { root, remove } = await copyFixture('dev-', edits);
  let server: Awaited<ReturnType<typeof dev>>;
  try {
    server = await dev({
      root,
      configFile: false,
      logLevel: 'silent',
      server: {
        host: '127.0.0.1',
        port: Number(process.env.EDITY_TEST_DEV_PORT ?? 0),
      },
      integrations: [edity(edityOptions)],
      vite: { plugins: [fromSource] },
    });
  } catch (error) {
    await remove();
    throw error;
  }
  const read = (file: string) => readFile(join(root, file), 'utf8');
  return {
    read,
    edit: (file, edit) => editFile(root, file, edit),
    stop: async () => {
      await server.stop();
      await remove();
    },
  };
}
