import { describe, expect, test } from 'vitest';
import { Draft, type Change } from './draft.js';

const title: Change = {
  path: 'hero.title',
  before: 'Fisioterapia en casa',
  after: 'Fisioterapia a domicilio',
};
const price: Change = { path: 'visit.price', before: 35, after: 40 };

describe('Draft', () => {
  test('starts with no Changes', () => {
    const draft = new Draft();

    expect(draft.count.value).toBe(0);
    expect([...draft.changes.value.values()]).toEqual([]);
  });

  test('starts with the Changes it is given, such as a restored Draft', () => {
    const draft = new Draft([title, price]);

    expect(draft.count.value).toBe(2);
    expect(draft.changes.value.get('visit.price')).toEqual(price);
  });

  test('counts one Change per path: recording a path again replaces its Change', () => {
    const draft = new Draft();

    draft.record(title);
    draft.record(price);
    draft.record({ ...title, after: 'Fisioterapia cerca de ti' });

    expect(draft.count.value).toBe(2);
    expect([...draft.changes.value.values()]).toEqual([
      { ...title, after: 'Fisioterapia cerca de ti' },
      price,
    ]);
  });

  test('remove drops the Change at a path and keeps the order of the rest', () => {
    const draft = new Draft([title, price]);

    draft.remove('hero.title');
    draft.remove('not.recorded');
    draft.record(title);

    expect([...draft.changes.value.values()]).toEqual([price, title]);
  });

  test('discard drops every Change and returns them', () => {
    const draft = new Draft([title, price]);

    const dropped = draft.discard();

    expect(dropped).toEqual([title, price]);
    expect(draft.count.value).toBe(0);
  });

  test("replace makes a List's Changes the ones at its path and under it (S7)", () => {
    const name: Change = {
      path: 'plans.0.name',
      before: 'Básico',
      after: 'Básico+',
    };
    const features: Change = {
      path: 'plans.1.features',
      before: ['Una'],
      after: ['Una', 'Dos'],
    };
    const plans: Change = {
      path: 'plans',
      before: [{ name: 'Básico' }, { name: 'Completo' }],
      after: [{ name: 'Completo' }, { name: 'Básico' }],
    };
    const lookalike: Change = { path: 'plansExtra', before: 'a', after: 'b' };
    const draft = new Draft([name, title, lookalike]);

    draft.replace('plans', [name, features]);
    expect([...draft.changes.value.values()]).toEqual([
      name,
      title,
      lookalike,
      features,
    ]);

    draft.replace('plans', [plans]);
    expect([...draft.changes.value.values()]).toEqual([
      title,
      lookalike,
      plans,
    ]);
    expect(draft.count.value).toBe(3);

    draft.replace('plans', []);
    expect([...draft.changes.value.values()]).toEqual([title, lookalike]);
  });

  test('replace leaves the Changes as they were when they are the same', () => {
    const draft = new Draft([title, price]);
    const before = draft.changes.value;

    draft.replace('hero', [{ ...title }]);
    draft.replace('plans', []);

    expect(draft.changes.value).toBe(before);
  });

  describe('a Change keeps the value before that the Client first changed (V2)', () => {
    // Restored from the browser after a newer Release changed the content:
    // the built value is not the one the Client changed any more.
    const kept: Change = { ...title, before: 'Fisioterapia' };

    test('recording its path again keeps it', () => {
      const draft = new Draft([kept, price]);

      draft.record({ ...title, after: 'Fisioterapia cerca de ti' });

      expect([...draft.changes.value.values()]).toEqual([
        { ...kept, after: 'Fisioterapia cerca de ti' },
        price,
      ]);
    });

    test('so does replacing a List’s Changes, for a path that stays', () => {
      const draft = new Draft([
        {
          path: 'services',
          before: ['Suelo pélvico'],
          after: ['Suelo pélvico', 'Punción seca'],
        },
      ]);

      draft.replace('services', [
        {
          path: 'services',
          before: ['Suelo pélvico', 'Punción seca'],
          after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
        },
      ]);

      expect([...draft.changes.value.values()]).toEqual([
        {
          path: 'services',
          before: ['Suelo pélvico'],
          after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
        },
      ]);
    });

    test('a List Change keeps those of the Changes under it that it takes the place of (S7)', () => {
      const draft = new Draft([
        { path: 'plans.0.price', before: 19, after: 21 },
        { path: 'plans.1.features', before: ['Una'], after: ['Una', 'Dos'] },
      ]);
      const built = [
        { name: 'Básico', price: 19.99, features: ['Una sesión'] },
        { name: 'Completo', price: 49.5, features: ['Cuatro', 'Plan'] },
      ];

      draft.replace('plans', [
        { path: 'plans', before: built, after: [built[1]!] },
      ]);

      expect([...draft.changes.value.values()]).toEqual([
        {
          path: 'plans',
          before: [
            { name: 'Básico', price: 19, features: ['Una sesión'] },
            { name: 'Completo', price: 49.5, features: ['Una'] },
          ],
          after: [built[1]],
        },
      ]);
      // The built content it came from is left as it was.
      expect(built[0]!.price).toBe(19.99);
    });

    test('Changes that take the place of a List Change keep what it held before at their paths', () => {
      const draft = new Draft([
        {
          path: 'services',
          before: ['Suelo', 'Punción seca'],
          after: ['Punción seca', 'Suelo pélvico y embarazo'],
        },
      ]);

      // Its Items back in their built order: a Change for each edited one.
      draft.replace('services', [
        {
          path: 'services.0',
          before: 'Suelo pélvico',
          after: 'Suelo pélvico y embarazo',
        },
        { path: 'services.2', before: 'Masaje', after: 'Masajes' },
      ]);

      expect([...draft.changes.value.values()]).toEqual([
        {
          path: 'services.0',
          before: 'Suelo',
          after: 'Suelo pélvico y embarazo',
        },
        // An Item the List did not have when the Client first changed it.
        { path: 'services.2', before: 'Masaje', after: 'Masajes' },
      ]);
    });
  });
});

