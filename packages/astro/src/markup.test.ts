import {
  defineFields,
  definitionOf,
  list,
  number,
  text,
  type Definition,
} from '@edity/core';
import { describe, expect, test } from 'vitest';
import { blankValue, markedPath, markup, selector } from './markup.js';

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

describe('blankValue', () => {
  const plans = definitionOf(
    defineFields({
      plans: list(
        {
          name: text({ maxChars: 24 }),
          price: number({ min: 5, max: 999, decimals: 2 }),
          features: list(text({ maxChars: 60 }), { min: 2, max: 5 }),
        },
        { min: 1, max: 3 },
      ),
    }),
  ) as Definition & { kind: 'object' };
  const plan = (plans.shape.plans as Definition & { kind: 'list' }).item;

  test('has empty text Fields and the fewest Items each List takes', () => {
    expect(blankValue(plan, ({ min }) => min)).toEqual({
      name: '',
      price: 5,
      features: ['', ''],
    });
  });

  test('holds what it is given in each number Field', () => {
    expect(blankValue(plan, () => '')).toEqual({
      name: '',
      price: '',
      features: ['', ''],
    });
  });
});
