import {
  defineFields,
  definitionOf,
  list,
  number,
  text,
  type ObjectDefinition,
} from '@edity/core';
import { describe, expect, test } from 'vitest';
import {
  definitionAt,
  fieldAt,
  fieldChange,
  fitsDraft,
  isWellFormed,
  sameValue,
  valueAt,
} from './content.js';
import type { Change } from './draft.js';

const fields = definitionOf(
  defineFields({
    hero: { title: text({ maxChars: 60 }) },
    visit: { price: number({ min: 0, max: 500, decimals: 2 }) },
    services: list(text({ maxChars: 40 }), { min: 1, max: 8 }),
    plans: list(
      {
        name: text({ maxChars: 24 }),
        price: number({ min: 0, max: 999, decimals: 2 }),
        features: list(text({ maxChars: 60 }), { min: 1, max: 5 }),
      },
      { min: 1, max: 3 },
    ),
  }),
) as ObjectDefinition;

const content = {
  hero: { title: 'Fisioterapia en casa' },
  visit: { price: 35 },
  services: ['Punción seca', 'Suelo pélvico'],
  plans: [
    { name: 'Básico', price: 19.99, features: ['Una sesión al mes'] },
    { name: 'Completo', price: 49.5, features: ['Cuatro sesiones', 'Plan'] },
  ],
};

const page = {
  page: 'home',
  fields,
  content,
  narrowScreens: '(width < 600px)',
};

describe('fieldAt', () => {
  test('finds the definition of a Field anywhere, Items included', () => {
    expect(fieldAt(fields, 'hero.title')).toMatchObject({ kind: 'text' });
    expect(fieldAt(fields, 'visit.price')).toMatchObject({
      kind: 'number',
      limits: { decimals: 2 },
    });
    expect(fieldAt(fields, 'services.7')).toMatchObject({ kind: 'text' });
    expect(fieldAt(fields, 'plans.1.price')).toMatchObject({ kind: 'number' });
    expect(fieldAt(fields, 'plans.0.features.4')).toMatchObject({
      kind: 'text',
    });
  });

  test('is undefined for Lists, groups and paths that are not there', () => {
    for (const path of [
      'plans',
      'plans.1',
      'plans.1.features',
      'hero',
      'hero.subtitle',
      'hero.title.x',
      'plans.first.price',
      'services.-1',
      '',
    ]) {
      expect(fieldAt(fields, path), path).toBeUndefined();
    }
  });
});

describe('definitionAt', () => {
  test('finds Lists, Items and groups too', () => {
    expect(definitionAt(fields, 'plans')).toMatchObject({ kind: 'list' });
    expect(definitionAt(fields, 'plans.1')).toMatchObject({ kind: 'object' });
    expect(definitionAt(fields, 'hero')).toMatchObject({ kind: 'object' });
    expect(definitionAt(fields, 'plans.1.features.0')).toMatchObject({
      kind: 'text',
    });
    expect(definitionAt(fields, 'plans.x')).toBeUndefined();
  });
});

describe('valueAt', () => {
  test('reads the value at a path in the content', () => {
    expect(valueAt(content, 'hero.title')).toBe('Fisioterapia en casa');
    expect(valueAt(content, 'plans.1.price')).toBe(49.5);
    expect(valueAt(content, 'plans.1.features.1')).toBe('Plan');
    expect(valueAt(content, 'services')).toEqual(content.services);
  });

  test('is undefined where the content has nothing', () => {
    expect(valueAt(content, 'plans.2.price')).toBeUndefined();
    expect(valueAt(content, 'hero.title.length')).toBeUndefined();
    expect(valueAt(content, 'nope')).toBeUndefined();
    expect(valueAt(undefined, 'hero.title')).toBeUndefined();
  });
});

describe('sameValue', () => {
  test('compares content values by what they hold, Fields in any order', () => {
    const plan = { name: 'Básico', price: 19.99, features: ['Una', 'Dos'] };
    expect(
      sameValue(plan, {
        features: ['Una', 'Dos'],
        price: 19.99,
        name: 'Básico',
      }),
    ).toBe(true);
    expect(sameValue(plan, { ...plan, features: ['Dos', 'Una'] })).toBe(false);
    expect(sameValue(plan, { name: 'Básico', price: 19.99 })).toBe(false);
    expect(sameValue([plan], [{ ...plan }])).toBe(true);
    expect(sameValue('12', 12)).toBe(false);
    expect(sameValue(['a'], { 0: 'a' })).toBe(false);
  });
});

describe('fieldChange', () => {
  test("records the Field's built value as before (P3)", () => {
    expect(fieldChange(page, 'hero.title', 'Fisioterapia a domicilio')).toEqual(
      {
        path: 'hero.title',
        before: 'Fisioterapia en casa',
        after: 'Fisioterapia a domicilio',
      },
    );
    expect(fieldChange(page, 'plans.0.price', 25)).toEqual({
      path: 'plans.0.price',
      before: 19.99,
      after: 25,
    });
  });

  test('is undefined when the Field holds its built value again', () => {
    expect(fieldChange(page, 'hero.title', 'Fisioterapia en casa')).toBe(
      undefined,
    );
    expect(fieldChange(page, 'visit.price', 35)).toBeUndefined();
  });

  test('reads text that differs only in spacing as the built value', () => {
    const spaced = {
      ...page,
      content: { ...content, hero: { title: 'Fisioterapia\u00a0en  casa ' } },
    };
    expect(fieldChange(spaced, 'hero.title', 'Fisioterapia en casa')).toBe(
      undefined,
    );
  });

  test('keeps the text of a number Field that is not a number as after', () => {
    expect(fieldChange(page, 'visit.price', '')).toEqual({
      path: 'visit.price',
      before: 35,
      after: '',
    });
  });
});

