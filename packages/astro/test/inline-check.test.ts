import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buildFixture, type BuiltSite } from './build-fixture.js';

/** The Editor bundle, as the package build writes it. */
const bundle = new URL('../dist/editor.js', import.meta.url);

let withEdity: BuiltSite;
let disabled: BuiltSite;
let html: string;

beforeAll(async () => {
  [withEdity, disabled] = await Promise.all([
    buildFixture(),
    buildFixture({ enabled: false }),
  ]);
  html = await withEdity.read('index.html');
});

afterAll(async () => {
  await withEdity?.remove();
  await disabled?.remove();
});

/** The inline scripts of a page that import from /_edity/. */
function inlineChecks(page: string): string[] {
  return [...page.matchAll(/<script>([^<]*\/_edity\/[^<]*)<\/script>/g)].map(
    ([, script]) => script!,
  );
}

/** The path, under dist/, of the file the inline check imports. */
function imported(check: string): string | undefined {
  return /import\("\/(_edity\/editor\.[0-9a-f]{10}\.js)"\)/.exec(check)?.[1];
}

test('a page has one inline check of at most 300 bytes, in its head (N1)', () => {
  const [check, ...others] = inlineChecks(html);

  expect(others).toEqual([]);
  expect(Buffer.byteLength(check!)).toBeLessThanOrEqual(300);
  expect(html.indexOf(check!)).toBeLessThan(html.indexOf('</head>'));
});

test('the inline check loads the Editor bundle, written under a hashed name in _edity/', async () => {
  const file = imported(inlineChecks(html)[0]!);

  expect(file).toBeDefined();
  expect(await withEdity.read(file!)).toBe(await readFile(bundle, 'utf8'));
});

test('the Site without Edity has no inline check and no Editor bundle', async () => {
  const file = imported(inlineChecks(html)[0]!)!;

  expect(inlineChecks(await disabled.read('index.html'))).toEqual([]);
  await expect(disabled.read(file)).rejects.toThrow('ENOENT');
});
