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
});
