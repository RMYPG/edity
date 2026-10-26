import { expect, test } from 'vitest';
import { buildFixture } from './build-fixture.js';

// `astro dev` writes the file instead: see schema-file-dev.test.ts.

test('a Limit changed without regenerating the JSON Schema fails the build with the command that fixes it', async () => {
  const build = buildFixture({
    edits: {
      'src/content.config.ts': (ts) =>
        ts.replace(
          'name: text({ maxChars: 30, maxLines: 1 })',
          'name: text({ maxChars: 32, maxLines: 1 })',
        ),
    },
  });

  await expect(build).rejects.toMatchObject({
    message:
      'src/content/home.schema.json does not match the Field definitions of page "home".',
    hint: 'Run `astro dev` to write it from the Field definitions, then commit it.',
  });
});

test('a page without its JSON Schema fails the build with the command that fixes it', async () => {
  const build = buildFixture({
    edits: { 'src/content/home.schema.json': null },
  });

  await expect(build).rejects.toMatchObject({
    message:
      'src/content/home.schema.json, the JSON Schema of page "home", is missing.',
    hint: 'Run `astro dev` to write it from the Field definitions, then commit it.',
  });
});
