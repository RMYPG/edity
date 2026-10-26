import { expect, test } from 'vitest';

test('the package entry point loads by its published name', async () => {
  await expect(import('@edity/core')).resolves.toBeDefined();
});
