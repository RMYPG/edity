import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { fixture } from './build-fixture.js';
import { devFixture, type DevSite } from './dev-fixture.js';

// `astro build` fails instead: see schema-file.test.ts. Only `dev()` runs in
// this file, because Astro keeps module-level state between `dev()` and
// `build()`.

const schemaFile = 'src/content/home.schema.json';

describe('astro dev', () => {
  let committed: string;
  let site: DevSite;

  beforeAll(async () => {
    committed = await readFile(new URL(schemaFile, fixture), 'utf8');
    site = await devFixture({
      edits: {
        'src/content.config.ts': (ts) =>
          ts.replace(
            'name: text({ maxChars: 30, maxLines: 1 })',
            'name: text({ maxChars: 32, maxLines: 1 })',
          ),
      },
    });
  });

  afterAll(async () => {
    await site?.stop();
  });

  test('rewrites a stale JSON Schema when it starts', async () => {
    // brand.name is the only Field with 30 characters.
    expect(await site.read(schemaFile)).toBe(
      committed.replace(
        '"x-edity-maxGraphemes": 30,',
        '"x-edity-maxGraphemes": 32,',
      ),
    );
  });

  test('rewrites the JSON Schema when a Limit changes', async () => {
    await site.edit('src/content.config.ts', (ts) =>
      ts.replace(
        'title: text({ maxChars: 50, maxLines: 2 })',
        'title: text({ maxChars: 52, maxLines: 2 })',
      ),
    );

    // contact.title is the only Field with 50 characters.
    await vi.waitFor(
      async () => {
        expect(await site.read(schemaFile)).toBe(
          committed
            .replace(
              '"x-edity-maxGraphemes": 30,',
              '"x-edity-maxGraphemes": 32,',
            )
            .replace(
              '"x-edity-maxGraphemes": 50,',
              '"x-edity-maxGraphemes": 52,',
            ),
        );
      },
      { timeout: 20_000, interval: 200 },
    );
  });
});
