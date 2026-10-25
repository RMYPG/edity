import { describe, expect, test } from 'vitest';
import edity, { type EdityOptions } from './index.js';

test('the package entry point loads by its published name', async () => {
  await expect(import('@edity/astro')).resolves.toBeDefined();
});

test('@edity/core resolves from the workspace', async () => {
  await expect(import('@edity/core')).resolves.toBeDefined();
});

/** What the integration tells the template helpers, for `options`. */
function helperOptions(options?: EdityOptions): unknown {
  let define: Record<string, string> | undefined;
  const setup = edity(options).hooks['astro:config:setup']!;
  void setup({
    updateConfig: (config: { vite?: { define?: Record<string, string> } }) => {
      define = config.vite?.define;
    },
  } as unknown as Parameters<typeof setup>[0]);
  return JSON.parse(define!.__EDITY_OPTIONS__!);
}

describe('narrowScreens (L2)', () => {
  test('defaults to screens under 600 px, phones held upright', () => {
    expect(helperOptions()).toEqual({
      enabled: true,
      narrowScreens: '(width < 600px)',
    });
  });

  test("takes the media query of the Site's own phone layout", () => {
    expect(helperOptions({ narrowScreens: '(max-width: 480px)' })).toEqual({
      enabled: true,
      narrowScreens: '(max-width: 480px)',
    });
  });

  test('must be a media query', () => {
    expect(() => edity({ narrowScreens: ' ' })).toThrow(
      '[edity] narrowScreens must be a media query, such as \'(max-width: 480px)\', not " "',
    );
    expect(() => edity({ narrowScreens: 480 as unknown as string })).toThrow(
      'not 480',
    );
  });
});
