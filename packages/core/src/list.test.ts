import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
import { definitionOf, list, number, text } from '@edity/core';

const name = text({ maxChars: 30 });
const bullet = text({ maxChars: 60 });
const bounds = { min: 0, max: 5 };

describe('list', () => {
  test('accepts from min to max Items', () => {
    const bullets = list(text({ maxChars: 40 }), { min: 1, max: 3 });

    expect(bullets.safeParse([]).success).toBe(false);
    expect(bullets.safeParse(['Masaje']).success).toBe(true);
    expect(bullets.safeParse(['a', 'b', 'c']).success).toBe(true);
    expect(bullets.safeParse(['a', 'b', 'c', 'd']).success).toBe(false);
  });

  test('checks every Item against its Field definitions', () => {
    const plans = list(
      {
        name: text({ maxChars: 10 }),
        amount: number({ min: 0, max: 500, decimals: 0 }),
      },
      { min: 0, max: 5 },
    );

    expect(plans.safeParse([{ name: 'Bono 5', amount: 225 }]).success).toBe(
      true,
    );
    expect(plans.safeParse([{ name: 'Bono 5', amount: 225.5 }]).success).toBe(
      false,
    );
    expect(plans.safeParse([{ name: 'Bono 5' }]).success).toBe(false);
  });

  test('rejects keys an Item does not define', () => {
    const plans = list({ name: text({ maxChars: 10 }) }, { min: 0, max: 5 });

    expect(plans.safeParse([{ name: 'Bono 5', price: 225 }]).success).toBe(
      false,
    );
  });

  test('keeps its Limits and its Item on the definition', () => {
    const plans = list(
      {
        name: text({ maxChars: 30 }),
        features: list(text({ maxChars: 60, maxLines: 1 }), { min: 1, max: 4 }),
      },
      { min: 1, max: 3 },
    );

    expect(definitionOf(plans)).toEqual({
      kind: 'list',
      limits: { min: 1, max: 3 },
      item: {
        kind: 'object',
        shape: {
          name: { kind: 'text', limits: { maxChars: 30 } },
          features: {
            kind: 'list',
            limits: { min: 1, max: 4 },
            item: { kind: 'text', limits: { maxChars: 60, maxLines: 1 } },
          },
        },
      },
    });
  });

  test('throws when Lists nest more than one level deep', () => {
    const notes = list(bullet, bounds);
    const features = list({ label: bullet, notes }, bounds);

    // @ts-expect-error: Lists nest one level deep at most.
    expect(() => list({ name, features }, bounds)).toThrow(
      'Lists nest one level deep at most, but the List at "features" has Items that hold a List at "notes"',
    );
  });

  test('throws when an Item holds more than one List', () => {
    const features = list(bullet, bounds);
    const extras = list(bullet, bounds);

    // @ts-expect-error: an Item holds at most one List.
    expect(() => list({ name, features, extras }, bounds)).toThrow(
      'An Item holds at most one List, but this one holds 2: "features", "extras"',
    );
  });

  test('throws when an Item is neither a text Field nor an object of Fields', () => {
    const amount = number({ min: 0, max: 10, decimals: 0 });
    const notAnItem =
      'An Item is a text Field or an object of Fields and at most one List';

    // @ts-expect-error: a number Field is not an Item.
    expect(() => list(amount, bounds)).toThrow(notAnItem);
    // @ts-expect-error: a List is not an Item.
    expect(() => list(list(bullet, bounds), bounds)).toThrow(notAnItem);
    // @ts-expect-error: a plain Zod schema is not an Item.
    expect(() => list(z.string(), bounds)).toThrow(notAnItem);
  });

  test('throws when an Item holds something other than Fields and a List', () => {
    // @ts-expect-error: a plain Zod schema is not a Field.
    expect(() => list({ name: z.string() }, bounds)).toThrow(
      '"name" in an Item must be a Field or a List made with text(), number() or list()',
    );
    // @ts-expect-error: an Item holds no groups of Fields.
    expect(() => list({ price: { amount: name } }, bounds)).toThrow(
      '"price" in an Item must be a Field or a List made with text(), number() or list()',
    );
  });

  test('throws on an Item key that content paths would misread', () => {
    expect(() => list({ '1': name }, bounds)).toThrow(
      '"1" in an Item can\'t be a key: a key must not be empty, only digits, "*" or hold a dot',
    );
    expect(() => list({ 'price.amount': name }, bounds)).toThrow(
      '"price.amount" in an Item can\'t be a key',
    );
  });

  test('throws on Limits no List could meet', () => {
    expect(() => list(bullet, { min: 3, max: 2 })).toThrow(
      'min must not be greater than max, got min 3 and max 2',
    );
    expect(() => list(bullet, { min: -1, max: 2 })).toThrow(
      'min must be a whole number of at least 0, got -1',
    );
    expect(() => list(bullet, { min: 0, max: 0 })).toThrow(
      'max must be a whole number of at least 1, got 0',
    );
  });
});
