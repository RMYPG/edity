import { describe, expectTypeOf, test } from 'vitest';
import type * as z from 'zod/v4';
import { defineFields, list, number, text } from '@edity/core';

const name = text({ maxChars: 30 });
const amount = number({ min: 0, max: 500, decimals: 0 });
const bullet = text({ maxChars: 60 });
const bounds = { min: 0, max: 5 };
const bullets = list(bullet, bounds);
const plans = list({ name, amount, features: bullets }, bounds);

type Plan = { name: string; amount: number; features: string[] };

describe('types inferred from Field definitions', () => {
  test('a text Field is a string and a number Field is a number', () => {
    expectTypeOf<z.infer<typeof name>>().toEqualTypeOf<string>();
    expectTypeOf<z.infer<typeof amount>>().toEqualTypeOf<number>();
  });

  test('a List of text Fields is an array of strings', () => {
    expectTypeOf<z.infer<typeof bullets>>().toEqualTypeOf<string[]>();
  });

  test('a List of objects is an array of exactly those objects', () => {
    expectTypeOf<z.infer<typeof plans>>().toEqualTypeOf<Plan[]>();
    expectTypeOf<z.input<typeof plans>>().toEqualTypeOf<Plan[]>();
  });
});

describe("a page's Field definitions", () => {
  const home = defineFields({
    hero: { title: name, cta: { label: name } },
    plans,
    testimonials: bullets,
  });

  type Content = {
    hero: { title: string; cta: { label: string } };
    plans: Plan[];
    testimonials: string[];
  };

  test('infer exactly the shape of the content', () => {
    expectTypeOf<z.infer<typeof home>>().toEqualTypeOf<Content>();
    expectTypeOf<z.input<typeof home>>().toEqualTypeOf<Content>();
  });

  test('are a Zod schema, as Astro content collections expect', () => {
    expectTypeOf(home).toExtend<z.core.$ZodType>();
  });

  test('hold only Edity Fields, Lists and groups of them', () => {
    // @ts-expect-error: a plain Zod schema is not a Field.
    defineFields({ hero: { title: name as z.ZodString } });
    // @ts-expect-error: a plain value is not a Field.
    defineFields({ title: 'Fisioterapia' });
  });
});

describe('what an Item can hold', () => {
  test('a List one level deep, and no deeper', () => {
    const notes = list(bullet, bounds);
    const features = list({ label: bullet, notes }, bounds);

    // @ts-expect-error: Lists nest one level deep at most.
    list({ name, features }, bounds);
  });

  test('at most one List', () => {
    const features = list(bullet, bounds);
    const extras = list(bullet, bounds);

    // @ts-expect-error: an Item holds at most one List.
    list({ name, features, extras }, bounds);
  });

  test('only Edity Fields and Lists', () => {
    const plain = name as z.ZodString;

    // @ts-expect-error: a plain Zod schema is not a Field.
    list({ name: plain }, bounds);
    // @ts-expect-error: an Item is a text Field or an object of Fields.
    list(amount, bounds);
    // @ts-expect-error: an Item is not a List.
    list(list(bullet, bounds), bounds);
    // @ts-expect-error: an Item holds no groups of Fields.
    list({ price: { amount } }, bounds);
  });
});
