import { defineFields, list, number, text } from '@edity/core';
import { describe, expect, test } from 'vitest';
import { editable } from '@edity/astro/editable';

/** Renders an element the way Astro renders `data-edity-*={marker}`. */
function tag(
  name: string,
  markers: Record<string, string | undefined>,
  content = '',
): string {
  const attributes = Object.entries(markers)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` data-edity-${key}="${value}"`)
    .join('');
  return `<${name}${attributes}>${content}</${name}>`;
}

const fields = defineFields({
  hero: {
    title: text({ maxChars: 60, maxLines: 2, maxLinesNarrow: 3 }),
  },
  visit: { price: number({ min: 0, max: 500, decimals: 2 }) },
  services: list(text({ maxChars: 40 }), { min: 1, max: 8 }),
  plans: list(
    {
      name: text({ maxChars: 30 }),
      price: number({ min: 5, max: 999, decimals: 2 }),
      features: list(text({ maxChars: 60 }), { min: 1, max: 5 }),
    },
    { min: 1, max: 3 },
  ),
});

const content = {
  hero: { title: 'Fisioterapia a domicilio' },
  visit: { price: 35.5 },
  services: ['Masaje', 'Pilates'],
  plans: [
    { name: 'Básico', price: 19.99, features: ['Una sesión al mes'] },
    {
      name: 'Completo',
      price: 49.5,
      features: ['Cuatro sesiones al mes', 'Plan de ejercicios'],
    },
  ],
};

const home = editable(fields, { collection: 'home', data: content });

describe('the page marker', () => {
  test("holds the page's name, Field definitions, content and narrow screens as JSON", () => {
    expect(JSON.parse(home.page!)).toEqual({
      page: 'home',
      fields: {
        kind: 'object',
        shape: {
          hero: {
            kind: 'object',
            shape: {
              title: {
                kind: 'text',
                limits: { maxChars: 60, maxLines: 2, maxLinesNarrow: 3 },
              },
            },
          },
          visit: {
            kind: 'object',
            shape: {
              price: {
                kind: 'number',
                limits: { min: 0, max: 500, decimals: 2 },
              },
            },
          },
          services: {
            kind: 'list',
            limits: { min: 1, max: 8 },
            item: { kind: 'text', limits: { maxChars: 40 } },
          },
          plans: {
            kind: 'list',
            limits: { min: 1, max: 3 },
            item: {
              kind: 'object',
              shape: {
                name: { kind: 'text', limits: { maxChars: 30 } },
                price: {
                  kind: 'number',
                  limits: { min: 5, max: 999, decimals: 2 },
                },
                features: {
                  kind: 'list',
                  limits: { min: 1, max: 5 },
                  item: { kind: 'text', limits: { maxChars: 60 } },
                },
              },
            },
          },
        },
      },
      content,
      narrowScreens: '(width < 600px)',
    });
  });
});

describe('a Field outside any List', () => {
  test('is marked with its path', () => {
    expect(home.field('hero.title')).toBe('hero.title');
    expect(home.field('visit.price')).toBe('visit.price');
  });

  test('throws on a typo in its path, naming the path and the page', () => {
    // @ts-expect-error: a typo in a Field path is also a type error.
    expect(() => home.field('hero.titel')).toThrow(
      'Unknown Field path "hero.titel" in page "home"',
    );
  });

  test('throws on the path of a List or a group, which are not Fields', () => {
    // @ts-expect-error: a List is not a Field.
    expect(() => home.field('services')).toThrow(
      'Unknown Field path "services" in page "home"',
    );
    // @ts-expect-error: a group of Fields is not a Field.
    expect(() => home.field('hero')).toThrow(
      'Unknown Field path "hero" in page "home"',
    );
  });
  test('throws on the path of a Field inside a List, which its Item marks', () => {
    // @ts-expect-error: Fields inside a List are marked through its Items.
    expect(() => home.field('plans.0.name')).toThrow(
      '"plans.0.name" is inside the List "plans" in page "home": mark it through its Item, with item.field() or item.list() in <Items>',
    );
  });
});