describe('fitsDraft', () => {
  test('takes a Change a Draft can hold, finished or not', () => {
    for (const change of [
      { path: 'hero.title', before: 'Hola', after: '' },
      { path: 'visit.price', before: 35, after: 40 },
      // Text typed into a number Field that is no number yet.
      { path: 'visit.price', before: 35, after: '13.' },
      { path: 'services', before: content.services, after: ['Uno', ''] },
      { path: 'services.1', before: 'Suelo pélvico', after: 'Suelo' },
      {
        path: 'plans',
        before: content.plans,
        after: [{ name: '', price: '', features: [''] }],
      },
      { path: 'plans.0.features', before: ['Una'], after: ['Una', 'Dos'] },
    ]) {
      expect(fitsDraft(fields, change), change.path).toBe(true);
    }
  });

  test('refuses a value its Field or List could never hold, before or after', () => {
    const services = { path: 'services', before: content.services };
    const plans = { path: 'plans', before: content.plans };
    const plan = { name: 'Nuevo', price: 10, features: ['Una'] };
    // Whatever a browser's storage held, so not all of them are Changes.
    const kept: unknown[] = [
      // An Item of a text List that is no text: showing it would throw.
      { ...services, after: [{ toString: '' }] },
      { ...services, after: 'Uno' },
      { path: 'hero.title', before: 'Hola', after: ['Hola'] },
      { path: 'visit.price', before: 35, after: { amount: 40 } },
      { path: 'visit.price', before: { amount: 35 }, after: 40 },
      { ...plans, after: [{ ...plan, notes: 'Más' }] },
      { ...plans, after: [{ name: 'Nuevo', price: 10 }] },
      { ...plans, after: [{ ...plan, features: 'Una' }] },
      // A group of Fields, or nothing at all.
      { path: 'hero', before: content.hero, after: { title: 'Adiós' } },
      { path: 'hero.subtitle', before: 'Uno', after: 'Dos' },
    ];
    for (const change of kept) {
      expect(fitsDraft(fields, change as Change), JSON.stringify(change)).toBe(
        false,
      );
    }
  });
});

describe('isWellFormed', () => {
  test('wants one visible line of text in a text Field, as @edity/core checks it', () => {
    const title = { path: 'hero.title', before: 'Hola' };
    expect(isWellFormed(fields, { ...title, after: 'Adiós' })).toBe(true);
    expect(isWellFormed(fields, { ...title, after: '' })).toBe(false);
    expect(isWellFormed(fields, { ...title, after: '\u00a0 ' })).toBe(false);
    expect(isWellFormed(fields, { ...title, after: 'Uno\nDos' })).toBe(false);
    expect(isWellFormed(fields, { ...title, after: 3 })).toBe(false);
  });

  test('leaves the Limits of Fields to the counters (L7)', () => {
    expect(
      isWellFormed(fields, {
        path: 'hero.title',
        before: 'Hola',
        after: 'x'.repeat(61),
      }),
    ).toBe(true);
    expect(
      isWellFormed(fields, { path: 'visit.price', before: 35, after: 500.555 }),
    ).toBe(true);
  });

  test('wants a number in a number Field', () => {
    const price = { path: 'visit.price', before: 35 };
    expect(isWellFormed(fields, { ...price, after: 0 })).toBe(true);
    expect(isWellFormed(fields, { ...price, after: '' })).toBe(false);
    expect(isWellFormed(fields, { ...price, after: '13.000' })).toBe(false);
    expect(isWellFormed(fields, { ...price, after: Number.NaN })).toBe(false);
  });

  test("wants a List's Items within its bounds, with every Field well formed", () => {
    const services = { path: 'services', before: content.services };
    expect(isWellFormed(fields, { ...services, after: ['Uno', 'Dos'] })).toBe(
      true,
    );
    expect(isWellFormed(fields, { ...services, after: ['Uno', ' '] })).toBe(
      false,
    );
    expect(isWellFormed(fields, { ...services, after: [] })).toBe(false);
    expect(
      isWellFormed(fields, { ...services, after: Array(9).fill('Uno') }),
    ).toBe(false);
    expect(isWellFormed(fields, { ...services, after: 'Uno' })).toBe(false);

    const plans = { path: 'plans', before: content.plans };
    const plan = { name: 'Nuevo', price: 10, features: ['Una'] };
    expect(isWellFormed(fields, { ...plans, after: [plan] })).toBe(true);
    for (const broken of [
      { ...plan, price: '' },
      { ...plan, name: '' },
      { ...plan, features: [] },
      { ...plan, features: [''] },
      { ...plan, notes: 'Más' },
      ['Nuevo'],
    ]) {
      expect(isWellFormed(fields, { ...plans, after: [plan, broken] })).toBe(
        false,
      );
    }
    expect(
      isWellFormed(fields, {
        path: 'plans.0.features',
        before: ['Una sesión al mes'],
        after: ['Una', 'Dos'],
      }),
    ).toBe(true);
  });
});
