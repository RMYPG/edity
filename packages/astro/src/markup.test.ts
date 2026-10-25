import { describe, expect, test } from 'vitest';
import { markedPath, markup, selector } from './markup.js';

describe('selector', () => {
  test('selects the elements that carry an attribute', () => {
    expect(selector(markup.field)).toBe('[data-edity-field]');
  });

  test('selects those that carry it with a path, quoted as a CSS string', () => {
    expect(selector(markup.list, 'plans.1.features')).toBe(
      '[data-edity-list="plans.1.features"]',
    );
    expect(selector(markup.field, 'a"b\\c\nd')).toBe(
      '[data-edity-field="a\\"b\\\\c\\a d"]',
    );
  });
});

test('markedPath reads the path an element is marked with, or none', () => {
  const element = (value: string | null) => ({ getAttribute: () => value });

  expect(markedPath(element('hero.title'), markup.field)).toBe('hero.title');
  expect(markedPath(element(null), markup.field)).toBe('');
});
