import { expect, test } from 'vitest';
import { buildFixture } from './build-fixture.js';

test('a page whose name edity-server would refuse fails the build, saying how to name it', async () => {
  const build = buildFixture({
    edits: {
      'src/content.config.ts': (ts) =>
        ts.replace(
          'home: defineCollection(',
          "'página de inicio': defineCollection(",
        ),
    },
  });

  await expect(build).rejects.toMatchObject({
    message:
      '"página de inicio" cannot be the name of a page: edity-server takes only letters from A to Z, digits, "-" and "_", starting with a letter or a digit.',
    hint: 'Rename the content collection "página de inicio" in src/content.config.ts, and its files in src/content/.',
  });
});