describe('isChanged (L7)', () => {
  const content = {
    hero: { title: 'Fisioterapia', lead: 'Una hora' },
    services: ['Suelo pélvico', 'Punción seca', 'Masaje'],
    plans: [
      { name: 'Básico', features: ['Una sesión'] },
      { name: 'Completo', features: ['Cuatro', 'Plan'] },
    ],
  };

  test('a Field with a Change changed, and one without did not', () => {
    const draft = new Draft([
      { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio' },
      { path: 'services.1', before: 'Punción seca', after: 'Punción' },
    ]);

    expect(draft.isChanged('hero.title', content)).toBe(true);
    expect(draft.isChanged('services.1', content)).toBe(true);
    expect(draft.isChanged('hero.lead', content)).toBe(false);
    expect(draft.isChanged('hero.titles', content)).toBe(false);
    expect(draft.isChanged('services.0', content)).toBe(false);
  });

  test('in a List whose structure changed, new and edited Items changed, and built ones that only moved did not (S7)', () => {
    const draft = new Draft([
      {
        path: 'services',
        before: content.services,
        after: ['Masaje', 'Suelo pélvico', 'Punción', 'Pilates'],
      },
      {
        path: 'plans',
        before: content.plans,
        after: [
          { name: 'Completo', features: ['Cuatro', 'Plan'] },
          { name: 'Básico', features: ['Una sesión', 'Correo'] },
        ],
      },
    ]);

    expect(draft.isChanged('services.0', content)).toBe(false);
    expect(draft.isChanged('services.1', content)).toBe(false);
    expect(draft.isChanged('services.2', content)).toBe(true);
    expect(draft.isChanged('services.3', content)).toBe(true);
    expect(draft.isChanged('plans.0.name', content)).toBe(false);
    expect(draft.isChanged('plans.0.features.1', content)).toBe(false);
    // The card whose List gained an Item.
    expect(draft.isChanged('plans.1.name', content)).toBe(true);
    expect(draft.isChanged('plans.1.features.0', content)).toBe(true);
    expect(draft.isChanged('plansx.0', content)).toBe(false);
  });

  test('so does a List inside an Item, while the outer List is as built', () => {
    const draft = new Draft([
      {
        path: 'plans.1.features',
        before: content.plans[1]!.features,
        after: ['Plan', 'Cuatro', 'Seguimiento'],
      },
    ]);

    expect(draft.isChanged('plans.1.features.0', content)).toBe(false);
    expect(draft.isChanged('plans.1.features.2', content)).toBe(true);
    expect(draft.isChanged('plans.1.name', content)).toBe(false);
  });
});

describe('valueAt', () => {
  const content = {
    visit: { price: 35 },
    plans: [
      { name: 'Básico', price: 19.99 },
      { name: 'Completo', price: 49.5 },
    ],
  };

  test("is a Change's after, or the value in the List Change it is in", () => {
    const draft = new Draft([
      { path: 'visit.price', before: 35, after: '13.000' },
      {
        path: 'plans',
        before: content.plans,
        after: [{ name: 'Completo', price: 45 }],
      },
    ]);

    expect(draft.valueAt('visit.price', content)).toBe('13.000');
    expect(draft.valueAt('plans.0.price', content)).toBe(45);
    expect(draft.valueAt('plans.1.price', content)).toBeUndefined();
  });

  test('is the built value where the Draft holds none', () => {
    const draft = new Draft([
      { path: 'plans.1.price', before: 49.5, after: 45 },
    ]);

    expect(draft.valueAt('visit.price', content)).toBe(35);
    expect(draft.valueAt('plans.0.price', content)).toBe(19.99);
    expect(draft.valueAt('plans.1.price', content)).toBe(45);
  });
});
