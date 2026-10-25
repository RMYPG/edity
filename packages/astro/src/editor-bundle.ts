import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * The Editor bundle, which the package build writes into `dist/` with Vite
 * (`vite.editor.config.ts`). The path works from `dist/`, where the published
 * integration runs, and from `src/`, where the workspace's tests run it.
 */
const bundleFile = fileURLToPath(new URL('../dist/editor.js', import.meta.url));

/**
 * Serves the Editor bundle at `/_edity/editor.<hash>.js` and adds the inline
 * check to every page, which imports it only in a browser carrying the
 * `edity=1` marker cookie (N1, A4). Visitors download nothing else.
 */
export function editorBundle(): AstroIntegration {
  let code: Buffer;
  let path: string;
  return {
    name: '@edity/astro/editor',
    hooks: {
      'astro:config:setup': ({ injectScript, addWatchFile }) => {
        code = readBundle();
        // A new name for each new bundle, so no browser runs a cached one.
        const hash = createHash('sha256').update(code).digest('hex');
        path = `/_edity/editor.${hash.slice(0, 10)}.js`;
        injectScript('head-inline', inlineCheck(path));
        // `astro dev` restarts when the bundle is rebuilt, for a new hash.
        addWatchFile(bundleFile);
      },
      'astro:server:setup': ({ server }) => {
        // Outside the Site's root, which is all Vite watches.
        server.watcher.add(bundleFile);
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== path) return next();
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(code);
        });
      },
      'astro:build:done': async ({ dir }) => {
        // Static, from the Site's own origin: only /_edity/login and
        // /_edity/api/* go to the server (ADR-0001).
        const file = new URL(`.${path}`, dir);
        await mkdir(new URL('.', file), { recursive: true });
        await writeFile(file, code);
      },
    },
  };
}

/**
 * The inline check, 82 bytes. `document.cookie` separates cookies with `; `,
 * so the pattern matches `edity=1` but not `xedity=1` or `edity=10`.
 * `import()` works in a classic script, and loads `src` from the page's own
 * origin.
 */
function inlineCheck(src: string): string {
  return `/(^|; )edity=1(;|$)/.test(document.cookie)&&import(${JSON.stringify(src)})`;
}

function readBundle(): Buffer {
  try {
    return readFileSync(bundleFile);
  } catch (error) {
    throw new Error(
      `[edity] The Editor bundle is missing from ${bundleFile}: build @edity/astro first (mise run build)`,
      { cause: error },
    );
  }
}
