import {
  defineFields,
  definitionOf,
  list,
  number,
  text,
  type ObjectDefinition,
} from '@edity/core';
import { describe, expect, test } from 'vitest';
import type { ContentValue } from './draft.js';
import {
  blankValue,
  listAt,
  listChanges,
  originsOf,
  type ItemNow,
  type ListNow,
} from './list-changes.js';

const fields = definitionOf(
  defineFields({
    hero: { title: text({ maxChars: 60 }) },
    services: list(text({ maxChars: 40 }), { min: 1, max: 8 }),
    plans: list(
      {
        name: text({ maxChars: 24 }),
        price: number({ min: 0, max: 999, decimals: 2 }),
        features: list(text({ maxChars: 60 }), { min: 1, max: 5 }),
      },
      { min: 1, max: 3 },
    ),
    footer: {
      links: list(text({ maxChars: 20 }), { min: 0, max: 4 }),
    },
  }),
) as ObjectDefinition;

const content = {
  hero: { title: 'Fisioterapia en casa' },
  services: ['Punción seca', 'Suelo pélvico', 'Deportiva'],
  plans: [
    { name: 'Básico', price: 19.99, features: ['Una sesión al mes'] },
    { name: 'Completo', price: 49.5, features: ['Cuatro sesiones', 'Plan'] },
  ],
  footer: { links: [] },
};

const page = {
  page: 'home',
  fields,
  content,
  narrowScreens: '(width < 600px)',
};

/** The Items of a List as built, in their places, with `values` in them. */
function asBuilt(values: readonly ContentValue[]): ListNow {
  return { items: values.map((value, origin) => ({ origin, value })) };
}

/** A plan as the page shows it, with its features List. */
function plan(
  origin: number | undefined,
  value: { name: string; price: ContentValue; features: string[] },
  features: readonly ItemNow[] = value.features.map((feature, index) => ({
    origin: origin === undefined ? undefined : index,
    value: feature,
  })),
): ItemNow {
  return { origin, value, lists: { features: { items: features } } };
}

const [basico, completo] = content.plans as [
  (typeof content.plans)[0],
  (typeof content.plans)[0],
];

describe('listAt', () => {
  test('finds the definition of a List anywhere, nested ones included', () => {
    expect(listAt(fields, 'services')).toMatchObject({
      kind: 'list',
      limits: { min: 1, max: 8 },
    });
    expect(listAt(fields, 'plans.1.features')).toMatchObject({
      kind: 'list',
      limits: { max: 5 },
    });
    expect(listAt(fields, 'footer.links')).toMatchObject({ kind: 'list' });
  });

  test('is undefined for Fields, Items and paths that are not there', () => {
    for (const path of ['hero.title', 'plans.1', 'services.0', 'nope', '']) {
      expect(listAt(fields, path), path).toBeUndefined();
    }
  });
});

