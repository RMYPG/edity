import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { checkContentFormat } from '../src/prettier.js';
import { buildFixture, copyFixture } from './build-fixture.js';

/**
 * Checks the home page's content file of a copy of the fixture Site with
 * `files` added, which resolves the workspace's Prettier, 3.9.
 */
async function check(files: Readonly<Record<string, string>> = {}) {
  const { root, remove } = await copyFixture('prettier-');
  try {
    for (const [file, text] of Object.entries(files)) {
      await mkdir(join(root, file, '..'), { recursive: true });
      await writeFile(join(root, file), text);
    }
    const site = pathToFileURL(`${root}/`);
    await checkContentFormat(site, new URL('src/content/home.json', site));
  } finally {
    await remove();
  }
}

const hint =
  "Leave src/content/*.json to Prettier's defaults: set none of these options for them in the Site's Prettier config, its overrides or .editorconfig.";

test("a Site whose Prettier config leaves content files to Prettier's defaults passes", async () => {
  // The workspace's own config, which sets singleQuote and a plugin.
  await expect(check()).resolves.toBeUndefined();
  await expect(
    check({
      '.prettierrc.json': JSON.stringify({
        singleQuote: true,
        overrides: [{ files: '*.astro', options: { printWidth: 120 } }],
      }),
      '.editorconfig':
        'root = true\n\n[*.md]\nmax_line_length = 100\n\n[*.json]\nend_of_line = lf\n',
    }),
  ).resolves.toBeUndefined();
});

test('a Prettier config that changes how content files are formatted fails, saying which options', async () => {
  await expect(
    check({ '.prettierrc.json': JSON.stringify({ printWidth: 100 }) }),
  ).rejects.toMatchObject({
    message:
      "Prettier would format src/content/home.json with printWidth 100, but edity-server writes content files with Prettier's default options, printWidth 80, so the Site's `prettier --check` would fail on every Publish.",
    hint,
  });
  await expect(
    check({
      '.prettierrc.json': JSON.stringify({
        overrides: [
          {
            files: 'src/content/*.json',
            options: { tabWidth: 4, objectWrap: 'collapse' },
          },
        ],
      }),
    }),
  ).rejects.toMatchObject({
    message:
      "Prettier would format src/content/home.json with tabWidth 4, objectWrap collapse, but edity-server writes content files with Prettier's default options, tabWidth 2, objectWrap preserve, so the Site's `prettier --check` would fail on every Publish.",
  });
});

test('an .editorconfig that changes how content files are formatted fails too', async () => {
  await expect(
    check({
      '.editorconfig':
        'root = true\n\n[*.json]\nindent_style = tab\nend_of_line = crlf\n',
    }),
  ).rejects.toMatchObject({
    message:
      "Prettier would format src/content/home.json with useTabs true, endOfLine crlf, but edity-server writes content files with Prettier's default options, useTabs false, endOfLine lf, so the Site's `prettier --check` would fail on every Publish.",
  });
});

test('another Prettier than the one edity-server writes content files as fails', async () => {
  await expect(
    check({
      'node_modules/prettier/package.json': JSON.stringify({
        name: 'prettier',
        version: '3.10.0',
      }),
    }),
  ).rejects.toMatchObject({
    message:
      "The Site's Prettier is 3.10.0, but edity-server writes src/content/home.json as Prettier 3.9 does with its default options, so the Site's `prettier --check` could fail on a Publish.",
    hint: 'Keep Prettier at 3.9 in package.json until edity-server writes content files as the new Prettier does.',
  });
});

test('a Site without Prettier has nothing to check', async () => {
  // Outside the workspace, whose Prettier it would find.
  const root = await mkdtemp(join(tmpdir(), 'edity-no-prettier-'));
  try {
    await writeFile(join(root, 'package.json'), '{}');
    const site = pathToFileURL(`${root}/`);
    await expect(
      checkContentFormat(site, new URL('src/content/home.json', site)),
    ).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the page loader fails the Site's build when its Prettier would format a content file otherwise", async () => {
  const build = buildFixture({
    edits: {
      // Prettier reads its config from package.json too.
      'package.json': (json) =>
        json.replace(
          '"private": true,',
          '"private": true,\n  "prettier": { "overrides": [{ "files": "src/content/*.json", "options": { "printWidth": 120 } }] },',
        ),
    },
  });

  await expect(build).rejects.toMatchObject({
    message:
      "Prettier would format src/content/home.json with printWidth 120, but edity-server writes content files with Prettier's default options, printWidth 80, so the Site's `prettier --check` would fail on every Publish.",
    hint,
  });
});
