import { describe, expect, test, vi } from 'vitest';
import * as z from 'zod/v4';
import { defineFields, definitionOf, list, number, text } from '@edity/core';

const home = defineFields({
  hero: {
    title: text({ maxChars: 20, maxLines: 2 }),
    cta: { label: text({ maxChars: 12 }) },
  },
  plans: list(
    {
      name: text({ maxChars: 30 }),
      amount: number({ min: 0, max: 500, decimals: 0 }),
      features: list(text({ maxChars: 60 }), { min: 1, max: 4 }),
    },
    { min: 1, max: 3 },
  ),
});

const content = {
  hero: { title: 'Fisioterapia 🧑‍⚕️', cta: { label: 'Reservar' } },
  plans: [{ name: 'Bono 5', amount: 225, features: ['5 sesiones'] }],
};

describe('defineFields', () => {
  test("validates a page's content, groups of Fields and Lists included", () => {
    expect(home.parse(content)).toEqual(content);
  });

  test('reports a broken Limit with its path', () => {
    const result = home.safeParse({
      ...content,
      hero: { ...content.hero, title: 'Fisioterapia a domicilio' },
    });

    expect(result.error?.issues).toMatchObject([
      {
        path: ['hero', 'title'],
        message: 'Too long: expected at most 20 visible characters, got 24',
      },
    ]);
  });

  test('rejects keys the Field definitions do not define, at every level', () => {
    expect(home.safeParse({ ...content, footer: 'x' }).success).toBe(false);
    expect(
      home.safeParse({ ...content, hero: { ...content.hero, subtitle: 'x' } })
        .success,
    ).toBe(false);
  });

  test('keeps the whole tree of definitions, so it can be walked', () => {
    expect(definitionOf(home)).toEqual({
      kind: 'object',
      shape: {
        hero: {
          kind: 'object',
          shape: {
            title: { kind: 'text', limits: { maxChars: 20, maxLines: 2 } },
            cta: {
              kind: 'object',
              shape: { label: { kind: 'text', limits: { maxChars: 12 } } },
            },
          },
        },
        plans: {
          kind: 'list',
          limits: { min: 1, max: 3 },
          item: {
            kind: 'object',
            shape: {
              name: { kind: 'text', limits: { maxChars: 30 } },
              amount: {
                kind: 'number',
                limits: { min: 0, max: 500, decimals: 0 },
              },
              features: {
                kind: 'list',
                limits: { min: 1, max: 4 },
                item: { kind: 'text', limits: { maxChars: 60 } },
              },
            },
          },
        },
      },
    });
  });

  test('the definitions are plain data that survive JSON', () => {
    const definition = definitionOf(home);

    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });

  test('throws on anything but Fields, Lists and groups of them, naming its path', () => {
    expect(() =>
      // @ts-expect-error: a plain Zod schema is not a Field.
      defineFields({ hero: { title: z.string() } }),
    ).toThrow(
      '"hero.title" must be a Field, a List or an object of them, made with text(), number() and list()',
    );
  });

  test('throws on a key that content paths would misread, naming its path', () => {
    const title = text({ maxChars: 20 });
    // Digits name an Item's place in a List, and a dot separates keys.
    expect(() => defineFields({ '2026': title })).toThrow(
      '"2026" can\'t be a key: a key must not be empty, only digits, "*" or hold a dot',
    );
    expect(() => defineFields({ hero: { '0': title } })).toThrow(
      '"hero.0" can\'t be a key',
    );
    expect(() => defineFields({ 'hero.title': title })).toThrow(
      '"hero.title" can\'t be a key',
    );
    expect(() => defineFields({ '': title })).toThrow('"" can\'t be a key');
    expect(() => defineFields({ '*': title })).toThrow('"*" can\'t be a key');
  });

  test('accepts keys with digits among letters', () => {
    expect(() =>
      defineFields({
        year2026: text({ maxChars: 20 }),
        '2x': text({ maxChars: 20 }),
      }),
    ).not.toThrow();
  });
});

describe('definitionOf', () => {
  test('is undefined for anything not made by an Edity primitive', () => {
    expect(definitionOf(z.string())).toBeUndefined();
    expect(definitionOf({ maxChars: 10 })).toBeUndefined();
    expect(definitionOf(undefined)).toBeUndefined();
  });

  test('reads definitions made by another copy of @edity/core', async () => {
    vi.resetModules();
    const other = await import('@edity/core');

    expect(other.definitionOf).not.toBe(definitionOf);
    expect(other.definitionOf(text({ maxChars: 5 }))).toEqual({
      kind: 'text',
      limits: { maxChars: 5 },
    });
    expect(
      definitionOf(other.list(text({ maxChars: 5 }), { min: 0, max: 2 })),
    ).toMatchObject({ kind: 'list', item: { kind: 'text' } });
  });
});