describe('listChanges', () => {
  test('a List as built makes no Change', () => {
    expect(listChanges(page, 'services', asBuilt(content.services))).toEqual(
      [],
    );
    expect(
      listChanges(page, 'plans', {
        items: [plan(0, basico), plan(1, completo)],
      }),
    ).toEqual([]);
  });

  test('in a List whose Items are as built, each edited Field is a Change of its own (S7)', () => {
    const services = asBuilt(['Punción seca', 'Suelo', 'Deportiva']);
    expect(listChanges(page, 'services', services)).toEqual([
      { path: 'services.1', before: 'Suelo pélvico', after: 'Suelo' },
    ]);

    const plans = {
      items: [plan(0, { ...basico, price: 25 }), plan(1, completo)],
    };
    expect(listChanges(page, 'plans', plans)).toEqual([
      { path: 'plans.0.price', before: 19.99, after: 25 },
    ]);
  });

  test('a reordered List is one Change, with every Item before and after', () => {
    const services = {
      items: [
        { origin: 1, value: 'Suelo pélvico' },
        { origin: 0, value: 'Punción seca' },
        { origin: 2, value: 'Deportiva' },
      ],
    };

    expect(listChanges(page, 'services', services)).toEqual([
      {
        path: 'services',
        before: content.services,
        after: ['Suelo pélvico', 'Punción seca', 'Deportiva'],
      },
    ]);
  });

  test('so are a List with an Item added or removed, and the Fields edited in it', () => {
    const added = {
      items: [
        ...asBuilt(content.services).items,
        { origin: undefined, value: 'Masaje' },
      ],
    };
    expect(listChanges(page, 'services', added)).toEqual([
      {
        path: 'services',
        before: content.services,
        after: [...content.services, 'Masaje'],
      },
    ]);

    const removed = {
      items: [
        { origin: 0, value: 'Punción' },
        { origin: 2, value: 'Deportiva' },
      ],
    };
    expect(listChanges(page, 'services', removed)).toEqual([
      {
        path: 'services',
        before: content.services,
        after: ['Punción', 'Deportiva'],
      },
    ]);
  });

  test('a List with its Items in other places but the same values makes no Change', () => {
    const twins = {
      ...page,
      content: { ...content, services: ['Uno', 'Uno'] },
    };
    const swapped = {
      items: [
        { origin: 1, value: 'Uno' },
        { origin: 0, value: 'Uno' },
      ],
    };

    expect(listChanges(twins, 'services', swapped)).toEqual([]);
  });

  test('a nested List is one Change of its own while the outer List is as built (S5)', () => {
    const plans = {
      items: [
        plan(0, { ...basico, name: 'Básico+' }),
        plan(1, { ...completo, features: ['Plan', 'Cuatro sesiones'] }, [
          { origin: 1, value: 'Plan' },
          { origin: 0, value: 'Cuatro sesiones' },
        ]),
      ],
    };

    expect(listChanges(page, 'plans', plans)).toEqual([
      { path: 'plans.0.name', before: 'Básico', after: 'Básico+' },
      {
        path: 'plans.1.features',
        before: ['Cuatro sesiones', 'Plan'],
        after: ['Plan', 'Cuatro sesiones'],
      },
    ]);
  });

  test('once the outer List changes, its one Change holds the nested Lists too', () => {
    const newPlan = {
      name: 'Nuevo',
      price: '',
      features: [''],
    };
    const plans = {
      items: [
        plan(1, { ...completo, features: ['Plan'] }, [
          { origin: 1, value: 'Plan' },
        ]),
        plan(0, basico),
        plan(undefined, newPlan),
      ],
    };

    expect(listChanges(page, 'plans', plans)).toEqual([
      {
        path: 'plans',
        before: content.plans,
        after: [{ ...completo, features: ['Plan'] }, basico, newPlan],
      },
    ]);
  });

  test('a nested List the page does not show stays as built', () => {
    const plans = {
      items: [
        { origin: 0, value: basico },
        { origin: 1, value: completo },
      ],
    };

    expect(listChanges(page, 'plans', plans)).toEqual([]);
  });

  test('is empty for a path that is not a List of the page', () => {
    expect(listChanges(page, 'hero.title', { items: [] })).toEqual([]);
    expect(listChanges(page, 'nope', { items: [] })).toEqual([]);
  });
});

describe('originsOf', () => {
  test('matches each value with the first built Item left that equals it', () => {
    expect(
      originsOf(['a', 'b', 'a', 'c'], ['a', 'c', 'x', 'a', 'a', { name: 'b' }]),
    ).toEqual([0, 3, undefined, 2, undefined, undefined]);
  });

  test('gives every Item its own place back when the value is as built', () => {
    expect(originsOf(content.plans, content.plans)).toEqual([0, 1]);
  });
});

describe('blankValue', () => {
  test('is what a new Item holds: empty Fields and the fewest Items its Lists take', () => {
    expect(blankValue(listAt(fields, 'services')!.item)).toBe('');
    expect(blankValue(listAt(fields, 'plans')!.item)).toEqual({
      name: '',
      price: '',
      features: [''],
    });
  });
});
