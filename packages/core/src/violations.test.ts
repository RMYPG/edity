import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
import {
  decimalPlaces,
  defineFields,
  definitionOf,
  list,
  number,
  text,
  violations,
  type Definition,
} from '@edity/core';

const title = text({ maxChars: 10, maxLines: 1 });
const price = number({ min: 5, max: 500, decimals: 2 });
const services = list(text({ maxChars: 10 }), { min: 1, max: 3 });
const page = defineFields({
  hero: { title },
  plans: list(
    {
      name: text({ maxChars: 10 }),
      price,
      features: list(text({ maxChars: 10 }), { min: 0, max: 2 }),
    },
    { min: 1, max: 2 },
  ),
});

function definition(schema: z.ZodType): Definition {
  return definitionOf(schema)!;
}

describe('decimalPlaces', () => {
  test.each([
    [19.99, 2],
    [12.5, 1],
    [45, 0],
    [-0.05, 2],
    [0.1 + 0.2, 17],
    [1e21, 0],
    [1.5e-7, 8],
  ])('counts %d as %i, in its shortest decimal form', (value, places) => {
    expect(decimalPlaces(value)).toBe(places);
  });
});

describe('violations', () => {
  test('of a text Field: one visible line, of visible characters within maxChars', () => {
    expect(violations(definition(title), 'Hola 👋🏽')).toEqual([]);
    expect(violations(definition(title), '')).toEqual([
      { path: '', rule: 'oneLine' },
    ]);
    expect(violations(definition(title), '   ')).toEqual([
      { path: '', rule: 'oneLine' },
    ]);
    expect(violations(definition(title), 'Uno\nDos')).toEqual([
      { path: '', rule: 'oneLine' },
    ]);
    // 12 visible characters, 15 UTF-16 code units.
    expect(violations(definition(title), 'Fisio 🇪🇸 casa')).toEqual([
      { path: '', rule: 'maxChars', max: 10, count: 12 },
    ]);
    expect(violations(definition(title), 3)).toEqual([
      { path: '', rule: 'type' },
    ]);
  });

  test('of a number Field: within its range, with at most its decimals', () => {
    expect(violations(definition(price), 19.99)).toEqual([]);
    expect(violations(definition(price), 4.99)).toEqual([
      { path: '', rule: 'min', bound: 5 },
    ]);
    expect(violations(definition(price), 1000.555)).toEqual([
      { path: '', rule: 'max', bound: 500 },
      { path: '', rule: 'decimals', max: 2, count: 3 },
    ]);
    for (const value of ['19.99', Number.NaN, Infinity, undefined]) {
      expect(violations(definition(price), value)).toEqual([
        { path: '', rule: 'type' },
      ]);
    }
  });

  test('of a List: its bounds, and each Item, by index', () => {
    expect(violations(definition(services), ['Uno', 'Dos'])).toEqual([]);
    expect(violations(definition(services), [])).toEqual([
      { path: '', rule: 'minItems', bound: 1 },
    ]);
    expect(violations(definition(services), ['a', '', 'b', 'c'])).toEqual([
      { path: '', rule: 'maxItems', bound: 3 },
      { path: '1', rule: 'oneLine' },
    ]);
    expect(violations(definition(services), 'Uno')).toEqual([
      { path: '', rule: 'type' },
    ]);
  });

  test('of a page: every Field, missing and unknown ones too, by path', () => {
    const plan = { name: 'Básico', price: 19.99, features: ['Una'] };
    expect(
      violations(definition(page), { hero: { title: 'Hola' }, plans: [plan] }),
    ).toEqual([]);
    expect(
      violations(definition(page), {
        hero: { title: 'Hola', lead: 'Más' },
        plans: [plan, { name: 'Completo', price: 4, features: [''] }],
      }),
    ).toEqual([
      { path: 'hero.lead', rule: 'unknown' },
      { path: 'plans.1.price', rule: 'min', bound: 5 },
      { path: 'plans.1.features.0', rule: 'oneLine' },
    ]);
    expect(violations(definition(page), { plans: null })).toEqual([
      { path: 'hero', rule: 'type' },
      { path: 'plans', rule: 'type' },
    ]);
  });

  // The Editor checks a Draft with these, and the Site's build validates
  // with the Zod schemas: they must agree on every value.
  describe.each([
    {
      name: 'a text Field',
      schema: title,
      values: [
        'Hola',
        ' Hola ',
        'Fisioterapia',
        'José en 🇪🇸',
        '​',
        '\v',
        '',
        '   ',
        ' 　',
        'a\nb',
        'a\rb',
        'a b',
        'a b',
        3,
        null,
        undefined,
        ['Hola'],
      ],
    },
    {
      name: 'a number Field',
      schema: price,
      values: [5, 500, 19.99, 12.5, 4.99, 500.01, 19.999, 0.1 + 0.2, -0, '45'],
    },
    {
      name: 'a number Field with no decimals',
      schema: number({ min: 0, max: 1_000_000, decimals: 0 }),
      values: [0, 12000, 12000.5, 1e6, 1e6 + 1, 1e21, Number.NaN, Infinity],
    },
    {
      name: 'a List',
      schema: services,
      values: [['Uno'], ['Uno', 'Dos', 'Tres'], [], ['a', 'b', 'c', 'd'], ['']],
    },
    {
      name: 'a page',
      schema: page,
      values: [
        {
          hero: { title: 'Hola' },
          plans: [{ name: 'Básico', price: 19.99, features: [] }],
        },
        {
          hero: { title: 'Hola' },
          plans: [{ name: 'Básico', price: 19.99, features: ['a', 'b', 'c'] }],
        },
        { hero: { title: 'Hola' }, plans: [{ name: 'Básico', price: 19.99 }] },
        {
          hero: { title: 'Hola', lead: 'Más' },
          plans: [{ name: 'Básico', price: 19.99, features: [] }],
        },
        { hero: { title: 'Hola' }, plans: [] },
        { hero: { title: 'Hola' } },
        { hero: [], plans: [] },
        null,
        'Hola',
      ],
    },
  ])('agree with the Zod schema of $name', ({ schema, values }) => {
    test.each(values.map((value) => [value]))('on %j', (value) => {
      expect(violations(definition(schema), value).length === 0).toBe(
        schema.safeParse(value).success,
      );
    });
  });
});
