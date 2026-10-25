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
  fieldAt,
  fieldChange,
  isWellFormed,
  pathPattern,
  valueAt,
} from './content.js';

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

describe('pathPattern', () => {
  test('stands for the same Field in every Item', () => {
    expect(pathPattern('plans.1.features.0')).toBe('plans.*.features.*');
    expect(pathPattern('services.12')).toBe('services.*');
    expect(pathPattern('hero.title')).toBe('hero.title');
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

describe('isWellFormed', () => {
  test('wants text in a text Field, and not blank', () => {
    const title = { path: 'hero.title', before: 'Hola' };
    expect(isWellFormed(fields, { ...title, after: 'Adiós' })).toBe(true);
    expect(isWellFormed(fields, { ...title, after: '' })).toBe(false);
    expect(isWellFormed(fields, { ...title, after: 3 })).toBe(false);
  });

  test('wants a number in a number Field', () => {
    const price = { path: 'visit.price', before: 35 };
    expect(isWellFormed(fields, { ...price, after: 0 })).toBe(true);
    expect(isWellFormed(fields, { ...price, after: '' })).toBe(false);
    expect(isWellFormed(fields, { ...price, after: '13.000' })).toBe(false);
    expect(isWellFormed(fields, { ...price, after: Number.NaN })).toBe(false);
  });
});