describe('a List of text Fields', () => {
  const services = home.list('services');

  test('is marked with its path, and its Items with theirs', () => {
    expect(services.path).toBe('services');
    expect(
      services.items.map((item) => [item.path, item.field(), item.value]),
    ).toEqual([
      ['services.0', 'services.0', 'Masaje'],
      ['services.1', 'services.1', 'Pilates'],
    ]);
  });

  test('throws on a typo in its path', () => {
    // @ts-expect-error: a typo in a List path is also a type error.
    expect(() => home.list('servises')).toThrow(
      'Unknown List path "servises" in page "home"',
    );
  });
});

describe('a List of Items with Fields and a nested List', () => {
  const [, complete] = home.list('plans').items;

  test('marks the Fields of an Item with their full path', () => {
    expect(complete?.path).toBe('plans.1');
    expect(complete?.field('name')).toBe('plans.1.name');
    expect(complete?.field('price')).toBe('plans.1.price');
  });

  test('marks the nested List and its Items with their full path', () => {
    const features = complete?.list('features');

    expect(features?.path).toBe('plans.1.features');
    expect(features?.items.map((item) => item.field())).toEqual([
      'plans.1.features.0',
      'plans.1.features.1',
    ]);
  });

  test('throws on a typo in the key of an Item Field, naming its path', () => {
    // @ts-expect-error: a typo in an Item's Field key is also a type error.
    expect(() => complete?.field('nmae')).toThrow(
      'Unknown Field path "plans.1.nmae" in page "home"',
    );
    // @ts-expect-error: a typo in an Item's List key is also a type error.
    expect(() => complete?.list('featrues')).toThrow(
      'Unknown List path "plans.1.featrues" in page "home"',
    );
  });
});

describe('rendering the Items of a List', () => {
  const short = editable(fields, {
    collection: 'home',
    data: {
      ...content,
      plans: [{ name: 'Básico', price: 19.99, features: ['Una sesión'] }],
    },
  });

  test('ends with a template holding a blank Item at the next position', async () => {
    const html = await short.list('plans').render(async (plan) => {
      const features = plan.list('features');
      const bullets = await features.render((feature) =>
        tag(
          'li',
          { item: feature.path, field: feature.field() },
          feature.value,
        ),
      );
      return tag(
        'article',
        { item: plan.path },
        tag('h3', { field: plan.field('name') }, plan.value.name) +
          tag(
            'p',
            { field: plan.field('price') },
            plan.value.price.toFixed(2),
          ) +
          tag('ul', { list: features.path }, bullets),
      );
    });

    expect(html).toBe(
      '<article data-edity-item="plans.0">' +
        '<h3 data-edity-field="plans.0.name">Básico</h3>' +
        '<p data-edity-field="plans.0.price">19.99</p>' +
        '<ul data-edity-list="plans.0.features">' +
        '<li data-edity-item="plans.0.features.0" data-edity-field="plans.0.features.0">Una sesión</li>' +
        '<template data-edity-template="plans.0.features">' +
        '<li data-edity-item="plans.0.features.1" data-edity-field="plans.0.features.1"></li>' +
        '</template>' +
        '</ul>' +
        '</article>' +
        '<template data-edity-template="plans">' +
        '<article data-edity-item="plans.1">' +
        '<h3 data-edity-field="plans.1.name"></h3>' +
        '<p data-edity-field="plans.1.price">5.00</p>' +
        '<ul data-edity-list="plans.1.features">' +
        '<li data-edity-item="plans.1.features.0" data-edity-field="plans.1.features.0"></li>' +
        '<template data-edity-template="plans.1.features">' +
        '<li data-edity-item="plans.1.features.1" data-edity-field="plans.1.features.1"></li>' +
        '</template>' +
        '</ul>' +
        '</article>' +
        '</template>',
    );
  });

  test('throws when the markup of an Item does not start with its root element', async () => {
    const render = short
      .list('plans')
      .render((plan) =>
        tag('div', {}, tag('article', { item: plan.path }, plan.value.name)),
      );

    await expect(render).rejects.toThrow(
      'The Item "plans.0" in page "home" must start with its root element, marked with data-edity-item={item.path}',
    );
  });
});
